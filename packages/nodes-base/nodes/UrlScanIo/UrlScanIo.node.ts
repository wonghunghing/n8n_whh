import {
	IExecuteFunctions,
} from 'n8n-core';

import {
	ICredentialsDecrypted,
	ICredentialTestFunctions,
	IDataObject,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import {
	OptionsWithUri,
} from 'request';

import {
	scanFields,
	scanOperations,
} from './descriptions';

import {
	handleListing,
	normalizeId,
	urlScanIoApiRequest,
} from './GenericFunctions';

export class UrlScanIo implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'urlscan.io',
		name: 'urlScanIo',
		icon: 'file:urlScanIo.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Provides various utilities for monitoring websites like health checks or screenshots',
		defaults: {
			name: 'urlscan.io',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'urlScanIoApi',
				required: true,
				testedBy: 'urlScanIoApiTest',
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				noDataExpression: true,
				type: 'options',
				options: [
					{
						name: 'Scan',
						value: 'scan',
					},
				],
				default: 'scan',
			},
			...scanOperations,
			...scanFields,
		],
	};

	methods = {
		credentialTest: {
			async urlScanIoApiTest(
				this: ICredentialTestFunctions,
				credentials: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				const { apiKey } = credentials.data as { apiKey: string };

				const options: OptionsWithUri = {
					headers: {
						'API-KEY': apiKey,
					},
					method: 'GET',
					uri: 'https://urlscan.io/user/quotas',
					json: true,
				};

				try {
					await this.helpers.request(options);
					return {
						status: 'OK',
						message: 'Authentication successful',
					};
				} catch (error) {
					return {
						status: 'Error',
						message: error.message,
					};
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];

		const resource = this.getNodeParameter('resource', 0) as 'scan';
		const operation = this.getNodeParameter('operation', 0) as 'perform' | 'get' | 'getAll';

		let responseData;

		for (let i = 0; i < items.length; i++) {

			try {

				if (resource === 'scan') {

					// **********************************************************************
					//                               scan
					// **********************************************************************

					if (operation === 'get') {

						// ----------------------------------------
						//               scan: get
						// ----------------------------------------

						const scanId = this.getNodeParameter('scanId', i) as string;
						responseData = await urlScanIoApiRequest.call(this, 'GET', `/result/${scanId}`);

					} else if (operation === 'getAll') {

						// ----------------------------------------
						//             scan: getAll
						// ----------------------------------------

						// https://urlscan.io/docs/search

						const filters = this.getNodeParameter('filters', i) as { query?: string };

						const qs: IDataObject = {};

						if (filters?.query) {
							qs.q = filters.query;
						}

						responseData = await handleListing.call(this, '/search', qs);
						responseData = responseData.map(normalizeId);

					} else if (operation === 'perform') {

						// ----------------------------------------
						//             scan: perform
						// ----------------------------------------

						// https://urlscan.io/docs/search

						const {
							tags: rawTags,
							...rest
						} = this.getNodeParameter('additionalFields', i) as {
							customAgent?: string;
							visibility?: 'public' | 'private' | 'unlisted';
							tags?: string;
							referer?: string;
							overrideSafety: string;
						};

						const body: IDataObject = {
							url: this.getNodeParameter('url', i) as string,
							...rest,
						};

						if (rawTags) {
							const tags = rawTags.split(',').map(tag => tag.trim());

							if (tags.length > 10) {
								throw new NodeOperationError(
									this.getNode(),
									'Please enter at most 10 tags', { itemIndex: i }
								);
							}

							body.tags = tags;
						}

						responseData = await urlScanIoApiRequest.call(this, 'POST', '/scan', body);
						responseData = normalizeId(responseData);

					}

				}

				Array.isArray(responseData)
					? returnData.push(...responseData)
					: returnData.push(responseData);

			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ error: error.message });
					continue;
				}
				throw error;
			}

		}

		return [this.helpers.returnJsonArray(returnData)];
	}
}
