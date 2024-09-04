import { describe, expect } from 'vitest';
import { render } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { faker } from '@faker-js/faker';
import { createRouter, createWebHistory } from 'vue-router';
import { createPinia, PiniaVuePlugin, setActivePinia } from 'pinia';
import { randomInt, type ExecutionSummary } from 'n8n-workflow';
import { useSettingsStore } from '@/stores/settings.store';
import WorkflowExecutionsPreview from '@/components/executions/workflow/WorkflowExecutionsPreview.vue';
import { EnterpriseEditionFeature, VIEWS } from '@/constants';
import { i18nInstance, I18nPlugin } from '@/plugins/i18n';
import { FontAwesomePlugin } from '@/plugins/icons';
import { GlobalComponentsPlugin } from '@/plugins/components';
import { useWorkflowsStore } from '@/stores/workflows.store';
import type { ExecutionSummaryWithScopes, IWorkflowDb } from '@/Interface';

let pinia: ReturnType<typeof createPinia>;

const routes = [
	{ path: '/', name: 'home', component: { template: '<div></div>' } },
	{
		path: '/workflow/:name/debug/:executionId',
		name: VIEWS.EXECUTION_DEBUG,
		component: { template: '<div></div>' },
	},
];

const router = createRouter({
	history: createWebHistory(),
	routes,
});

const $route = {
	params: {},
};

const generateUndefinedNullOrString = () => {
	switch (randomInt(4)) {
		case 0:
			return undefined;
		case 1:
			return null;
		case 2:
			return faker.string.uuid();
		case 3:
			return '';
		default:
			return undefined;
	}
};

const executionDataFactory = (): ExecutionSummaryWithScopes => ({
	id: faker.string.uuid(),
	finished: faker.datatype.boolean(),
	mode: faker.helpers.arrayElement(['manual', 'trigger']),
	startedAt: faker.date.past(),
	stoppedAt: faker.date.past(),
	workflowId: faker.number.int().toString(),
	workflowName: faker.string.sample(),
	status: faker.helpers.arrayElement(['error', 'success']),
	nodeExecutionStatus: {},
	retryOf: generateUndefinedNullOrString(),
	retrySuccessId: generateUndefinedNullOrString(),
	scopes: ['workflow:update'],
});

describe('WorkflowExecutionsPreview.vue', () => {
	let settingsStore: ReturnType<typeof useSettingsStore>;
	let workflowsStore: ReturnType<typeof useWorkflowsStore>;
	const executionData: ExecutionSummary = executionDataFactory();

	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);

		settingsStore = useSettingsStore();
		workflowsStore = useWorkflowsStore();
	});

	test.each([
		[false, [], '/'],
		[false, ['workflow:update'], '/'],
		[true, [], '/'],
		[true, ['workflow:read'], '/'],
		[true, ['workflow:update'], `/workflow/${executionData.workflowId}/debug/${executionData.id}`],
	])(
		'when debug enterprise feature is %s with workflow scopes %s it should handle debug link click accordingly',
		async (availability, scopes, path) => {
			settingsStore.settings.enterprise = {
				...(settingsStore.settings.enterprise ?? {}),
				[EnterpriseEditionFeature.DebugInEditor]: availability,
			};

			vi.spyOn(workflowsStore, 'getWorkflowById').mockReturnValue({ scopes } as IWorkflowDb);

			// Not using createComponentRenderer helper here because this component should not stub `router-link`
			const { getByTestId } = render(WorkflowExecutionsPreview, {
				props: {
					execution: executionData,
				},
				global: {
					plugins: [
						I18nPlugin,
						i18nInstance,
						PiniaVuePlugin,
						FontAwesomePlugin,
						GlobalComponentsPlugin,
						pinia,
						router,
					],
					mocks: {
						$route,
					},
				},
			});

			await userEvent.click(getByTestId('execution-debug-button'));

			expect(router.currentRoute.value.path).toBe(path);
		},
	);

	describe('stop execution, permissions based conditional render', () => {
		it('renders the button', () => {
			settingsStore.settings.enterprise = {
				...(settingsStore.settings.enterprise ?? {}),
			};
			vi.spyOn(workflowsStore, 'getWorkflowById').mockReturnValue({
				scopes: ['workflow:execute'],
			} as IWorkflowDb);
			const { getByTestId } = render(WorkflowExecutionsPreview, {
				props: {
					execution: { ...executionData, status: 'running' },
				},
				global: {
					plugins: [
						I18nPlugin,
						i18nInstance,
						PiniaVuePlugin,
						FontAwesomePlugin,
						GlobalComponentsPlugin,
						pinia,
						router,
					],
					mocks: {
						$route,
					},
				},
			});

			expect(getByTestId('stop-execution')).toBeInTheDocument();
		});

		it("doesn't render the button", () => {
			settingsStore.settings.enterprise = {
				...(settingsStore.settings.enterprise ?? {}),
			};
			vi.spyOn(workflowsStore, 'getWorkflowById').mockReturnValue({
				scopes: undefined,
			} as IWorkflowDb);
			const { queryByTestId } = render(WorkflowExecutionsPreview, {
				props: {
					execution: { ...executionData, status: 'running' },
				},
				global: {
					plugins: [
						I18nPlugin,
						i18nInstance,
						PiniaVuePlugin,
						FontAwesomePlugin,
						GlobalComponentsPlugin,
						pinia,
						router,
					],
					mocks: {
						$route,
					},
				},
			});

			expect(queryByTestId('stop-execution')).not.toBeInTheDocument();
		});
	});
});
