import type { SuperAgentTest } from 'supertest';
import { agent as testAgent } from 'supertest';
import { mock } from 'jest-mock-extended';

import config from '@/config';
import { AbstractServer } from '@/AbstractServer';
import { ExternalHooks } from '@/ExternalHooks';
import { InternalHooks } from '@/InternalHooks';
import { ActiveWebhooks, TestWebhooks, WaitingWebhooks } from '@/webhooks';
import type { WebhookResponseCallbackData } from '@/webhooks/types';

import { mockInstance } from '../integration/shared/utils';

let agent: SuperAgentTest;

describe('WebhookServer', () => {
	mockInstance(ExternalHooks);
	mockInstance(InternalHooks);

	describe('CORS', () => {
		const corsOrigin = 'https://example.com';
		const activeWebhooks = mockInstance(ActiveWebhooks);
		const testWebhooks = mockInstance(TestWebhooks);
		mockInstance(WaitingWebhooks);

		beforeAll(async () => {
			const server = new (class extends AbstractServer {
				testWebhooksEnabled = true;
			})();
			await server.start();
			agent = testAgent(server.app);
		});

		const tests = [
			['webhook', activeWebhooks],
			['webhookTest', testWebhooks],
			// TODO: enable webhookWaiting after CORS support is added
			// ['webhookWaiting', waitingWebhooks],
		] as const;

		for (const [key, manager] of tests) {
			describe(`for ${key}`, () => {
				it('should handle preflight requests', async () => {
					const pathPrefix = config.getEnv(`endpoints.${key}`);
					manager.getWebhookMethods.mockResolvedValueOnce(['GET']);

					const response = await agent.options(`/${pathPrefix}/abcd`).set('origin', corsOrigin);
					expect(response.statusCode).toEqual(204);
					expect(response.body).toEqual({});
					expect(response.headers['access-control-allow-origin']).toEqual(corsOrigin);
					expect(response.headers['access-control-allow-methods']).toEqual('OPTIONS, GET');
				});

				it('should handle regular requests', async () => {
					const pathPrefix = config.getEnv(`endpoints.${key}`);
					manager.getWebhookMethods.mockResolvedValueOnce(['GET']);
					manager.executeWebhook.mockResolvedValueOnce(
						mockResponse({ test: true }, { key: 'value ' }),
					);

					const response = await agent.get(`/${pathPrefix}/abcd`).set('origin', corsOrigin);
					expect(response.statusCode).toEqual(200);
					expect(response.body).toEqual({ test: true });
					expect(response.headers['access-control-allow-origin']).toEqual(corsOrigin);
					expect(response.headers.key).toEqual('value');
				});
			});
		}

		const mockResponse = (data = {}, headers = {}, status = 200) => {
			const response = mock<WebhookResponseCallbackData>();
			response.responseCode = status;
			response.data = data;
			response.headers = headers;
			return response;
		};
	});
});
