import { INodeProperties } from 'n8n-workflow';

export const taskOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				apiVersion: ['v5'],
				resource: ['task'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get data of a task',
				action: 'Get a task',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get data of many tasks',
				action: 'Get many tasks',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new task',
				action: 'Create a task',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an existing task',
				action: 'Update a task',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a task',
				action: 'Delete a task',
			},
		],
		default: 'create',
	},
];

export const taskFields: INodeProperties[] = [
	/* -------------------------------------------------------------------------- */
	/*                                  task:get                                  */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Task ID',
		name: 'taskId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				apiVersion: ['v5'],
				resource: ['task'],
				operation: ['get'],
			},
		},
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				apiVersion: ['v5'],
				operation: ['get'],
				resource: ['task'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'options',
				options: [
					{
						name: 'Client',
						value: 'client',
					},
				],
				default: 'client',
			},
		],
	},
	/* -------------------------------------------------------------------------- */
	/*                                  task:getAll                              */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				apiVersion: ['v5'],
				operation: ['getAll'],
				resource: ['task'],
			},
		},
		options: [
			{
				displayName: 'Search',
				name: 'filter',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Task Number',
				name: 'number',
				type: 'string',
				default: '',
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				apiVersion: ['v5'],
				operation: ['getAll'],
				resource: ['task'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{
						name: 'Client',
						value: 'client',
					},
				],
				default: 'client',
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				displayOptions: {
					show: {
						perPage: [false],
					},
				},
				default: false,
				description: 'Whether to return all results or only up to a given perPage',
			},
			{
				displayName: 'Limit',
				name: 'perPage',
				type: 'number',
				displayOptions: {
					show: {
						returnAll: [false],
					},
				},
				typeOptions: {
					minValue: 1,
					maxValue: 100,
				},
				default: 50,
				description: 'Max number of results to return',
			},
		],
	},
	/* -------------------------------------------------------------------------- */
	/*                                 task:create                                */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				apiVersion: ['v5'],
				operation: ['create'],
				resource: ['task'],
			},
		},
		options: [
			{
				displayName: 'Client Name or ID',
				name: 'client',
				type: 'options',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getClientsV5',
				},
				default: '',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					alwaysOpenEditWindow: true,
				},
				default: '',
			},
			{
				displayName: 'Project Name or ID',
				name: 'project',
				type: 'options',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getProjectsV5',
				},
				default: '',
			},
			{
				displayName: 'Custom Value 1',
				name: 'customValue1',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Custom Value 2',
				name: 'customValue2',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Custom Value 3',
				name: 'customValue3',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Custom Value 4',
				name: 'customValue4',
				type: 'string',
				default: '',
			},
		],
	},
	{
		displayName: 'Time Logs',
		name: 'timeLogsUi',
		placeholder: 'Add Time Log',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		displayOptions: {
			show: {
				apiVersion: ['v5'],
				resource: ['task'],
				operation: ['create'],
			},
		},
		default: {},
		options: [
			{
				name: 'timeLogsValues',
				displayName: 'Time Log',
				values: [
					{
						displayName: 'Start Date',
						name: 'startDate',
						type: 'dateTime',
						default: '',
					},
					{
						displayName: 'End Date',
						name: 'endDate',
						type: 'dateTime',
						default: '',
					},
					{
						displayName: 'Duration (Hours)',
						name: 'duration',
						type: 'number',
						typeOptions: {
							minValue: 0,
						},
						default: 0,
					},
				],
			},
		],
	},
	/* -------------------------------------------------------------------------- */
	/*                                 task:update                                */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Task ID',
		name: 'taskId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				apiVersion: ['v5'],
				resource: ['task'],
				operation: ['update'],
			},
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				apiVersion: ['v5'],
				operation: ['update'],
				resource: ['task'],
			},
		},
		options: [
			{
				displayName: 'Client Name or ID',
				name: 'client',
				type: 'options',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getClientsV5',
				},
				default: '',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					alwaysOpenEditWindow: true,
				},
				default: '',
			},
			{
				displayName: 'Project Name or ID',
				name: 'project',
				type: 'options',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getProjectsV5',
				},
				default: '',
			},
			{
				displayName: 'Custom Value 1',
				name: 'customValue1',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Custom Value 2',
				name: 'customValue2',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Custom Value 3',
				name: 'customValue3',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Custom Value 4',
				name: 'customValue4',
				type: 'string',
				default: '',
			},
		],
	},
	{
		displayName: 'Time Logs',
		name: 'timeLogsUi',
		placeholder: 'Add Time Log',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		displayOptions: {
			show: {
				apiVersion: ['v5'],
				resource: ['task'],
				operation: ['update'],
			},
		},
		default: {},
		options: [
			{
				name: 'timeLogsValues',
				displayName: 'Time Log',
				values: [
					{
						displayName: 'Start Date',
						name: 'startDate',
						type: 'dateTime',
						default: '',
					},
					{
						displayName: 'End Date',
						name: 'endDate',
						type: 'dateTime',
						default: '',
					},
					{
						displayName: 'Duration (Hours)',
						name: 'duration',
						type: 'number',
						typeOptions: {
							minValue: 0,
						},
						default: 0,
					},
				],
			},
		],
	},
	/* -------------------------------------------------------------------------- */
	/*                                 task:delete                                */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Task ID',
		name: 'taskId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				apiVersion: ['v5'],
				resource: ['task'],
				operation: ['delete'],
			},
		},
	},
];
