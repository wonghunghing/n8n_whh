import { Service } from '@n8n/di';
import { InstanceSettings, Logger } from 'n8n-core';
import { UnexpectedError, type IWorkflowExecutionDataProcess } from 'n8n-workflow';

import { ActiveExecutions } from '@/active-executions';
import { ExecutionRepository } from '@/databases/repositories/execution.repository';
import { OrchestrationService } from '@/services/orchestration.service';
import { OwnershipService } from '@/services/ownership.service';
import { getDataLastExecutedNodeData } from '@/workflow-helpers';
import { WorkflowRunner } from '@/workflow-runner';

@Service()
export class WaitTracker {
	private waitingExecutions: {
		[key: string]: {
			executionId: string;
			timer: NodeJS.Timeout;
		};
	} = {};

	mainTimer: NodeJS.Timeout;

	constructor(
		private readonly logger: Logger,
		private readonly executionRepository: ExecutionRepository,
		private readonly ownershipService: OwnershipService,
		private readonly activeExecutions: ActiveExecutions,
		private readonly workflowRunner: WorkflowRunner,
		private readonly orchestrationService: OrchestrationService,
		private readonly instanceSettings: InstanceSettings,
	) {
		this.logger = this.logger.scoped('waiting-executions');
	}

	has(executionId: string) {
		return this.waitingExecutions[executionId] !== undefined;
	}

	/**
	 * @important Requires `OrchestrationService` to be initialized.
	 */
	init() {
		const { isLeader, isMultiMain } = this.instanceSettings;

		if (isLeader) this.startTracking();

		if (isMultiMain) {
			this.orchestrationService.multiMainSetup
				.on('leader-takeover', () => this.startTracking())
				.on('leader-stepdown', () => this.stopTracking());
		}
	}

	private startTracking() {
		this.logger.debug('Started tracking waiting executions');

		// Poll every 60 seconds a list of upcoming executions
		this.mainTimer = setInterval(() => {
			void this.getWaitingExecutions();
		}, 60000);

		void this.getWaitingExecutions();
	}

	async getWaitingExecutions() {
		this.logger.debug('Querying database for waiting executions');

		const executions = await this.executionRepository.getWaitingExecutions();

		if (executions.length === 0) {
			return;
		}

		const executionIds = executions.map((execution) => execution.id).join(', ');
		this.logger.debug(
			`Found ${executions.length} executions. Setting timer for IDs: ${executionIds}`,
		);

		// Add timers for each waiting execution that they get started at the correct time

		for (const execution of executions) {
			const executionId = execution.id;
			if (this.waitingExecutions[executionId] === undefined) {
				const triggerTime = execution.waitTill!.getTime() - new Date().getTime();
				this.waitingExecutions[executionId] = {
					executionId,
					timer: setTimeout(() => {
						void this.startExecution(executionId);
					}, triggerTime),
				};
			}
		}
	}

	stopExecution(executionId: string) {
		if (!this.waitingExecutions[executionId]) return;

		clearTimeout(this.waitingExecutions[executionId].timer);

		delete this.waitingExecutions[executionId];
	}

	async startExecution(executionId: string) {
		this.logger.debug(`Resuming execution ${executionId}`, { executionId });
		delete this.waitingExecutions[executionId];

		// Get the data to execute
		const fullExecutionData = await this.executionRepository.findSingleExecution(executionId, {
			includeData: true,
			unflattenData: true,
		});

		if (!fullExecutionData) {
			throw new UnexpectedError('Execution does not exist.', { extra: { executionId } });
		}
		if (fullExecutionData.finished) {
			throw new UnexpectedError('The execution did succeed and can so not be started again.');
		}

		if (!fullExecutionData.workflowData.id) {
			throw new UnexpectedError('Only saved workflows can be resumed.');
		}

		const workflowId = fullExecutionData.workflowData.id;
		const project = await this.ownershipService.getWorkflowProjectCached(workflowId);

		const data: IWorkflowExecutionDataProcess = {
			executionMode: fullExecutionData.mode,
			executionData: fullExecutionData.data,
			workflowData: fullExecutionData.workflowData,
			projectId: project.id,
			pushRef: fullExecutionData.data.pushRef,
		};

		// Start the execution again
		await this.workflowRunner.run(data, false, false, executionId);

		const { parentExecution } = fullExecutionData.data;
		if (parentExecution) {
			// on child execution completion, resume parent execution
			void this.activeExecutions
				.getPostExecutePromise(executionId)
				.then(async (subworkflowResults) => {
					if (!subworkflowResults) return;

					const lastExecutedNodeData = getDataLastExecutedNodeData(subworkflowResults);
					if (!lastExecutedNodeData?.data) return;

					try {
						const parent = await this.executionRepository.findSingleExecution(
							parentExecution.executionId,
							{
								includeData: true,
								unflattenData: true,
							},
						);

						if (!parent || parent.status !== 'waiting') return;

						const parentWithSubWorkflowResults = {
							data: { ...parent.data },
						};

						if (
							!parentWithSubWorkflowResults.data.executionData?.nodeExecutionStack ||
							parentWithSubWorkflowResults.data.executionData.nodeExecutionStack.length === 0
						) {
							return;
						}

						// Copy the sub workflow result to the parent execution's Execute Workflow node inputs
						// so that the Execute Workflow node returns the correct data when parent execution is resumed
						// and the Execute Workflow node is executed again in disabled mode.
						parentWithSubWorkflowResults.data.executionData.nodeExecutionStack[0].data =
							lastExecutedNodeData.data;

						await this.executionRepository.updateExistingExecution(
							parentExecution.executionId,
							parentWithSubWorkflowResults,
						);
					} catch (error: unknown) {
						this.logger.error('Could not copy sub workflow result to waiting parent execution', {
							executionId,
							parentExecutionId: parentExecution.executionId,
							workflowId,
							error,
						});
					}
				})
				.then(() => {
					void this.startExecution(parentExecution.executionId);
				});
		}
	}

	stopTracking() {
		this.logger.debug('Shutting down wait tracking');

		clearInterval(this.mainTimer);
		Object.keys(this.waitingExecutions).forEach((executionId) => {
			clearTimeout(this.waitingExecutions[executionId].timer);
		});
	}
}
