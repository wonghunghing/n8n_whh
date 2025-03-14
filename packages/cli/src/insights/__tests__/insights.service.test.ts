import { Container } from '@n8n/di';
import { mock } from 'jest-mock-extended';
import { DateTime } from 'luxon';
import type { ExecutionLifecycleHooks } from 'n8n-core';
import type { ExecutionStatus, IRun, WorkflowExecuteMode } from 'n8n-workflow';

import type { InsightsMetadata } from '@/databases/entities/insights-metadata';
import type { TypeUnits } from '@/databases/entities/insights-shared';
import type { Project } from '@/databases/entities/project';
import type { WorkflowEntity } from '@/databases/entities/workflow-entity';
import { InsightsByPeriodRepository } from '@/databases/repositories/insights-by-period.repository';
import { InsightsMetadataRepository } from '@/databases/repositories/insights-metadata.repository';
import { InsightsRawRepository } from '@/databases/repositories/insights-raw.repository';
import type { IWorkflowDb } from '@/interfaces';
import {
	createCompactedInsightsEvent,
	createMetadata,
	createRawInsightsEvent,
	createRawInsightsEvents,
} from '@test-integration/db/insights';
import { createTeamProject } from '@test-integration/db/projects';
import { createWorkflow } from '@test-integration/db/workflows';

import * as testDb from '../../../test/integration/shared/test-db';
import { InsightsService } from '../insights.service';

describe('workflowExecuteAfterHandler', () => {
	let insightsService: InsightsService;
	let insightsRawRepository: InsightsRawRepository;
	let insightsMetadataRepository: InsightsMetadataRepository;
	beforeAll(async () => {
		await testDb.init();

		insightsService = Container.get(InsightsService);
		insightsRawRepository = Container.get(InsightsRawRepository);
		insightsMetadataRepository = Container.get(InsightsMetadataRepository);
	});

	let project: Project;
	let workflow: IWorkflowDb & WorkflowEntity;

	beforeEach(async () => {
		await testDb.truncate(['InsightsRaw', 'InsightsMetadata', 'InsightsByPeriod']);

		project = await createTeamProject();
		workflow = await createWorkflow({}, project);
	});

	afterAll(async () => {
		await testDb.terminate();
	});

	test.each<{ status: ExecutionStatus; type: TypeUnits }>([
		{ status: 'success', type: 'success' },
		{ status: 'error', type: 'failure' },
		{ status: 'crashed', type: 'failure' },
	])('stores events for executions with the status `$status`', async ({ status, type }) => {
		// ARRANGE
		const ctx = mock<ExecutionLifecycleHooks>({ workflowData: workflow });
		const startedAt = DateTime.utc();
		const stoppedAt = startedAt.plus({ seconds: 5 });
		const run = mock<IRun>({
			mode: 'webhook',
			status,
			startedAt: startedAt.toJSDate(),
			stoppedAt: stoppedAt.toJSDate(),
		});

		// ACT
		await insightsService.workflowExecuteAfterHandler(ctx, run);

		// ASSERT
		const metadata = await insightsMetadataRepository.findOneBy({ workflowId: workflow.id });

		if (!metadata) {
			return fail('expected metadata to exist');
		}

		expect(metadata).toMatchObject({
			workflowId: workflow.id,
			workflowName: workflow.name,
			projectId: project.id,
			projectName: project.name,
		});

		const allInsights = await insightsRawRepository.find();
		expect(allInsights).toHaveLength(2);
		expect(allInsights).toContainEqual(
			expect.objectContaining({ metaId: metadata.metaId, type, value: 1 }),
		);
		expect(allInsights).toContainEqual(
			expect.objectContaining({
				metaId: metadata.metaId,
				type: 'runtime_ms',
				value: stoppedAt.diff(startedAt).toMillis(),
			}),
		);
	});

	test.each<{ status: ExecutionStatus }>([
		{ status: 'waiting' },
		{ status: 'canceled' },
		{ status: 'unknown' },
		{ status: 'new' },
		{ status: 'running' },
	])('does not store events for executions with the status `$status`', async ({ status }) => {
		// ARRANGE
		const ctx = mock<ExecutionLifecycleHooks>({ workflowData: workflow });
		const startedAt = DateTime.utc();
		const stoppedAt = startedAt.plus({ seconds: 5 });
		const run = mock<IRun>({
			mode: 'webhook',
			status,
			startedAt: startedAt.toJSDate(),
			stoppedAt: stoppedAt.toJSDate(),
		});

		// ACT
		await insightsService.workflowExecuteAfterHandler(ctx, run);

		// ASSERT
		const metadata = await insightsMetadataRepository.findOneBy({ workflowId: workflow.id });
		const allInsights = await insightsRawRepository.find();
		expect(metadata).toBeNull();
		expect(allInsights).toHaveLength(0);
	});

	test.each<{ mode: WorkflowExecuteMode }>([{ mode: 'internal' }, { mode: 'manual' }])(
		'does not store events for executions with the mode `$mode`',
		async ({ mode }) => {
			// ARRANGE
			const ctx = mock<ExecutionLifecycleHooks>({ workflowData: workflow });
			const startedAt = DateTime.utc();
			const stoppedAt = startedAt.plus({ seconds: 5 });
			const run = mock<IRun>({
				mode,
				status: 'success',
				startedAt: startedAt.toJSDate(),
				stoppedAt: stoppedAt.toJSDate(),
			});

			// ACT
			await insightsService.workflowExecuteAfterHandler(ctx, run);

			// ASSERT
			const metadata = await insightsMetadataRepository.findOneBy({ workflowId: workflow.id });
			const allInsights = await insightsRawRepository.find();
			expect(metadata).toBeNull();
			expect(allInsights).toHaveLength(0);
		},
	);

	test.each<{ mode: WorkflowExecuteMode }>([
		{ mode: 'evaluation' },
		{ mode: 'error' },
		{ mode: 'cli' },
		{ mode: 'retry' },
		{ mode: 'trigger' },
		{ mode: 'webhook' },
		{ mode: 'integrated' },
	])('stores events for executions with the mode `$mode`', async ({ mode }) => {
		// ARRANGE
		const ctx = mock<ExecutionLifecycleHooks>({ workflowData: workflow });
		const startedAt = DateTime.utc();
		const stoppedAt = startedAt.plus({ seconds: 5 });
		const run = mock<IRun>({
			mode,
			status: 'success',
			startedAt: startedAt.toJSDate(),
			stoppedAt: stoppedAt.toJSDate(),
		});

		// ACT
		await insightsService.workflowExecuteAfterHandler(ctx, run);

		// ASSERT
		const metadata = await insightsMetadataRepository.findOneBy({ workflowId: workflow.id });

		if (!metadata) {
			return fail('expected metadata to exist');
		}

		expect(metadata).toMatchObject({
			workflowId: workflow.id,
			workflowName: workflow.name,
			projectId: project.id,
			projectName: project.name,
		});

		const allInsights = await insightsRawRepository.find();
		expect(allInsights).toHaveLength(2);
		expect(allInsights).toContainEqual(
			expect.objectContaining({ metaId: metadata.metaId, type: 'success', value: 1 }),
		);
		expect(allInsights).toContainEqual(
			expect.objectContaining({
				metaId: metadata.metaId,
				type: 'runtime_ms',
				value: stoppedAt.diff(startedAt).toMillis(),
			}),
		);
	});

	test("throws UnexpectedError if the execution's workflow has no owner", async () => {
		// ARRANGE
		const workflow = await createWorkflow({});
		const ctx = mock<ExecutionLifecycleHooks>({ workflowData: workflow });
		const startedAt = DateTime.utc();
		const stoppedAt = startedAt.plus({ seconds: 5 });
		const run = mock<IRun>({
			mode: 'webhook',
			status: 'success',
			startedAt: startedAt.toJSDate(),
			stoppedAt: stoppedAt.toJSDate(),
		});

		// ACT & ASSERT
		await expect(insightsService.workflowExecuteAfterHandler(ctx, run)).rejects.toThrowError(
			`Could not find an owner for the workflow with the name '${workflow.name}' and the id '${workflow.id}'`,
		);
	});

	describe('compactRawToHour', () => {
		type TestData = {
			name: string;
			timestamps: DateTime[];
			batches: number[];
		};

		test.each<TestData>([
			{
				name: 'compact into 2 rows',
				timestamps: [
					DateTime.utc(2000, 1, 1, 0, 0),
					DateTime.utc(2000, 1, 1, 0, 59),
					DateTime.utc(2000, 1, 1, 1, 0),
				],
				batches: [2, 1],
			},
			{
				name: 'compact into 3 rows',
				timestamps: [
					DateTime.utc(2000, 1, 1, 0, 0),
					DateTime.utc(2000, 1, 1, 1, 0),
					DateTime.utc(2000, 1, 1, 2, 0),
				],
				batches: [1, 1, 1],
			},
		])('$name', async ({ timestamps, batches }) => {
			// ARRANGE
			const insightsService = Container.get(InsightsService);
			const insightsRawRepository = Container.get(InsightsRawRepository);
			const insightsByPeriodRepository = Container.get(InsightsByPeriodRepository);

			const project = await createTeamProject();
			const workflow = await createWorkflow({}, project);
			// create before so we can create the raw events in parallel
			await createMetadata(workflow);
			for (const timestamp of timestamps) {
				await createRawInsightsEvent(workflow, { type: 'success', value: 1, timestamp });
			}

			// ACT
			const compactedRows = await insightsService.compactRawToHour();

			// ASSERT
			expect(compactedRows).toBe(timestamps.length);
			await expect(insightsRawRepository.count()).resolves.toBe(0);
			const allCompacted = await insightsByPeriodRepository.find({ order: { periodStart: 1 } });
			expect(allCompacted).toHaveLength(batches.length);
			for (const [index, compacted] of allCompacted.entries()) {
				expect(compacted.value).toBe(batches[index]);
			}
		});

		test('batch compaction split events in hourly insight periods', async () => {
			// ARRANGE
			const insightsService = Container.get(InsightsService);
			const insightsRawRepository = Container.get(InsightsRawRepository);
			const insightsByPeriodRepository = Container.get(InsightsByPeriodRepository);

			const project = await createTeamProject();
			const workflow = await createWorkflow({}, project);

			const batchSize = 100;

			let timestamp = DateTime.utc(2000, 1, 1, 0, 0);
			for (let i = 0; i < batchSize; i++) {
				await createRawInsightsEvent(workflow, { type: 'success', value: 1, timestamp });
				// create 60 events per hour
				timestamp = timestamp.plus({ minute: 1 });
			}

			// ACT
			await insightsService.compactInsights();

			// ASSERT
			await expect(insightsRawRepository.count()).resolves.toBe(0);

			const allCompacted = await insightsByPeriodRepository.find({ order: { periodStart: 1 } });
			const accumulatedValues = allCompacted.reduce((acc, event) => acc + event.value, 0);
			expect(accumulatedValues).toBe(batchSize);
			expect(allCompacted[0].value).toBe(60);
			expect(allCompacted[1].value).toBe(40);
		});

		test('batch compaction split events in hourly insight periods by type and workflow', async () => {
			// ARRANGE
			const insightsService = Container.get(InsightsService);
			const insightsRawRepository = Container.get(InsightsRawRepository);
			const insightsByPeriodRepository = Container.get(InsightsByPeriodRepository);

			const project = await createTeamProject();
			const workflow1 = await createWorkflow({}, project);
			const workflow2 = await createWorkflow({}, project);

			const batchSize = 100;

			let timestamp = DateTime.utc(2000, 1, 1, 0, 0);
			for (let i = 0; i < batchSize / 4; i++) {
				await createRawInsightsEvent(workflow1, { type: 'success', value: 1, timestamp });
				timestamp = timestamp.plus({ minute: 1 });
			}

			for (let i = 0; i < batchSize / 4; i++) {
				await createRawInsightsEvent(workflow1, { type: 'failure', value: 1, timestamp });
				timestamp = timestamp.plus({ minute: 1 });
			}

			for (let i = 0; i < batchSize / 4; i++) {
				await createRawInsightsEvent(workflow2, { type: 'runtime_ms', value: 1200, timestamp });
				timestamp = timestamp.plus({ minute: 1 });
			}

			for (let i = 0; i < batchSize / 4; i++) {
				await createRawInsightsEvent(workflow2, { type: 'time_saved_min', value: 3, timestamp });
				timestamp = timestamp.plus({ minute: 1 });
			}

			// ACT
			await insightsService.compactInsights();

			// ASSERT
			await expect(insightsRawRepository.count()).resolves.toBe(0);

			const allCompacted = await insightsByPeriodRepository.find({
				order: { metaId: 'ASC', periodStart: 'ASC' },
			});

			// Expect 2 insights for workflow 1 (for success and failure)
			// and 3 for workflow 2 (2 period starts for runtime_ms and 1 for time_saved_min)
			expect(allCompacted).toHaveLength(5);
			const metaIds = allCompacted.map((event) => event.metaId);

			// meta id are ordered. first 2 are for workflow 1, last 3 are for workflow 2
			const uniqueMetaIds = [metaIds[0], metaIds[2]];
			const workflow1Insights = allCompacted.filter((event) => event.metaId === uniqueMetaIds[0]);
			const workflow2Insights = allCompacted.filter((event) => event.metaId === uniqueMetaIds[1]);

			expect(workflow1Insights).toHaveLength(2);
			expect(workflow2Insights).toHaveLength(3);

			const successInsights = workflow1Insights.find((event) => event.type === 'success');
			const failureInsights = workflow1Insights.find((event) => event.type === 'failure');

			expect(successInsights).toBeTruthy();
			expect(failureInsights).toBeTruthy();
			// success and failure insights should have the value matching the number or raw events (because value = 1)
			expect(successInsights!.value).toBe(25);
			expect(failureInsights!.value).toBe(25);

			const runtimeMsEvents = workflow2Insights.filter((event) => event.type === 'runtime_ms');
			const timeSavedMinEvents = workflow2Insights.find((event) => event.type === 'time_saved_min');
			expect(runtimeMsEvents).toHaveLength(2);

			// The last 10 minutes of the first hour
			expect(runtimeMsEvents[0].value).toBe(1200 * 10);

			// The first 15 minutes of the second hour
			expect(runtimeMsEvents[1].value).toBe(1200 * 15);
			expect(timeSavedMinEvents).toBeTruthy();
			expect(timeSavedMinEvents!.value).toBe(3 * 25);
		});

		test('should return the number of compacted events', async () => {
			// ARRANGE
			const insightsService = Container.get(InsightsService);

			const project = await createTeamProject();
			const workflow = await createWorkflow({}, project);

			const batchSize = 100;

			let timestamp = DateTime.utc(2000, 1, 1, 0, 0);
			for (let i = 0; i < batchSize; i++) {
				await createRawInsightsEvent(workflow, { type: 'success', value: 1, timestamp });
				// create 60 events per hour
				timestamp = timestamp.plus({ minute: 1 });
			}

			// ACT
			const numberOfCompactedData = await insightsService.compactRawToHour();

			// ASSERT
			expect(numberOfCompactedData).toBe(100);
		});

		test('works with data in the compacted table', async () => {
			// ARRANGE
			const insightsService = Container.get(InsightsService);
			const insightsRawRepository = Container.get(InsightsRawRepository);
			const insightsByPeriodRepository = Container.get(InsightsByPeriodRepository);

			const project = await createTeamProject();
			const workflow = await createWorkflow({}, project);

			const batchSize = 100;

			let timestamp = DateTime.utc(2000, 1, 1, 0, 0);

			// Create an existing compacted event for the first hour
			await createCompactedInsightsEvent(workflow, {
				type: 'success',
				value: 10,
				periodUnit: 'hour',
				periodStart: timestamp,
			});

			const events = Array<{ type: 'success'; value: number; timestamp: DateTime }>();
			for (let i = 0; i < batchSize; i++) {
				events.push({ type: 'success', value: 1, timestamp });
				timestamp = timestamp.plus({ minute: 1 });
			}
			await createRawInsightsEvents(workflow, events);

			// ACT
			await insightsService.compactInsights();

			// ASSERT
			await expect(insightsRawRepository.count()).resolves.toBe(0);

			const allCompacted = await insightsByPeriodRepository.find({ order: { periodStart: 1 } });
			const accumulatedValues = allCompacted.reduce((acc, event) => acc + event.value, 0);
			expect(accumulatedValues).toBe(batchSize + 10);
			expect(allCompacted[0].value).toBe(70);
			expect(allCompacted[1].value).toBe(40);
		});

		test('works with data bigger than the batch size', async () => {
			// ARRANGE
			const insightsService = Container.get(InsightsService);
			const insightsRawRepository = Container.get(InsightsRawRepository);
			const insightsByPeriodRepository = Container.get(InsightsByPeriodRepository);

			// spy on the compactRawToHour method to check if it's called multiple times
			const rawToHourSpy = jest.spyOn(insightsService, 'compactRawToHour');

			const project = await createTeamProject();
			const workflow = await createWorkflow({}, project);

			const batchSize = 600;

			let timestamp = DateTime.utc(2000, 1, 1, 0, 0);
			const events = Array<{ type: 'success'; value: number; timestamp: DateTime }>();
			for (let i = 0; i < batchSize; i++) {
				events.push({ type: 'success', value: 1, timestamp });
				timestamp = timestamp.plus({ minute: 1 });
			}
			await createRawInsightsEvents(workflow, events);

			// ACT
			await insightsService.compactInsights();

			// ASSERT
			expect(rawToHourSpy).toHaveBeenCalledTimes(3);
			await expect(insightsRawRepository.count()).resolves.toBe(0);
			const allCompacted = await insightsByPeriodRepository.find({ order: { periodStart: 1 } });
			const accumulatedValues = allCompacted.reduce((acc, event) => acc + event.value, 0);
			expect(accumulatedValues).toBe(batchSize);
		});
	});

	describe('compactHourToDay', () => {
		type TestData = {
			name: string;
			periodStarts: DateTime[];
			batches: number[];
		};

		test.each<TestData>([
			{
				name: 'compact into 2 rows',
				periodStarts: [
					DateTime.utc(2000, 1, 1, 0, 0),
					DateTime.utc(2000, 1, 1, 23, 59),
					DateTime.utc(2000, 1, 2, 1, 0),
				],
				batches: [2, 1],
			},
			{
				name: 'compact into 3 rows',
				periodStarts: [
					DateTime.utc(2000, 1, 1, 0, 0),
					DateTime.utc(2000, 1, 1, 23, 59),
					DateTime.utc(2000, 1, 2, 0, 0),
					DateTime.utc(2000, 1, 2, 23, 59),
					DateTime.utc(2000, 1, 3, 23, 59),
				],
				batches: [2, 2, 1],
			},
		])('$name', async ({ periodStarts, batches }) => {
			// ARRANGE
			const insightsService = Container.get(InsightsService);
			const insightsRawRepository = Container.get(InsightsRawRepository);
			const insightsByPeriodRepository = Container.get(InsightsByPeriodRepository);

			const project = await createTeamProject();
			const workflow = await createWorkflow({}, project);
			// create before so we can create the raw events in parallel
			await createMetadata(workflow);
			for (const periodStart of periodStarts) {
				await createCompactedInsightsEvent(workflow, {
					type: 'success',
					value: 1,
					periodUnit: 'hour',
					periodStart,
				});
			}

			// ACT
			const compactedRows = await insightsService.compactHourToDay();

			// ASSERT
			expect(compactedRows).toBe(periodStarts.length);
			await expect(insightsRawRepository.count()).resolves.toBe(0);
			const allCompacted = await insightsByPeriodRepository.find({ order: { periodStart: 1 } });
			expect(allCompacted).toHaveLength(batches.length);
			for (const [index, compacted] of allCompacted.entries()) {
				expect(compacted.value).toBe(batches[index]);
			}
		});
	});
});

describe('getInsightsSummary', () => {
	let insightsService: InsightsService;
	let insightsRawRepository: InsightsRawRepository;
	let insightsByPeriodRepository: InsightsByPeriodRepository;
	let insightsMetadataRepository: InsightsMetadataRepository;
	beforeAll(async () => {
		await testDb.init();

		insightsService = Container.get(InsightsService);
		insightsRawRepository = Container.get(InsightsRawRepository);
		insightsByPeriodRepository = Container.get(InsightsByPeriodRepository);
		insightsMetadataRepository = Container.get(InsightsMetadataRepository);
	});

	let project: Project;
	let workflow: IWorkflowDb & WorkflowEntity;
	let metadata: InsightsMetadata;

	beforeEach(async () => {
		await testDb.truncate(['InsightsRaw', 'InsightsMetadata', 'InsightsByPeriod']);

		project = await createTeamProject();
		workflow = await createWorkflow({}, project);
		metadata = await createMetadata(workflow);
	});

	afterAll(async () => {
		await testDb.terminate();
	});

	test('simple test', async () => {
		// ARRANGE
		// last 7 days
		await createCompactedInsightsEvent(workflow, {
			type: 'success',
			value: 1,
			periodUnit: 'day',
			periodStart: DateTime.utc(),
		});
		await createCompactedInsightsEvent(workflow, {
			type: 'success',
			value: 1,
			periodUnit: 'day',
			periodStart: DateTime.utc().minus({ day: 2 }),
		});
		await createCompactedInsightsEvent(workflow, {
			type: 'failure',
			value: 2,
			periodUnit: 'day',
			periodStart: DateTime.utc(),
		});
		// last 14 days
		await createCompactedInsightsEvent(workflow, {
			type: 'success',
			value: 1,
			periodUnit: 'day',
			periodStart: DateTime.utc().minus({ days: 10 }),
		});
		await createCompactedInsightsEvent(workflow, {
			type: 'runtime_ms',
			value: 123,
			periodUnit: 'day',
			periodStart: DateTime.utc().minus({ days: 10 }),
		});

		// ACT
		const summary = await insightsService.getInsightsSummary();

		// ASSERT
		expect(summary).toEqual({
			averageRunTime: { deviation: -123, unit: 'time', value: 0 },
			failed: { deviation: 2, unit: 'count', value: 2 },
			failureRate: { deviation: 0.5, unit: 'ratio', value: 0.5 },
			timeSaved: { deviation: 0, unit: 'time', value: 0 },
			total: { deviation: 3, unit: 'count', value: 4 },
		});
	});
});
