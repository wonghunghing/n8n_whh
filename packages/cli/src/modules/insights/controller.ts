// TODO: use type once rebased on master
//import type { InsightsSummary } from '@n8n/api-types';

import type { InsightsSummary } from '@n8n/api-types';

import { Get, RestController } from '@/decorators';
import { paginationListQueryMiddleware } from '@/middlewares/list-query/pagination';
import { sortByQueryMiddleware } from '@/middlewares/list-query/sort-by';
import { ListQuery } from '@/requests';

import { InsightsService } from './insights.service';

@RestController('/insights')
export class InsightsController {
	constructor(private readonly insightsService: InsightsService) {}

	// TODO: api test for this
	@Get('/summary')
	async getInsightsSummary(): Promise<InsightsSummary> {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return await this.insightsService.getInsightsSummary();
	}

	// TODO: api test for this
	// TODO: use proper response type once defined
	@Get('/by-workflow', { middlewares: [paginationListQueryMiddleware, sortByQueryMiddleware] })
	async getInsightsByWorkflow(req: ListQuery.Options): Promise<{
		count: number;
		data: any[];
	}> {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return await this.insightsService.getInsightsByWorkflow({
			nbDays: 14, // TODO: extract into proper constant
			skip: req.skip,
			take: req.take,
			sortBy: req.sortBy,
		});
	}
}
