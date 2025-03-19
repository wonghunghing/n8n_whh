import { GlobalConfig } from '@n8n/config';
import { Container } from '@n8n/di';
import type { DateTime } from 'luxon';
import type { IWorkflowBase } from 'n8n-workflow';

import type { WorkflowEntity } from '@/databases/entities/workflow-entity';
import { SharedWorkflowRepository } from '@/databases/repositories/shared-workflow.repository';

import { InsightsMetadata } from '../../entities/insights-metadata';
import { InsightsRaw } from '../../entities/insights-raw';
import { InsightsMetadataRepository } from '../../repositories/insights-metadata.repository';
import { InsightsRawRepository } from '../../repositories/insights-raw.repository';

async function getWorkflowSharing(workflow: IWorkflowBase) {
	return await Container.get(SharedWorkflowRepository).find({
		where: { workflowId: workflow.id },
		relations: { project: true },
	});
}

export const { type: dbType } = Container.get(GlobalConfig).database;

export async function createMetadata(workflow: WorkflowEntity) {
	const insightsMetadataRepository = Container.get(InsightsMetadataRepository);
	const alreadyExisting = await insightsMetadataRepository.findOneBy({ workflowId: workflow.id });

	if (alreadyExisting) {
		return alreadyExisting;
	}

	const metadata = new InsightsMetadata();
	metadata.workflowName = workflow.name;
	metadata.workflowId = workflow.id;

	const workflowSharing = (await getWorkflowSharing(workflow)).find(
		(wfs) => wfs.role === 'workflow:owner',
	);
	if (workflowSharing) {
		metadata.projectName = workflowSharing.project.name;
		metadata.projectId = workflowSharing.project.id;
	}

	await insightsMetadataRepository.save(metadata);

	return metadata;
}

export async function createRawInsightsEvent(
	workflow: WorkflowEntity,
	parameters: {
		type: InsightsRaw['type'];
		value: number;
		timestamp?: DateTime;
	},
) {
	const insightsRawRepository = Container.get(InsightsRawRepository);
	const metadata = await createMetadata(workflow);

	const event = new InsightsRaw();
	event.metaId = metadata.metaId;
	event.type = parameters.type;
	event.value = parameters.value;
	if (parameters.timestamp) {
		if (dbType === 'sqlite') {
			event.timestamp = parameters.timestamp.toUTC().toSeconds() as any;
		} else {
			event.timestamp = parameters.timestamp.toUTC().toJSDate();
		}
	}
	return await insightsRawRepository.save(event);
}
<<<<<<< HEAD:packages/cli/src/modules/insights/entities/__tests__/db-utils.ts
=======

export async function createCompactedInsightsEvent(
	workflow: WorkflowEntity,
	parameters: {
		type: InsightsByPeriod['type'];
		value: number;
		periodUnit: InsightsByPeriod['periodUnit'];
		periodStart: DateTime;
	},
) {
	const insightsByPeriodRepository = Container.get(InsightsByPeriodRepository);
	const metadata = await createMetadata(workflow);

	const event = new InsightsByPeriod();
	event.metaId = metadata.metaId;
	event.type = parameters.type;
	event.value = parameters.value;
	event.periodUnit = parameters.periodUnit;
	if (dbType === 'sqlite') {
		event.periodStart = parameters.periodStart
			.toUTC()
			.startOf(parameters.periodUnit)
			.toSeconds() as any;
	} else {
		event.periodStart = parameters.periodStart.toUTC().startOf(parameters.periodUnit).toJSDate();
	}

	return await insightsByPeriodRepository.save(event);
}
>>>>>>> 27b0e77665 (works):packages/cli/test/integration/shared/db/insights.ts
