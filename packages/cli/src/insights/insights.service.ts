import { GlobalConfig } from '@n8n/config';
import { Container, Service } from '@n8n/di';
import type { ExecutionLifecycleHooks } from 'n8n-core';
import type { ExecutionStatus, IRun, WorkflowExecuteMode } from 'n8n-workflow';
import { UnexpectedError } from 'n8n-workflow';
import { z } from 'zod';

import type { InsightsByPeriod } from '@/databases/entities/insights-by-period';
import { InsightsMetadata } from '@/databases/entities/insights-metadata';
import { InsightsRaw } from '@/databases/entities/insights-raw';
import type { TypeUnits } from '@/databases/entities/insights-shared';
import { NumberToType } from '@/databases/entities/insights-shared';
import { SharedWorkflow } from '@/databases/entities/shared-workflow';
import { InsightsByPeriodRepository } from '@/databases/repositories/insights-by-period.repository';
import { InsightsRawRepository } from '@/databases/repositories/insights-raw.repository';
import { SharedWorkflowRepository } from '@/databases/repositories/shared-workflow.repository';
import { sql } from '@/utils/sql';

const config = Container.get(GlobalConfig);
const dbType = config.database.type;

const shouldSkipStatus: Record<ExecutionStatus, boolean> = {
	success: false,
	crashed: false,
	error: false,

	canceled: true,
	new: true,
	running: true,
	unknown: true,
	waiting: true,
};

const shouldSkipMode: Record<WorkflowExecuteMode, boolean> = {
	cli: false,
	error: false,
	integrated: false,
	retry: false,
	trigger: false,
	webhook: false,
	evaluation: false,

	internal: true,
	manual: true,
};

const parser = z
	.object({
		period: z.enum(['previous', 'current']),
		// TODO: extract to abstract-entity
		type: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
		// TODO: improve, it's either or
		total_value: z.union([
			z.string().transform((value) => Number.parseInt(value)),
			z.number().nullable(),
		]),
		avg_runtime: z.union([
			z.number().nullable(),
			z.string().transform((value) => Number.parseFloat(value)),
		]),
	})
	.array();
const getQuotedIdentifier = (identifier: string) => {
	if (dbType === 'postgresdb') {
		return `"${identifier}"`;
	}
	return `\`${identifier}\``;
};

@Service()
export class InsightsService {
	constructor(
		private readonly sharedWorkflowRepository: SharedWorkflowRepository,
		private readonly insightsByPeriodRepository: InsightsByPeriodRepository,
		private readonly globalConfig: GlobalConfig,
		private readonly insightsRawRepository: InsightsRawRepository,
	) {}

	async workflowExecuteAfterHandler(ctx: ExecutionLifecycleHooks, fullRunData: IRun) {
		if (shouldSkipStatus[fullRunData.status] || shouldSkipMode[fullRunData.mode]) {
			return;
		}

		const status = fullRunData.status === 'success' ? 'success' : 'failure';

		await this.sharedWorkflowRepository.manager.transaction(async (trx) => {
			const sharedWorkflow = await trx.findOne(SharedWorkflow, {
				where: { workflowId: ctx.workflowData.id, role: 'workflow:owner' },
				relations: { project: true },
			});

			if (!sharedWorkflow) {
				throw new UnexpectedError(
					`Could not find an owner for the workflow with the name '${ctx.workflowData.name}' and the id '${ctx.workflowData.id}'`,
				);
			}

			await trx.upsert(
				InsightsMetadata,
				{
					workflowId: ctx.workflowData.id,
					workflowName: ctx.workflowData.name,
					projectId: sharedWorkflow.projectId,
					projectName: sharedWorkflow.project.name,
				},
				['workflowId'],
			);
			const metadata = await trx.findOneBy(InsightsMetadata, {
				workflowId: ctx.workflowData.id,
			});

			if (!metadata) {
				// This can't happen, we just wrote the metadata in the same
				// transaction.
				throw new UnexpectedError(
					`Could not find metadata for the workflow with the id '${ctx.workflowData.id}'`,
				);
			}

			// success or failure event
			{
				const event = new InsightsRaw();
				event.metaId = metadata.metaId;
				event.type = status;
				event.value = 1;
				await trx.insert(InsightsRaw, event);
			}

			// run time event
			if (fullRunData.stoppedAt) {
				const value = fullRunData.stoppedAt.getTime() - fullRunData.startedAt.getTime();
				const event = new InsightsRaw();
				event.metaId = metadata.metaId;
				event.type = 'runtime_ms';
				event.value = value;
				await trx.insert(InsightsRaw, event);
			}
		});
	}

	// TODO: add return type once rebased on master and InsightsSummary is
	// available
	async getInsightsSummary(): Promise<any> {
		const cte =
			dbType === 'sqlite'
				? sql`
				SELECT
					strftime('%s', date('now', '-7 days')) AS current_start,
					strftime('%s', date('now')) AS current_end,
					strftime('%s', date('now', '-14 days')) AS previous_start
			`
				: dbType === 'postgresdb'
					? sql`
						SELECT
						(CURRENT_DATE - INTERVAL '7 days')::timestamptz AS current_start,
						CURRENT_DATE::timestamptz AS current_end,
						(CURRENT_DATE - INTERVAL '14 days')::timestamptz AS previous_start
					`
					: sql`
						SELECT
							DATE_SUB(CURDATE(), INTERVAL 7 DAY) AS current_start,
							CURDATE() AS current_end,
							DATE_SUB(CURDATE(), INTERVAL 14 DAY) AS previous_start
					`;

		const rawRows = await this.insightsByPeriodRepository
			.createQueryBuilder('insights')
			.addCommonTableExpression(cte, 'date_ranges')
			.select(
				sql`
				CASE
					WHEN insights.periodStart >= date_ranges.current_start AND insights.periodStart <= date_ranges.current_end
					THEN 'current'
					ELSE 'previous'
				END
			`,
				'period',
			)
			.addSelect('insights.type', 'type')
			.addSelect('SUM(CASE WHEN type = 1 THEN NULL ELSE value END)', 'total_value')
			.addSelect(
				'AVG(CASE WHEN insights.type = 1 THEN insights.value ELSE NULL END)',
				'avg_runtime',
			)
			// Use a cross join with the CTE
			.innerJoin('date_ranges', 'date_ranges', '1=1')
			// Filter to only include data from the last 14 days
			.where('insights.periodStart >= date_ranges.previous_start')
			.andWhere('insights.periodStart <= date_ranges.current_end')
			// Group by both period and type
			.groupBy('period')
			.addGroupBy('insights.type')
			.getRawMany();

		const rows = parser.parse(rawRows);

		// Initialize data structures for both periods
		const data = {
			current: { byType: {} as Record<TypeUnits, number> },
			previous: { byType: {} as Record<TypeUnits, number> },
		};

		// Organize data by period and type
		rows.forEach((row) => {
			const { period, type, total_value, avg_runtime } = row;
			if (!data[period]) return;

			data[period].byType[NumberToType[type]] = (total_value ? total_value : avg_runtime) ?? 0;
		});

		// Get values with defaults for missing data
		const getValueByType = (period: 'current' | 'previous', type: TypeUnits) =>
			data[period]?.byType[type] ?? 0;

		// Calculate metrics
		const currentSuccesses = getValueByType('current', 'success');
		const currentFailures = getValueByType('current', 'failure');
		const previousSuccesses = getValueByType('previous', 'success');
		const previousFailures = getValueByType('previous', 'failure');

		const currentTotal = currentSuccesses + currentFailures;
		const previousTotal = previousSuccesses + previousFailures;

		const currentFailureRate = currentTotal > 0 ? currentFailures / currentTotal : 0;
		const previousFailureRate = previousTotal > 0 ? previousFailures / previousTotal : 0;

		const currentAvgRuntime = getValueByType('current', 'runtime_ms') ?? 0;
		const previousAvgRuntime = getValueByType('previous', 'runtime_ms') ?? 0;

		const currentTimeSaved = getValueByType('current', 'time_saved_min');
		const previousTimeSaved = getValueByType('previous', 'time_saved_min');

		// Return the formatted result
		const result = {
			averageRunTime: {
				value: currentAvgRuntime,
				unit: 'time',
				deviation: currentAvgRuntime - previousAvgRuntime,
			},
			failed: {
				value: currentFailures,
				unit: 'count',
				deviation: currentFailures - previousFailures,
			},
			failureRate: {
				value: currentFailureRate,
				unit: 'ratio',
				deviation: currentFailureRate - previousFailureRate,
			},
			timeSaved: {
				value: currentTimeSaved,
				unit: 'time',
				deviation: currentTimeSaved - previousTimeSaved,
			},
			total: {
				value: currentTotal,
				unit: 'count',
				deviation: currentTotal - previousTotal,
			},
		};
	}

	async compactInsights() {
		await this.compactRawToHour();
	}

	async compactRawToHour() {
		const batchSize = 500;

		const batchedRawInsightsQuery = this.insightsRawRepository
			.createQueryBuilder()
			.select(['id', 'metaId', 'type', 'value', 'timestamp'].map(getQuotedIdentifier))
			.orderBy('timestamp', 'ASC')
			.limit(batchSize);

		// Create temp table that only exists in this transaction for rows to
		// compact.
		const getBatchAndStoreInTemporaryTable = sql`
			CREATE TEMPORARY TABLE rows_to_compact AS
			${batchedRawInsightsQuery.getSql()};
		`;

		const countBatch = sql`
			SELECT COUNT(*) rowsInBatch FROM rows_to_compact;
		`;

		// Database-specific period start expression to truncate timestamp to the hour
		let periodStartExpr = "unixepoch(strftime('%Y-%m-%d %H:00:00', timestamp, 'unixepoch'))";
		switch (dbType) {
			case 'mysqldb':
			case 'mariadb':
				periodStartExpr = "DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00')";
				break;
			case 'postgresdb':
				periodStartExpr = "DATE_TRUNC('hour', timestamp)";
				break;
		}

		const insightByPeriodColumnNames = ['metaId', 'type', 'periodUnit', 'periodStart']
			.map(getQuotedIdentifier)
			.join(', ');
		const insightByPeriodColumnNamesWithValue = `${insightByPeriodColumnNames}, value`;

		const aggregateRawInsightsQuery = this.insightsByPeriodRepository.manager
			.createQueryBuilder()
			.select(getQuotedIdentifier('metaId'))
			.addSelect(getQuotedIdentifier('type'))
			.addSelect('0', 'periodUnit')
			.addSelect(periodStartExpr, 'periodStart')
			.addSelect(`SUM(${getQuotedIdentifier('value')})`, 'value')
			.from('rows_to_compact', 'rtc')
			.groupBy(getQuotedIdentifier('metaId'))
			.addGroupBy(getQuotedIdentifier('type'))
			.addGroupBy(periodStartExpr);

		// Insert or update aggregated data
		const insertQueryBase = sql`
			INSERT INTO ${this.insightsByPeriodRepository.metadata.tableName}
				(${insightByPeriodColumnNamesWithValue})
			${aggregateRawInsightsQuery.getSql()}
			`;

		// Database-specific upsert insights by period duplicate key handling
		let upsertEvents: string;
		if (dbType === 'mysqldb' || dbType === 'mariadb') {
			upsertEvents = sql`${insertQueryBase}
				ON DUPLICATE KEY UPDATE value = value + VALUES(value)`;
		} else {
			upsertEvents = sql`${insertQueryBase}
				ON CONFLICT(${insightByPeriodColumnNames})
				DO UPDATE SET value = ${this.insightsByPeriodRepository.metadata.tableName}.value + excluded.value
				RETURNING *`;
		}

		// Delete the processed rows
		const deleteBatch = sql`
			DELETE FROM ${this.insightsRawRepository.metadata.tableName}
			WHERE id IN (SELECT id FROM rows_to_compact);
		`;

		// Clean up
		const dropTemporaryTable = sql`
			DROP TABLE rows_to_compact;
		`;

		// invariant checks
		const valuesSumOfBatch = sql`
			SELECT COALESCE(SUM(value), 0) as sum FROM rows_to_compact
		`;
		const valuesSumOfCompacted = sql`
			SELECT COALESCE(SUM(value), 0) as sum FROM ${this.insightsByPeriodRepository.metadata.tableName}
		`;

		const result = await this.insightsByPeriodRepository.manager.transaction(async (trx) => {
			await trx.query(getBatchAndStoreInTemporaryTable);

			const compactedEvents =
				await trx.query<Array<{ type: InsightsByPeriod['type_']; value: number }>>(upsertEvents);

			// TODO: invariant check is cumbersome and unclear if it adds any value
			//
			//// invariant check
			//const compactedSumBefore = (await trx.query<[{ sum: number }]>(valuesSumOfCompacted))[0].sum;
			//const accumulatedValues = compactedEvents
			//	.map((event) => InsightsByPeriod.fromRaw(event))
			//	.reduce(
			//		(acc, event) => {
			//			acc[event.type] += event.value;
			//			return acc;
			//		},
			//		{ time_saved_min: 0, runtime_ms: 0, success: 0, failure: 0 } as Record<
			//			InsightsByPeriod['type'],
			//			number
			//		>,
			//	);
			//const batchSum = (await trx.query<[{ sum: number }]>(valuesSumOfBatch))[0].sum;
			//const compactedSumAfter = (await trx.query<[{ sum: number }]>(valuesSumOfCompacted))[0].sum;
			//a.equal(compactedSumAfter, batchSum + compactedSumBefore);

			const rowsInBatch =
				await trx.query<[{ rowsInBatch?: number | string; rowsinbatch?: number | string }]>(
					countBatch,
				);

			await trx.query(deleteBatch);
			await trx.query(dropTemporaryTable);

			return Number(rowsInBatch[0].rowsInBatch ?? rowsInBatch[0].rowsinbatch);
		});

		return result;
	}

	async compactHourToDay() {
		const batchSize = 500;

		// Create temp table that only exists in this transaction for rows to
		// compact.
		const batchedInsightsByPeriodQuery = this.insightsByPeriodRepository
			.createQueryBuilder()
			.select(
				['id', 'metaId', 'type', 'periodUnit', 'periodStart', 'value'].map(getQuotedIdentifier),
			)
			.where(`${getQuotedIdentifier('periodUnit')} = 0`)
			.orderBy(getQuotedIdentifier('periodStart'), 'ASC')
			.limit(batchSize);

		// Create temp table that only exists in this transaction for rows to
		// compact.
		const getBatchAndStoreInTemporaryTable = sql`
				CREATE TEMPORARY TABLE rows_to_compact AS
				${batchedInsightsByPeriodQuery.getSql()};
			`;

		const countBatch = sql`
			SELECT COUNT(*) rowsInBatch FROM rows_to_compact;
		`;

		let periodStartExpr = "strftime('%s', periodStart, 'unixepoch', 'start of day')";
		switch (dbType) {
			case 'mysqldb':
			case 'mariadb':
				periodStartExpr = "DATE_FORMAT(periodStart, '%Y-%m-%d 00:00:00')";
				break;
			case 'postgresdb':
				periodStartExpr = 'DATE_TRUNC(\'day\', "periodStart")';
				break;
		}

		const insightByPeriodColumnNames = ['metaId', 'type', 'periodUnit', 'periodStart']
			.map(getQuotedIdentifier)
			.join(', ');
		const insightByPeriodColumnNamesWithValue = `${insightByPeriodColumnNames}, value`;

		const aggregateRawInsightsQuery = this.insightsByPeriodRepository.manager
			.createQueryBuilder()
			.select([getQuotedIdentifier('metaId'), getQuotedIdentifier('type')])
			.addSelect('1', 'periodUnit')
			.addSelect(periodStartExpr, 'periodStart')
			.addSelect(`SUM(${getQuotedIdentifier('value')})`, 'value')
			.from('rows_to_compact', 'rtc')
			.groupBy(getQuotedIdentifier('metaId'))
			.addGroupBy(getQuotedIdentifier('type'))
			.addGroupBy(getQuotedIdentifier('periodStart'));

		// Insert or update aggregated data
		const insertQueryBase = sql`
				INSERT INTO ${this.insightsByPeriodRepository.metadata.tableName} (${insightByPeriodColumnNamesWithValue})
				${aggregateRawInsightsQuery.getSql()}
			`;

		// Database-specific upsert part
		let upsertEvents: string;
		if (dbType === 'mysqldb' || dbType === 'mariadb') {
			upsertEvents = sql`${insertQueryBase}
				ON DUPLICATE KEY UPDATE value = value + VALUES(value)`;
		} else {
			upsertEvents = sql`${insertQueryBase}
				ON CONFLICT(${insightByPeriodColumnNames})
				DO UPDATE SET value = ${this.insightsByPeriodRepository.metadata.tableName}.value + excluded.value
				RETURNING *`;
		}

		console.log(upsertEvents);

		// Delete the processed rows
		const deleteBatch = sql`
					DELETE FROM ${this.insightsByPeriodRepository.metadata.tableName}
					WHERE id IN (SELECT id FROM rows_to_compact);
			`;

		// Clean up
		const dropTemporaryTable = sql`
			DROP TABLE rows_to_compact;
		`;

		const result = await this.insightsByPeriodRepository.manager.transaction(async (trx) => {
			console.log(getBatchAndStoreInTemporaryTable);
			console.log(await trx.query(getBatchAndStoreInTemporaryTable));

			await trx.query<Array<{ type: InsightsByPeriod['type_']; value: number }>>(upsertEvents);

			const rowsInBatch = await trx.query<[{ rowsInBatch: number }]>(countBatch);

			await trx.query(deleteBatch);
			await trx.query(dropTemporaryTable);

			return rowsInBatch[0].rowsInBatch;
		});

		console.log('result', result);
		return result;
	}
}
