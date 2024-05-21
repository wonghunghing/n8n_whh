import type { AllEntities } from 'n8n-workflow';

type NodeMap = {
	item: 'create' | 'get';
};

export type WebflowType = AllEntities<NodeMap>;
