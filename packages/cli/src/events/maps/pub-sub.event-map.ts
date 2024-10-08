import type { PushType } from '@n8n/api-types';

import type { IWorkflowDb } from '@/interfaces';
import type { WorkerStatusReport } from '@/scaling/worker-status';

export type PubSubEventMap = PubSubCommandMap & PubSubWorkerResponseMap;

export type PubSubCommandMap = {
	// #region Lifecycle

	'reload-license': never;

	'restart-event-bus': never;

	'reload-external-secrets-providers': never;

	// #endregion

	// #region Community packages

	'community-package-install': {
		packageName: string;
		packageVersion: string;
	};

	'community-package-update': {
		packageName: string;
		packageVersion: string;
	};

	'community-package-uninstall': {
		packageName: string;
	};

	// #endregion

	// #region Worker view

	'get-worker-id': never;

	'get-worker-status': never;

	// #endregion

	// #region Multi-main setup

	'add-webhooks-triggers-and-pollers': {
		workflowId: string;
	};

	'remove-triggers-and-pollers': {
		workflowId: string;
	};

	'display-workflow-activation': {
		workflowId: string;
	};

	'display-workflow-deactivation': {
		workflowId: string;
	};

	'display-workflow-activation-error': {
		workflowId: string;
		errorMessage: string;
	};

	'relay-execution-lifecycle-event': {
		type: PushType;
		args: Record<string, unknown>;
		pushRef: string;
	};

	'clear-test-webhooks': {
		webhookKey: string;
		workflowEntity: IWorkflowDb;
		pushRef: string;
	};

	// #endregion
};

export type PubSubWorkerResponseMap = {
	// #region Lifecycle

	'restart-event-bus': {
		result: 'success' | 'error';
		error?: string;
	};

	'reload-external-secrets-providers': {
		result: 'success' | 'error';
		error?: string;
	};

	// #endregion

	// #region Worker view

	'get-worker-id': never;

	'get-worker-status': WorkerStatusReport;
};
