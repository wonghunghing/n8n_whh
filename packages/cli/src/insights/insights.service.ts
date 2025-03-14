import { GlobalConfig } from '@n8n/config';
import { Container, Service } from '@n8n/di';
import type { ExecutionLifecycleHooks } from 'n8n-core';
import type { ExecutionStatus, IRun, WorkflowExecuteMode } from 'n8n-workflow';
import { UnexpectedError } from 'n8n-workflow';
import { z } from 'zod';

import { InsightsMetadata } from '@/databases/entities/insights-metadata';
import { InsightsRaw } from '@/databases/entities/insights-raw';
import type { PeriodUnits, TypeUnits } from '@/databases/entities/insights-shared';
import { NumberToType, PeriodUnitToNumber } from '@/databases/entities/insights-shared';
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

@Service()
export class InsightsService {
	private readonly rawToHourBatchSize = 500;

	private readonly hourToDayBatchSize = 500;

	// TODO: make this configurable and default to 1 hour
	private readonly compactInsightsInterval = 1000 * 60;

	constructor(
		private readonly sharedWorkflowRepository: SharedWorkflowRepository,
		private readonly insightsByPeriodRepository: InsightsByPeriodRepository,
		private readonly globalConfig: GlobalConfig,
		private readonly insightsRawRepository: InsightsRawRepository,
	) {
		// TODO: check if there is a better way to schedule this
		setInterval(async () => await this.compactInsights(), this.compactInsightsInterval);
	}

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
					strftime('%s', datetime('now', '-7 days')) AS current_start,
					strftime('%s', datetime('now')) AS current_end,
					strftime('%s', datetime('now', '-14 days')) AS previous_start
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

		return result;
	}

	async compactInsights() {
		let numberOfCompactedData: number;

		do {
			numberOfCompactedData = await this.compactRawToHour();
		} while (numberOfCompactedData > 0);

		// TODO: compact hour to day as well
	}

	private escapeField(fieldName: string) {
		return this.insightsByPeriodRepository.manager.connection.driver.escape(fieldName);
	}

	// Compacts raw data to hourly aggregates
	async compactRawToHour() {
		// Build the query to gather raw insights data for the batch
		const batchQuery = this.insightsRawRepository
			.createQueryBuilder()
			.select(['id', 'metaId', 'type', 'value'].map((fieldName) => this.escapeField(fieldName)))
			.addSelect('timestamp', 'periodStart')
			.orderBy('timestamp', 'ASC')
			.limit(this.rawToHourBatchSize);

		return await this.compactSourceDataIntoInsightPeriod({
			sourceBatchQuery: batchQuery.getSql(),
			sourceTableName: this.insightsRawRepository.metadata.tableName,
			periodUnit: 'hour',
		});
	}

	// Compacts hourly data to daily aggregates
	async compactHourToDay() {
		// Build the query to gather period insights data for the batch
		const batchQuery = this.insightsByPeriodRepository
			.createQueryBuilder()
			.select(
				['id', 'metaId', 'type', 'periodStart', 'value'].map((fieldName) =>
					this.escapeField(fieldName),
				),
			)
			.where(`${this.escapeField('periodUnit')} = 0`)
			.orderBy(this.escapeField('periodStart'), 'ASC')
			.limit(this.hourToDayBatchSize);

		// TODO : add a date filter to compact only the data that is older than a certain date

		return await this.compactSourceDataIntoInsightPeriod({
			sourceBatchQuery: batchQuery.getSql(),
			periodUnit: 'day',
		});
	}

	private getPeriodStartExpr(periodUnit: PeriodUnits) {
		// Database-specific period start expression to truncate timestamp to the periodUnit
		// SQLite by default
		let periodStartExpr = `unixepoch(strftime('%Y-%m-%d ${periodUnit === 'hour' ? '%H' : '00'}:00:00', periodStart, 'unixepoch'))`;
		if (dbType === 'mysqldb' || dbType === 'mariadb') {
			periodStartExpr =
				periodUnit === 'hour'
					? "DATE_FORMAT(periodStart, '%Y-%m-%d %H:00:00')"
					: "DATE_FORMAT(periodStart, '%Y-%m-%d 00:00:00')";
		} else if (dbType === 'postgresdb') {
			periodStartExpr = `DATE_TRUNC('${periodUnit}', ${this.escapeField('periodStart')})`;
		}

		return periodStartExpr;
	}

	async compactSourceDataIntoInsightPeriod({
		sourceBatchQuery, // Query to get batch source data. Must return those fields: 'id', 'metaId', 'type', 'periodStart', 'value'
		sourceTableName = this.insightsByPeriodRepository.metadata.tableName, // Repository references for table operations
		periodUnit,
	}: {
		sourceBatchQuery: string;
		sourceTableName?: string;
		periodUnit: PeriodUnits;
	}): Promise<number> {
		// Create temp table that only exists in this transaction for rows to compact
		const getBatchAndStoreInTemporaryTable = sql`
			CREATE TEMPORARY TABLE rows_to_compact AS
			${sourceBatchQuery};
		`;

		const countBatch = sql`
			SELECT COUNT(*) ${this.escapeField('rowsInBatch')} FROM rows_to_compact;
		`;

		const targetColumnNamesStr = ['metaId', 'type', 'periodUnit', 'periodStart']
			.map((param) => this.escapeField(param))
			.join(', ');
		const targetColumnNamesWithValue = `${targetColumnNamesStr}, value`;

		// Get the start period expression depending on the period unit and database type
		const periodStartExpr = this.getPeriodStartExpr(periodUnit);

		// Function to get the aggregation query
		const aggregationQuery = this.insightsByPeriodRepository.manager
			.createQueryBuilder()
			.select(this.escapeField('metaId'))
			.addSelect(this.escapeField('type'))
			.addSelect(PeriodUnitToNumber[periodUnit].toString(), 'periodUnit')
			.addSelect(periodStartExpr, 'periodStart')
			.addSelect(`SUM(${this.escapeField('value')})`, 'value')
			.from('rows_to_compact', 'rtc')
			.groupBy(this.escapeField('metaId'))
			.addGroupBy(this.escapeField('type'))
			.addGroupBy(periodStartExpr);

		// Insert or update aggregated data
		const insertQueryBase = sql`
			INSERT INTO ${this.insightsByPeriodRepository.metadata.tableName}
				(${targetColumnNamesWithValue})
			${aggregationQuery.getSql()}
		`;

		// Database-specific duplicate key logic
		let deduplicateQuery: string;
		if (dbType === 'mysqldb' || dbType === 'mariadb') {
			deduplicateQuery = sql`
				ON DUPLICATE KEY UPDATE value = value + VALUES(value)`;
		} else {
			deduplicateQuery = sql`
				ON CONFLICT(${targetColumnNamesStr})
				DO UPDATE SET value = ${this.insightsByPeriodRepository.metadata.tableName}.value + excluded.value
				RETURNING *`;
		}

		const upsertEvents = sql`
			${insertQueryBase}
			${deduplicateQuery}
		`;

		// Delete the processed rows
		const deleteBatch = sql`
			DELETE FROM ${sourceTableName}
			WHERE id IN (SELECT id FROM rows_to_compact);
		`;

		// Clean up
		const dropTemporaryTable = sql`
			DROP TABLE rows_to_compact;
		`;

		const result = await this.insightsByPeriodRepository.manager.transaction(async (trx) => {
			await trx.query(getBatchAndStoreInTemporaryTable);

			await trx.query<Array<{ type: any; value: number }>>(upsertEvents);

			const rowsInBatch = await trx.query<[{ rowsInBatch: number | string }]>(countBatch);

			await trx.query(deleteBatch);
			await trx.query(dropTemporaryTable);

			return Number(rowsInBatch[0].rowsInBatch);
		});

		return result;
	}
}
