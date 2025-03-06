import type {
	IDataObject,
	IExecuteFunctions,
	IExecuteSingleFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
} from 'n8n-workflow';

export async function microsoftSharePointApiRequest(
	this: IExecuteFunctions | IExecuteSingleFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs?: IDataObject,
	headers?: IDataObject,
	url?: string,
): Promise<any> {
	const credentials: { subdomain: string } = await this.getCredentials(
		'microsoftSharePointOAuth2Api',
	);

	const options: IHttpRequestOptions = {
		method,
		url: url ?? `https://${credentials.subdomain}.sharepoint.com/_api/v2.0${endpoint}`,
		json: true,
		headers,
		body,
		qs,
	};

	return await this.helpers.requestWithAuthentication.call(
		this,
		'microsoftSharePointOAuth2Api',
		options,
	);
}

export const untilSiteSelected = { site: [''] };

export const untilListSelected = { list: [''] };
