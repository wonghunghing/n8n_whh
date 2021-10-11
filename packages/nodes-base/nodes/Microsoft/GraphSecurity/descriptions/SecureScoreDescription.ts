import {
	INodeProperties,
} from 'n8n-workflow';

export const secureScoreOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: [
					'secureScore',
				],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
			},
			{
				name: 'Get All',
				value: 'getAll',
			},
		],
		default: 'get',
	},
];

export const secureScoreFields: INodeProperties[] = [
	// ----------------------------------------
	//             secureScore: get
	// ----------------------------------------
	{
		displayName: 'Secure Score ID',
		name: 'secureScoreId',
		description: 'ID of the secure score to retrieve',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: [
					'secureScore',
				],
				operation: [
					'get',
				],
			},
		},
	},

	// ----------------------------------------
	//           secureScore: getAll
	// ----------------------------------------
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: {
				resource: [
					'secureScore',
				],
				operation: [
					'getAll',
				],
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		description: 'Max number of results to return',
		typeOptions: {
			minValue: 1,
		},
		displayOptions: {
			show: {
				resource: [
					'secureScore',
				],
				operation: [
					'getAll',
				],
				returnAll: [
					false,
				],
			},
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		default: {},
		placeholder: 'Add Filter',
		displayOptions: {
			show: {
				resource: [
					'secureScore',
				],
				operation: [
					'getAll',
				],
			},
		},
		options: [
			{
				displayName: 'Filter Expression',
				name: '$filter',
				description: '<a href="https://docs.microsoft.com/en-us/graph/query-parameters#filter-parameter">Expression</a> to filter results by, e.g. <code>startswith(id,\'AATP\')</code>',
				type: 'string',
				default: '',
			},
		],
	},
];
