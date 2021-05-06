import {
	UserSettings,
} from 'n8n-core';
import { Command, flags } from '@oclif/command';
import * as Redis from 'ioredis';

import * as config from '../config';
import {
	ActiveExecutions,
	ActiveWorkflowRunner,
	CredentialsOverwrites,
	CredentialTypes,
	Db,
	ExternalHooks,
	GenericHelpers,
	LoadNodesAndCredentials,
	NodeTypes,
	TestWebhooks,
	WebhookServer,
} from '../src';
import { IDataObject } from 'n8n-workflow';

import { 
	getLogger,
} from '../src/Logger';

import {
	LoggerProxy,
} from 'n8n-workflow';

let activeWorkflowRunner: ActiveWorkflowRunner.ActiveWorkflowRunner | undefined;
let processExistCode = 0;


export class Webhook extends Command {
	static description = 'Starts n8n webhook process. Intercepts only production URLs.';

	static examples = [
		`$ n8n webhook`,
	];

	static flags = {
		help: flags.help({ char: 'h' }),
	};

	/**
	 * Stops the n8n in a graceful way.
	 * Make for example sure that all the webhooks from third party services
	 * get removed.
	 */
	static async stopProcess() {
		LoggerProxy.info(`\nStopping n8n...`);

		try {
			const externalHooks = ExternalHooks();
			await externalHooks.run('n8n.stop', []);

			setTimeout(() => {
				// In case that something goes wrong with shutdown we
				// kill after max. 30 seconds no matter what
				process.exit(processExistCode);
			}, 30000);

			const skipWebhookDeregistration = config.get('endpoints.skipWebhoooksDeregistrationOnShutdown') as boolean;

			const removePromises = [];
			if (activeWorkflowRunner !== undefined && skipWebhookDeregistration !== true) {
				removePromises.push(activeWorkflowRunner.removeAll());
			}

			// Remove all test webhooks
			const testWebhooks = TestWebhooks.getInstance();
			removePromises.push(testWebhooks.removeAll());

			await Promise.all(removePromises);

			// Wait for active workflow executions to finish
			const activeExecutionsInstance = ActiveExecutions.getInstance();
			let executingWorkflows = activeExecutionsInstance.getActiveExecutions();

			let count = 0;
			while (executingWorkflows.length !== 0) {
				if (count++ % 4 === 0) {
					LoggerProxy.info(`Waiting for ${executingWorkflows.length} active executions to finish...`);
				}
				await new Promise((resolve) => {
					setTimeout(resolve, 500);
				});
				executingWorkflows = activeExecutionsInstance.getActiveExecutions();
			}

		} catch (error) {
			LoggerProxy.error('There was an error shutting down n8n.', error);
		}

		process.exit(processExistCode);
	}


	async run() {
		const logger = getLogger();
		LoggerProxy.init(logger);

		// Make sure that n8n shuts down gracefully if possible
		process.on('SIGTERM', Webhook.stopProcess);
		process.on('SIGINT', Webhook.stopProcess);

		const { flags } = this.parse(Webhook);

		// Wrap that the process does not close but we can still use async
		await (async () => {
			if (config.get('executions.mode') !== 'queue') {
				/**
				 * It is technically possible to run without queues but
				 * there are 2 known bugs when running in this mode:
				 * - Executions list will be problematic as the main process
				 * is not aware of current executions in the webhook processes
				 * and therefore will display all current executions as error
				 * as it is unable to determine if it is still running or crashed
				 * - You cannot stop currently executing jobs from webhook processes
				 * when running without queues as the main process cannot talk to
				 * the wehbook processes to communicate workflow execution interruption.
				 */

				this.error('Webhook processes can only run with execution mode as queue.');
			}

			try {
				// Start directly with the init of the database to improve startup time
				const startDbInitPromise = Db.init().catch(error => {
					logger.error(`There was an error initializing DB: "${error.message}"`);

					processExistCode = 1;
					// @ts-ignore
					process.emit('SIGINT');
					process.exit(1);
				});

				// Make sure the settings exist
				const userSettings = await UserSettings.prepareUserSettings();

				// Load all node and credential types
				const loadNodesAndCredentials = LoadNodesAndCredentials();
				await loadNodesAndCredentials.init();

				// Load the credentials overwrites if any exist
				const credentialsOverwrites = CredentialsOverwrites();
				await credentialsOverwrites.init();

				// Load all external hooks
				const externalHooks = ExternalHooks();
				await externalHooks.init();

				// Add the found types to an instance other parts of the application can use
				const nodeTypes = NodeTypes();
				await nodeTypes.init(loadNodesAndCredentials.nodeTypes);
				const credentialTypes = CredentialTypes();
				await credentialTypes.init(loadNodesAndCredentials.credentialTypes);

				// Wait till the database is ready
				await startDbInitPromise;

				if (config.get('executions.mode') === 'queue') {
					const redisHost = config.get('queue.bull.redis.host');
					const redisPassword = config.get('queue.bull.redis.password');
					const redisPort = config.get('queue.bull.redis.port');
					const redisDB = config.get('queue.bull.redis.db');
					const redisConnectionTimeoutLimit = config.get('queue.bull.redis.timeoutThreshold');
					let lastTimer = 0, cumulativeTimeout = 0;

					const settings = {
						retryStrategy: (times: number): number | null => {
							const now = Date.now();
							if (now - lastTimer > 30000) {
								// Means we had no timeout at all or last timeout was temporary and we recovered
								lastTimer = now;
								cumulativeTimeout = 0;
							} else {
								cumulativeTimeout += now - lastTimer;
								lastTimer = now;
								if (cumulativeTimeout > redisConnectionTimeoutLimit) {
									logger.error('Unable to connect to Redis after ' + redisConnectionTimeoutLimit + ". Exiting process.");
									process.exit(1);
								}
							}
							return 500;
						},
					} as IDataObject;

					if (redisHost) {
						settings.host = redisHost;
					}
					if (redisPassword) {
						settings.password = redisPassword;
					}
					if (redisPort) {
						settings.port = redisPort;
					}
					if (redisDB) {
						settings.db = redisDB;
					}

					// This connection is going to be our heartbeat
					// IORedis automatically pings redis and tries to reconnect
					// We will be using the retryStrategy above
					// to control how and when to exit.
					const redis = new Redis(settings);

					redis.on('error', (error) => {
						if (error.toString().includes('ECONNREFUSED') === true) {
							logger.warn('Redis unavailable - trying to reconnect...');
						} else {
							logger.warn('Error with Redis: ', error);
						}
					});
				}

				await WebhookServer.start();

				// Start to get active workflows and run their triggers
				activeWorkflowRunner = ActiveWorkflowRunner.getInstance();
				await activeWorkflowRunner.initWebhooks();

				const editorUrl = GenericHelpers.getBaseUrl();
				console.info('Webhook listener waiting for requests.');

			} catch (error) {
				console.error('Exiting due to error. See log message for details.');
				logger.error(`Webhook process cannot continue. "${error.message}"`);

				processExistCode = 1;
				// @ts-ignore
				process.emit('SIGINT');
				process.exit(1);
			}
		})();
	}
}
