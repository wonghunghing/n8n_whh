import type { INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

import {
	userOperations,
	userFields,
	userPoolOperations,
	userPoolFields,
	groupOperations,
	groupFields,
} from './descriptions';
import {
	searchUserPools,
	searchGroups,
	searchUsers,
	searchGroupsForUser,
} from './generalFunctions/dataFetching';
import { presendStringifyBody } from './generalFunctions/presendFunctions';

export class AwsCognito implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AWS Cognito',
		name: 'awsCognito',
		icon: 'file:cognito.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interacts with Amazon Cognito',
		defaults: { name: 'AWS Cognito' },
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		hints: [
			{
				message: 'Select at least one field to update',
				displayCondition:
					'={{($parameter["resource"] === "user" && $parameter["operation"] === "update" && Object.keys($parameter["userAttributes"].attributes).length === 0) || ($parameter["resource"] === "group" && $parameter["operation"] === "update" && Object.keys($parameter["additionalFields"]).length === 0)}}',
				whenToDisplay: 'always',
				location: 'outputPane',
				type: 'warning',
			},
		],
		credentials: [
			{
				name: 'aws',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '=https://cognito-idp.{{$credentials.region}}.amazonaws.com',
			url: '',
			json: true,
			headers: {
				'Content-Type': 'application/x-amz-json-1.1',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				default: 'user',
				routing: {
					send: {
						preSend: [presendStringifyBody],
					},
				},
				options: [
					{
						name: 'User',
						value: 'user',
					},
					{
						name: 'User Pool',
						value: 'userPool',
					},
					{
						name: 'Group',
						value: 'group',
					},
				],
			},
			...userPoolOperations,
			...userPoolFields,
			...userOperations,
			...userFields,
			...groupOperations,
			...groupFields,
		],
	};

	methods = {
		listSearch: {
			searchUserPools,
			searchGroups,
			searchUsers,
			searchGroupsForUser,
		},
	};
}
