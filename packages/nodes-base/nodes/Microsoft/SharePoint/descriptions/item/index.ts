import type { INodeProperties } from 'n8n-workflow';

import * as create from './create.operation';
import * as del from './delete.operation';
import * as get from './get.operation';
import * as getAll from './getAll.operation';
import * as update from './update.operation';
import * as upsert from './upsert.operation';

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['item'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create an item in an existing list',
				routing: {
					request: {
						method: 'POST',
						url: '=/sites/{{ $parameter["site"] }}/lists/{{ $parameter["list"] }}/items',
					},
					output: {
						postReceive: [],
					},
				},
				action: 'Create item in a list',
			},
			{
				name: 'Create or Update',
				value: 'upsert',
				description: 'Create a new record, or update the current one if it already exists (upsert)',
				routing: {
					request: {
						method: 'POST',
						url: '=/sites/{{ $parameter["site"] }}/lists/{{ $parameter["list"] }}/items',
					},
					output: {
						postReceive: [],
					},
				},
				action: 'Create or Update Item (Upsert)',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an item from a list',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/sites/{{ $parameter["site"] }}/lists/{{ $parameter["list"] }}/items/{{ $parameter["item"] }}',
					},
					output: {
						postReceive: [
							{
								type: 'set',
								properties: {
									value: '={{ { "deleted": true } }}',
								},
							},
						],
					},
				},
				action: 'Delete an item',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve an item from a list',
				routing: {
					request: {
						ignoreHttpStatusErrors: true,
						method: 'GET',
						url: '=/sites/{{ $parameter["site"] }}/lists/{{ $parameter["list"] }}/items/{{ $parameter["item"] }}',
					},
					output: {
						postReceive: [],
					},
				},
				action: 'Get an item',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get specific items in a list or list many items',
				routing: {
					request: {
						method: 'GET',
						url: '=/sites/{{ $parameter["site"] }}/lists/{{ $parameter["list"] }}/items',
					},
					output: {
						postReceive: [
							{
								type: 'rootProperty',
								properties: {
									property: 'value',
								},
							},
						],
					},
				},
				action: 'Get many items',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an item in an existing list',
				routing: {
					request: {
						method: 'PATCH',
						url: '=/sites/{{ $parameter["site"] }}/lists/{{ $parameter["list"] }}/items',
					},
					output: {
						postReceive: [],
					},
				},
				action: 'Update item in a list',
			},
		],
		default: 'getAll',
	},

	...create.properties,
	...del.properties,
	...get.properties,
	...getAll.properties,
	...update.properties,
	...upsert.properties,
];
