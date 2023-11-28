import { BasePage } from './base';

export class TemplatesPage extends BasePage {
	url = '/templates';

	getters = {
		useTemplateButton: () => cy.get('[data-testid="use-template-button"]'),
	};

	actions = {
		openSingleTemplateView: (templateId: number) => {
			cy.visit(`${this.url}/${templateId}`);
			cy.waitForLoad();
		},

		openOnboardingFlow: (id: number, name: string, workflow: object) => {
			const apiResponse = {
				id,
				name,
				workflow,
			};
			cy.intercept('POST', '/rest/workflows').as('createWorkflow');
			cy.intercept('GET', `https://api.n8n.io/api/workflows/templates/${id}`, {
				statusCode: 200,
				body: apiResponse,
			}).as('getTemplate');
			cy.intercept('GET', 'rest/workflows/**').as('getWorkflow');

			cy.visit(`/workflows/onboarding/${id}`);

			cy.wait('@getTemplate');
			cy.wait(['@createWorkflow', '@getWorkflow']);
		},

		importTemplate: (id: number, name: string, workflow: object) => {
			const apiResponse = {
				id,
				name,
				workflow,
			};
			cy.intercept('GET', `https://api.n8n.io/api/workflows/templates/${id}`, {
				statusCode: 200,
				body: apiResponse,
			}).as('getTemplate');
			cy.intercept('GET', 'rest/workflows/**').as('getWorkflow');

			cy.visit(`/workflows/templates/${id}`);

			cy.wait('@getTemplate');
			cy.wait('@getWorkflow');
		},
	};
}
