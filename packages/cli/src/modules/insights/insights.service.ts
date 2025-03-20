import type { InsightsSummary } from '@n8n/api-types';
import { GlobalConfig } from '@n8n/config';
import { Service } from '@n8n/di';
import type { ExecutionLifecycleHooks } from 'n8n-core';
import { UnexpectedError } from 'n8n-workflow';
import type { ExecutionStatus, IRun, WorkflowExecuteMode } from 'n8n-workflow';
import { z } from 'zod';

import { SharedWorkflow } from '@/databases/entities/shared-workflow';
import { SharedWorkflowRepository } from '@/databases/repositories/shared-workflow.repository';
import { InsightsMetadata } from '@/modules/insights/entities/insights-metadata';
import { InsightsRaw } from '@/modules/insights/entities/insights-raw';
import { sql } from '@/utils/sql';

import type { TypeUnits } from './entities/insights-shared';
import { NumberToType, TypeToNumber } from './entities/insights-shared';
import { InsightsByPeriodRepository } from './repositories/insights-by-period.repository';

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

const summaryParser = z
	.object({
		period: z.enum(['previous', 'current']),
		// TODO: extract to abstract-entity
		type: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),

		// depending on db engine, sum(value) can be a number or a string - because of big numbers
		total_value: z.union([z.number(), z.string()]),
	})
	.array();

const aggregatedInsightsByWorkflowParser = z
	.object({
		workflowId: z.string(),
		workflowName: z.string().optional(),
		projectId: z.string().optional(),
		projectName: z.string().optional(),
		total: z.union([z.number(), z.string()]),
		succeeded: z.union([z.number(), z.string()]),
		failed: z.union([z.number(), z.string()]),
		failureRate: z.union([z.number(), z.string()]),
		runTime: z.union([z.number(), z.string()]),
		averageRunTime: z.union([z.number(), z.string()]),
		timeSaved: z.union([z.number(), z.string()]),
	})
	.array();

const aggregatedInsightsByTimeParser = z
	.object({
		type: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
		periodStart: z.string(),
		runTime: z.union([z.number(), z.string()]),
		succeeded: z.union([z.number(), z.string()]),
		failed: z.union([z.number(), z.string()]),
		timeSaved: z.union([z.number(), z.string()]),
	})
	.array();

@Service()
export class InsightsService {
	constructor(
		private readonly sharedWorkflowRepository: SharedWorkflowRepository,
		private readonly insightsByPeriodRepository: InsightsByPeriodRepository,
		private readonly globalConfig: GlobalConfig,
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

			// time saved event
			if (status === 'success' && ctx.workflowData.settings?.timeSavedPerExecution) {
				const event = new InsightsRaw();
				event.metaId = metadata.metaId;
				event.type = 'time_saved_min';
				event.value = ctx.workflowData.settings.timeSavedPerExecution;
				await trx.insert(InsightsRaw, event);
			}
		});
	}

	// TODO: add return type once rebased on master and InsightsSummary is
	// available
	async getInsightsSummary(): Promise<InsightsSummary> {
		const dbType = this.globalConfig.database.type;
		const cte =
			dbType === 'sqlite'
				? sql`
				SELECT
					datetime('now', '-7 days') AS current_start,
					datetime('now') AS current_end,
					datetime('now', '-14 days') AS previous_start
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
			.addSelect('SUM(value)', 'total_value')
			// Use a cross join with the CTE
			.innerJoin('date_ranges', 'date_ranges', '1=1')
			// Filter to only include data from the last 14 days
			.where('insights.periodStart >= date_ranges.previous_start')
			.andWhere('insights.periodStart <= date_ranges.current_end')
			// Group by both period and type
			.groupBy('period')
			.addGroupBy('insights.type')
			.getRawMany();

		const rows = summaryParser.parse(rawRows);

		// Initialize data structures for both periods
		const data = {
			current: { byType: {} as Record<TypeUnits, number> },
			previous: { byType: {} as Record<TypeUnits, number> },
		};

		// Organize data by period and type
		rows.forEach((row) => {
			const { period, type, total_value } = row;
			if (!data[period]) return;

			data[period].byType[NumberToType[type]] = total_value ? Number(total_value) : 0;
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

		const currentFailureRate =
			currentTotal > 0 ? Math.round((currentFailures / currentTotal) * 100) / 100 : 0;
		const previousFailureRate =
			previousTotal > 0 ? Math.round((previousFailures / previousTotal) * 100) / 100 : 0;

		const currentTotalRuntime = getValueByType('current', 'runtime_ms') ?? 0;
		const previousTotalRuntime = getValueByType('previous', 'runtime_ms') ?? 0;

		const currentAvgRuntime =
			currentTotal > 0 ? Math.round((currentTotalRuntime / currentTotal) * 100) / 100 : 0;
		const previousAvgRuntime =
			previousTotal > 0 ? Math.round((previousTotalRuntime / previousTotal) * 100) / 100 : 0;

		const currentTimeSaved = getValueByType('current', 'time_saved_min');
		const previousTimeSaved = getValueByType('previous', 'time_saved_min');

		// Return the formatted result
		const result: InsightsSummary = {
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

	// TODO: add return type once rebased on master and InsightsByWorkflow is
	// available
	async getInsightsByWorkflow({
		nbDays,
		skip = 0,
		take = 10,
		sortBy = 'total:desc',
	}: {
		nbDays: number;
		skip?: number;
		take?: number;
		sortBy?: string;
	}): Promise<{ count: number; data: any[] }> {
		const { count, rows } = await this.insightsByPeriodRepository.getInsightsByWorkflow({
			dbType: this.globalConfig.database.type,
			nbDays,
			skip,
			take,
			sortBy,
		});

		const data = aggregatedInsightsByWorkflowParser.parse(rows).map((r) => {
			return {
				workflowId: r.workflowId,
				workflowName: r.workflowName,
				projectId: r.projectId,
				projectName: r.projectName,
				total: Number(r.total),
				failed: Number(r.failed),
				succeeded: Number(r.succeeded),
				failureRate: Number(r.failureRate),
				runTime: Number(r.runTime),
				averageRunTime: Number(r.averageRunTime),
				timeSaved: Number(r.timeSaved),
			};
		});

		return {
			count,
			data,
		};
	}

	// TODO: add return type once rebased on master and InsightsByTimeAndType is
	// available
	// TODO: add tests
	async getInsightsByTime(nbDays: number, types: TypeUnits[]): Promise<any> {
		const dbType = this.globalConfig.database.type;
		const dateSubQuery =
			dbType === 'sqlite'
				? `datetime('now', '-${nbDays} days')`
				: dbType === 'postgresdb'
					? `CURRENT_DATE - INTERVAL '${nbDays} days'`
					: `DATE_SUB(CURDATE(), INTERVAL ${nbDays} DAY)`;

		const rawRows = await this.insightsByPeriodRepository
			.createQueryBuilder('insights')
			.select([
				'insights.type',
				'insights.periodStart AS "periodStart"',
				`SUM(CASE WHEN insights.type = ${TypeToNumber.runtime_ms} THEN value ELSE 0 END) AS "runTime"`,
				`SUM(CASE WHEN insights.type = ${TypeToNumber.success} THEN value ELSE 0 END) AS "succeeded"`,
				`SUM(CASE WHEN insights.type = ${TypeToNumber.failure} THEN value ELSE 0 END) AS "failed"`,
				`SUM(CASE WHEN insights.type = ${TypeToNumber.time_saved_min} THEN value ELSE 0 END) AS "timeSaved"`,
			])
			.where(`insights.periodStart >= ${dateSubQuery}`)
			.andWhere('insights.type IN (:...types)', { types: types.map((t) => TypeToNumber[t]) })
			.addGroupBy('insights.periodStart') // TODO: group by specific time scale (start with day)
			.orderBy('insights.periodStart', 'ASC')
			.getRawMany();

		const rows = aggregatedInsightsByTimeParser.parse(rawRows);

		return rows.map((r) => {
			return {
				date: r.periodStart,
				values: {
					total: Number(r.succeeded) + Number(r.failed),
					succeeded: Number(r.succeeded),
					failed: Number(r.failed),
					failureRate: Number(r.failed) / (Number(r.succeeded) + Number(r.failed)),
					averageRunTime: Number(r.runTime) / (Number(r.succeeded) + Number(r.failed)),
					timeSaved: Number(r.timeSaved),
				},
			};
		});
	}
}
