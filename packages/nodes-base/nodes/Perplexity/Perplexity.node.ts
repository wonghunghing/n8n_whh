import type { INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

import { chatCompletionsFields, chatCompletionsOperations } from './ChatCompletionsDescription';
import { getModels } from './GenericFunctions';

export class Perplexity implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Perplexity',
		name: 'perplexity',
		icon: { light: 'file:perplexity.svg', dark: 'file:perplexity.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Interact with the Perplexity API to generate AI responses with citations',
		defaults: {
			name: 'Perplexity',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'perplexityApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{ $credentials.baseUrl }}',
			ignoreHttpStatusErrors: true,
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'hidden',
				noDataExpression: true,
				options: [
					{
						name: 'Chat',
						value: 'chat',
					},
				],
				default: 'chat',
			},
			...chatCompletionsOperations,
			...chatCompletionsFields,
		],
	};

	methods = {
		listSearch: {
			getModels,
		},
	};
}
