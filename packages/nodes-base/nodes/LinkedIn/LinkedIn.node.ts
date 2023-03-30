import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { linkedInApiRequest } from './GenericFunctions';
import { postFields, postOperations } from './PostDescription';

export class LinkedIn implements INodeType {
	// eslint-disable-next-line n8n-nodes-base/node-class-description-missing-subtitle
	description: INodeTypeDescription = {
		displayName: 'LinkedIn',
		name: 'linkedIn',
		icon: 'file:linkedin.svg',
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume LinkedIn API',
		defaults: {
			name: 'LinkedIn',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'linkedInOAuth2Api',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Post',
						value: 'post',
					},
				],
				default: 'post',
			},
			//POST
			...postOperations,
			...postFields,
		],
	};

	methods = {
		loadOptions: {
			// Get Person URN which has to be used with other LinkedIn API Requests
			// https://docs.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin
			async getPersonUrn(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const person = await linkedInApiRequest.call(this, 'GET', '/me', {});
				returnData.push({
					name: `${person.localizedFirstName} ${person.localizedLastName}`,
					value: person.id,
				});
				return returnData;
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		let responseData;
		const resource = this.getNodeParameter('resource', 0);
		const operation = this.getNodeParameter('operation', 0);

		let body: any = {};

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'post') {
					if (operation === 'create') {
						const text = this.getNodeParameter('text', i) as string;
						const shareMediaCategory = this.getNodeParameter('shareMediaCategory', i) as string;
						const postAs = this.getNodeParameter('postAs', i) as string;
						const additionalFields = this.getNodeParameter('additionalFields', i);

						let authorUrn = '';
						let visibility = 'PUBLIC';

						if (postAs === 'person') {
							const personUrn = this.getNodeParameter('person', i) as string;
							// Only if posting as a person can user decide if post visible by public or connections
							visibility = (additionalFields.visibility as string) || 'PUBLIC';
							authorUrn = `urn:li:person:${personUrn}`;
						} else {
							const organizationUrn = this.getNodeParameter('organization', i) as string;
							authorUrn = `urn:li:organization:${organizationUrn}`;
						}

						let description = '';
						let title = '';
						let originalUrl = '';

						body = {
							author: authorUrn,
							lifecycleState: 'PUBLISHED',
							distribution: {
								feedDistribution: 'MAIN_FEED',
								targetEnties: [],
								thirdPartyDistributionChannels: [],
							},
							visibility,
						};

						if (shareMediaCategory === 'IMAGE') {
							if (additionalFields.description) {
								description = additionalFields.description as string;
							}
							if (additionalFields.title) {
								title = additionalFields.title as string;
							}
							// Send a REQUEST to prepare a register of a media image file
							const registerRequest = {
								registerUploadRequest: {
									recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
									owner: authorUrn,
									serviceRelationships: [
										{
											relationshipType: 'OWNER',
											identifier: 'urn:li:userGeneratedContent',
										},
									],
								},
							};

							const registerObject = await linkedInApiRequest.call(
								this,
								'POST',
								'/assets?action=registerUpload',
								registerRequest,
							);

							// Response provides a specific upload URL that is used to upload the binary image file
							const uploadUrl = registerObject.value.uploadMechanism[
								'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
							].uploadUrl as string;
							const asset = registerObject.value.asset as string;

							const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i);
							this.helpers.assertBinaryData(i, binaryPropertyName);

							// Buffer binary data
							const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
							// Upload image
							await linkedInApiRequest.call(this, 'POST', uploadUrl, buffer, true);

							body = {
								content: {
									media: {
										title,
										id: asset,
										description,
									},
								},
							};
						} else if (shareMediaCategory === 'ARTICLE') {
							if (additionalFields.description) {
								description = additionalFields.description as string;
							}
							if (additionalFields.title) {
								title = additionalFields.title as string;
							}
							if (additionalFields.originalUrl) {
								originalUrl = additionalFields.originalUrl as string;
							}

							body = {
								content: {
									title,
									description,
									source: originalUrl,
								},
							};

							if (description === '') {
								delete body.description;
							}

							if (title === '') {
								delete body.title;
							}
						} else {
							Object.assign(body, { commentary: text });
						}
						const endpoint = '/posts';
						responseData = await linkedInApiRequest.call(this, 'POST', endpoint, body);
					}
				}
				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData as IDataObject[]),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					const executionData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray({ error: error.message }),
						{ itemData: { item: i } },
					);
					returnData.push(...executionData);
					continue;
				}
				throw error;
			}
		}

		return this.prepareOutputData(returnData);
	}
}
