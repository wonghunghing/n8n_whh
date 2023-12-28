/* eslint-disable n8n-nodes-base/node-dirname-against-convention */
import {
	ConnectionType,
	type IExecuteFunctions,
	type INodeType,
	type INodeTypeDescription,
	type SupplyData,
} from 'n8n-workflow';

import type { ClientOptions } from 'openai';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { logWrapper } from '../../../utils/logWrapper';
import { getConnectionHintNoticeField } from '../../../utils/sharedFields';

export class EmbeddingsOpenAi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Embeddings OpenAI',
		name: 'embeddingsOpenAi',
		icon: 'file:openAi.svg',
		credentials: [
			{
				name: 'openAiApi',
				required: true,
			},
		],
		group: ['transform'],
		version: 1,
		description: 'Use Embeddings OpenAI',
		defaults: {
			name: 'Embeddings OpenAI',
		},

		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Embeddings'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.embeddingsopenai/',
					},
				],
			},
		},
		// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
		inputs: [],
		// eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
		outputs: ['ai_embedding'],
		outputNames: ['Embeddings'],
		properties: [
			getConnectionHintNoticeField(['ai_vectorStore']),
			{
				displayName: 'Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Additional options to add',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Base URL',
						name: 'baseURL',
						default: 'https://api.openai.com/v1',
						description: 'Override the default base URL for the API',
						type: 'string',
					},
					{
						displayName: 'Batch Size',
						name: 'batchSize',
						default: 512,
						typeOptions: { maxValue: 2048 },
						description: 'Maximum number of documents to send in each request',
						type: 'number',
					},
					{
						displayName: 'Strip New Lines',
						name: 'stripNewLines',
						default: true,
						description: 'Whether to strip new lines from the input text',
						type: 'boolean',
					},
					{
						displayName: 'Timeout',
						name: 'timeout',
						default: -1,
						description:
							'Maximum amount of time a request is allowed to take in seconds. Set to -1 for no timeout.',
						type: 'number',
					},
				],
			},
		],
	};

	async supplyData(this: IExecuteFunctions, itemIndex: number): Promise<SupplyData> {
		this.logger.verbose('Supply data for embeddings');
		const credentials = await this.getCredentials('openAiApi');

		const options = this.getNodeParameter('options', itemIndex, {}) as {
			baseURL?: string;
			batchSize?: number;
			stripNewLines?: boolean;
			timeout?: number;
		};

		if (options.timeout === -1) {
			options.timeout = undefined;
		}

		const configuration: ClientOptions = {};
		if (options.baseURL) {
			configuration.baseURL = options.baseURL;
		}

		const embeddings = new OpenAIEmbeddings(
			{
				openAIApiKey: credentials.apiKey as string,
				...options,
			},
			configuration,
		);

		return {
			response: logWrapper(embeddings, this),
		};
	}
}
