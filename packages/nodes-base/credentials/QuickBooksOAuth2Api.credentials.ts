import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

const scopes = {
	accounting: 'com.intuit.quickbooks.accounting',
	payment: 'com.intuit.quickbooks.payment',
};

// https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization

export class QuickBooksOAuth2Api implements ICredentialType {
	name = 'quickBooksOAuth2Api';
	extends = [
		'oAuth2Api',
	];
	displayName = 'QuickBooks OAuth2 API';
	documentationUrl = 'quickbooks';
	properties: INodeProperties[] = [
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default: 'https://appcenter.intuit.com/connect/oauth2',
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
		},
		{
 			displayName: 'Scopes',
 			name: 'scope',
 			type: 'multiOptions',
 			default: [scopes.accounting, scopes.payment],
 			options: [
 				{
 					name: 'Accounting only',
 					value: scopes.accounting,
 				},
 				{
 					name: 'Payment only',
 					value: scopes.payment,
 				},
 			],
 		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: '',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'header',
		},
		{
			displayName: 'Environment',
			name: 'environment',
			type: 'options',
			default: 'production',
			options: [
				{
					name: 'Production',
					value: 'production',
				},
				{
					name: 'Sandbox',
					value: 'sandbox',
				},
			],
		},
	];
}
