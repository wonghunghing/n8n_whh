import { Service } from '@n8n/di';
import { DataSource, Repository } from '@n8n/typeorm';

import { sql } from '@/utils/sql';

import { InsightsByPeriod } from '../entities/insights-by-period';
import { TypeToNumber } from '../entities/insights-shared';

@Service()
export class InsightsByPeriodRepository extends Repository<InsightsByPeriod> {
	constructor(dataSource: DataSource) {
		super(InsightsByPeriod, dataSource.manager);
	}

	private parseSortingParams(sortBy: string): [string, 'ASC' | 'DESC'] {
		const [column, order] = sortBy.split(':');
		return [column, order.toUpperCase() as 'ASC' | 'DESC'];
	}

	async getInsightsByWorkflow({
		nbDays,
		dbType = 'sqlite',
		skip = 0,
		take = 20,
		sortBy = 'total:desc',
	}: {
		nbDays: number;
		dbType?: string;
		skip?: number;
		take?: number;
		sortBy?: string;
	}) {
		const dateSubQuery =
			dbType === 'sqlite'
				? `datetime('now', '-${nbDays} days')`
				: dbType === 'postgresdb'
					? `CURRENT_DATE - INTERVAL '${nbDays} days'`
					: `DATE_SUB(CURDATE(), INTERVAL ${nbDays} DAY)`;

		const [sortField, sortOrder] = this.parseSortingParams(sortBy);
		const sumOfExecutions = sql`CAST(SUM(CASE WHEN insights.type IN (${TypeToNumber.success.toString()}, ${TypeToNumber.failure.toString()}) THEN value ELSE 0 END) as FLOAT)`;

		const rawRowsQuery = this.createQueryBuilder('insights')
			.select([
				'metadata.workflowId AS "workflowId"',
				'metadata.workflowName AS "workflowName"',
				'metadata.projectId AS "projectId"',
				'metadata.projectName AS "projectName"',
				`SUM(CASE WHEN insights.type = ${TypeToNumber.success} THEN value ELSE 0 END) AS "succeeded"`,
				`SUM(CASE WHEN insights.type = ${TypeToNumber.failure} THEN value ELSE 0 END) AS "failed"`,
				`SUM(CASE WHEN insights.type IN (${TypeToNumber.success}, ${TypeToNumber.failure}) THEN value ELSE 0 END) AS "total"`,
				sql`CASE
								WHEN ${sumOfExecutions} = 0 THEN 0
								ELSE SUM(CASE WHEN insights.type = ${TypeToNumber.failure.toString()} THEN value ELSE 0 END) / ${sumOfExecutions}
							END AS "failureRate"`,
				`SUM(CASE WHEN insights.type IN (${TypeToNumber.success}, ${TypeToNumber.failure}) THEN value ELSE 0 END) AS "total"`,
				`SUM(CASE WHEN insights.type = ${TypeToNumber.runtime_ms} THEN value ELSE 0 END) AS "runTime"`,
				`SUM(CASE WHEN insights.type = ${TypeToNumber.time_saved_min} THEN value ELSE 0 END) AS "timeSaved"`,
				sql`CASE
								WHEN ${sumOfExecutions} = 0	THEN 0
								ELSE SUM(CASE WHEN insights.type = ${TypeToNumber.runtime_ms.toString()} THEN value ELSE 0 END) / ${sumOfExecutions}
							END AS "averageRunTime"`,
			])
			.innerJoin('insights.metadata', 'metadata')
			.where(`insights.periodStart >= ${dateSubQuery}`)
			.groupBy('metadata.workflowId')
			.addGroupBy('metadata.workflowName')
			.addGroupBy('metadata.projectId')
			.addGroupBy('metadata.projectName')
			.orderBy(`"${sortField}"`, sortOrder);

		const count = (await rawRowsQuery.getRawMany()).length;
		const rawRows = await rawRowsQuery.skip(skip).take(take).getRawMany();

		return { count, rows: rawRows };
	}
}
