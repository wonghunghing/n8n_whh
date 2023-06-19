import type { IExecuteFunctions } from 'n8n-core';
import type { IDataObject, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions, wrapData } from '../../../../../utils/utilities';
import { responderSelector } from '../common.description';

const properties: INodeProperties[] = [
	{
		displayName: 'Task ID',
		name: 'id',
		type: 'string',
		required: true,
		default: '',
		description: 'ID of the taks',
	},
	responderSelector,
];

const displayOptions = {
	show: {
		resource: ['alert'],
		operation: ['executeResponder'],
	},
};

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const responseData: IDataObject[] = [];

	const executionData = this.helpers.constructExecutionMetaData(wrapData(responseData), {
		itemData: { item: i },
	});

	return executionData;
}
