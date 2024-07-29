import { Service } from 'typedi';
import type { INode, IRun, IWorkflowBase } from 'n8n-workflow';
import { StatisticsNames } from '@db/entities/WorkflowStatistics';
import { WorkflowStatisticsRepository } from '@db/repositories/workflowStatistics.repository';
import { UserService } from '@/services/user.service';
import { Logger } from '@/Logger';
import { OwnershipService } from './ownership.service';
import { TypedEmitter } from '@/TypedEmitter';

interface Events {
	nodeFetchedData: { workflowId: string; node: INode };
	workflowExecutionCompleted: { workflowData: IWorkflowBase; fullRunData: IRun };
	'telemetry.onFirstProductionWorkflowSuccess': {
		project_id: string;
		workflow_id: string;
		user_id: string;
	};
	'telemetry.onFirstWorkflowDataLoad': {
		user_id: string;
		project_id: string;
		workflow_id: string;
		node_type: string;
		node_id: string;
	};
}

@Service()
export class WorkflowStatisticsService extends TypedEmitter<Events> {
	constructor(
		private readonly logger: Logger,
		private readonly repository: WorkflowStatisticsRepository,
		private readonly ownershipService: OwnershipService,
		private readonly userService: UserService,
	) {
		super({ captureRejections: true });
		if ('SKIP_STATISTICS_EVENTS' in process.env) return;

		this.on(
			'nodeFetchedData',
			async ({ workflowId, node }) => await this.nodeFetchedData(workflowId, node),
		);
		this.on(
			'workflowExecutionCompleted',
			async ({ workflowData, fullRunData }) =>
				await this.workflowExecutionCompleted(workflowData, fullRunData),
		);
	}

	async workflowExecutionCompleted(workflowData: IWorkflowBase, runData: IRun): Promise<void> {
		// Determine the name of the statistic
		const finished = runData.finished ? runData.finished : false;
		const manual = runData.mode === 'manual';
		let name: StatisticsNames;

		if (finished) {
			if (manual) name = StatisticsNames.manualSuccess;
			else name = StatisticsNames.productionSuccess;
		} else {
			if (manual) name = StatisticsNames.manualError;
			else name = StatisticsNames.productionError;
		}

		// Get the workflow id
		const workflowId = workflowData.id;
		if (!workflowId) return;

		try {
			const upsertResult = await this.repository.upsertWorkflowStatistics(name, workflowId);

			if (name === StatisticsNames.productionSuccess && upsertResult === 'insert') {
				const project = await this.ownershipService.getWorkflowProjectCached(workflowId);
				if (project.type === 'personal') {
					const owner = await this.ownershipService.getProjectOwnerCached(project.id);

					const metrics = {
						project_id: project.id,
						workflow_id: workflowId,
						user_id: owner!.id,
					};

					if (owner && !owner.settings?.userActivated) {
						await this.userService.updateSettings(owner.id, {
							firstSuccessfulWorkflowId: workflowId,
							userActivated: true,
							userActivatedAt: runData.startedAt.getTime(),
						});
					}

					// Send the metrics
					this.emit('telemetry.onFirstProductionWorkflowSuccess', metrics);
				}
			}
		} catch (error) {
			this.logger.verbose('Unable to fire first workflow success telemetry event');
		}
	}

	async nodeFetchedData(workflowId: string | undefined | null, node: INode): Promise<void> {
		if (!workflowId) return;

		const insertResult = await this.repository.insertWorkflowStatistics(
			StatisticsNames.dataLoaded,
			workflowId,
		);
		if (insertResult === 'failed' || insertResult === 'alreadyExists') return;

		// Compile the metrics since this was a new data loaded event
		const project = await this.ownershipService.getWorkflowProjectCached(workflowId);
		const owner = await this.ownershipService.getProjectOwnerCached(project.id);

		let metrics = {
			user_id: owner!.id,
			project_id: project.id,
			workflow_id: workflowId,
			node_type: node.type,
			node_id: node.id,
		};

		// This is probably naive but I can't see a way for a node to have multiple credentials attached so..
		if (node.credentials) {
			Object.entries(node.credentials).forEach(([credName, credDetails]) => {
				metrics = Object.assign(metrics, {
					credential_type: credName,
					credential_id: credDetails.id,
				});
			});
		}

		// Send metrics to posthog
		this.emit('telemetry.onFirstWorkflowDataLoad', metrics);
	}
}
