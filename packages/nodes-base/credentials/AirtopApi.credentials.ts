import type {
	IAuthenticateGeneric,
	ICredentialType,
	ICredentialTestRequest,
	INodeProperties,
} from 'n8n-workflow';

export class AirtopApi implements ICredentialType {
	name = 'airtopApi';

	displayName = 'Airtop API';

	documentationUrl =
		'https://docs.n8n.io/integrations/creating-nodes/build/declarative-style-node/';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
				'api-key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			method: 'GET',
			baseURL: 'https://api.airtop.ai/api/v1',
			url: '/sessions',
			qs: {
				limit: 10,
			},
		},
	};
}
