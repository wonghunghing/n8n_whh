import { createTestingPinia } from '@pinia/testing';
import { createComponentRenderer } from '@/__tests__/render';
import { mockedStore } from '@/__tests__/utils';
import { useUsageStore } from '@/stores/usage.store';
import { useSettingsStore } from '@/stores/settings.store';
import SettingsUsageAndPlan from '@/views/SettingsUsageAndPlan.vue';

vi.mock('vue-router', () => {
	return {
		useRoute: () => ({
			query: {},
		}),
		useRouter: () => ({
			replace: vi.fn(),
		}),
		RouterLink: {
			template: '<a><slot /></a>',
		},
	};
});
let usageStore: ReturnType<typeof mockedStore<typeof useUsageStore>>;
let settingsStore: ReturnType<typeof mockedStore<typeof useSettingsStore>>;

const renderComponent = createComponentRenderer(SettingsUsageAndPlan);

describe('SettingsUsageAndPlan', () => {
	beforeEach(() => {
		createTestingPinia();
		usageStore = mockedStore(useUsageStore);
		settingsStore = mockedStore(useSettingsStore);

		settingsStore.settings = {
			instanceId: 'instance-id',
			license: {
				environment: 'production',
			},
			versionCli: '0.0.0',
		};
	});

	it('should not throw errors when rendering', async () => {
		expect(() => renderComponent()).not.toThrow();
	});

	it('should render the title only while loading', async () => {
		const { getByRole } = renderComponent();
		expect(getByRole('heading', { level: 2 })).toBeInTheDocument();
		expect(getByRole('heading').nextElementSibling).toBeNull();
	});

	it('should show community registered badge', async () => {
		usageStore.isLoading = false;
		usageStore.subscriptionAppUrl = 'https://example.com';
		usageStore.planName = 'Community registered';
		const { getByRole, container } = renderComponent();
		expect(getByRole('heading', { level: 3 })).toHaveTextContent('Community Edition');
		expect(getByRole('heading', { level: 3 })).toContain(container.querySelector('.n8n-badge'));
		expect(container.querySelector('.n8n-badge')).toHaveTextContent('registered');
	});
});
