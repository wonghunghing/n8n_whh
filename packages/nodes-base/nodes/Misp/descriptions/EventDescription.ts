import {
	INodeProperties,
} from 'n8n-workflow';

export const eventOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		displayOptions: {
			show: {
				resource: [
					'event',
				],
			},
		},
		noDataExpression: true,
		options: [
			{
				name: 'Create',
				value: 'create',
			},
			{
				name: 'Delete',
				value: 'delete',
			},
			{
				name: 'Get',
				value: 'get',
			},
			{
				name: 'Get All',
				value: 'getAll',
			},
			{
				name: 'Publish',
				value: 'publish',
			},
			{
				name: 'Unpublish',
				value: 'unpublish',
			},
			{
				name: 'Update',
				value: 'update',
			},
		],
		default: 'create',
	},
];

export const eventFields: INodeProperties[] = [
	// ----------------------------------------
	//              event: create
	// ----------------------------------------
	{
		displayName: 'Organization Name or ID',
		name: 'org_id',
		type: 'options',
		default: '',
		required: true,
		description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/nodes/expressions.html#expressions">expression</a>',
		typeOptions: {
			loadOptionsMethod: 'getOrgs',
		},
		displayOptions: {
			show: {
				resource: [
					'event',
				],
				operation: [
					'create',
				],
			},
		},
	},
	{
		displayName: 'Information',
		name: 'information',
		type: 'string',
		default: '',
		required: true,
		description: 'Information on the event - max 65535 characters',
		displayOptions: {
			show: {
				resource: [
					'event',
				],
				operation: [
					'create',
				],
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
				resource: [
					'event',
				],
				operation: [
					'create',
				],
			},
		},
		options: [
			{
				displayName: 'Analysis',
				name: 'analysis',
				type: 'options',
				default: 0,
				description: 'Analysis maturity level of the event',
				options: [
					{
						name: 'Initial',
						value: 0,
					},
					{
						name: 'Ongoing',
						value: 1,
					},
					{
						name: 'Complete',
						value: 2,
					},
				],
			},
			{
				displayName: 'Distribution',
				name: 'distribution',
				type: 'options',
				default: 0,
				description: 'Who will be able to see this event once published',
				options: [
					{
						name: 'Your Organization Only',
						value: 0,
					},
					{
						name: 'This Community Only',
						value: 1,
					},
					{
						name: 'Connected Communities',
						value: 2,
					},
					{
						name: 'All Communities',
						value: 3,
					},
					{
						name: 'Sharing Group',
						value: 4,
					},
					{
						name: 'Inherit Event',
						value: 5,
					},
				],
			},
			{
				displayName: 'Sharing Group Name or ID',
				name: 'sharing_group_id',
				type: 'options',
				default: '',
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/nodes/expressions.html#expressions">expression</a>. Use only for when <code>Sharing Group</code> is selected in <code>Distribution</code>',
				typeOptions: {
					loadOptionsMethod: 'getSharingGroups',
				},
			},
			{
				displayName: 'Threat Level ID',
				name: 'threat_level_id',
				type: 'options',
				default: 1,
				options: [
					{
						name: 'High',
						value: 1,
					},
					{
						name: 'Medium',
						value: 2,
					},
					{
						name: 'Low',
						value: 3,
					},
					{
						name: 'Undefined',
						value: 4,
					},
				],
			},
		],
	},

	// ----------------------------------------
	//              event: delete
	// ----------------------------------------
	{
		displayName: 'Event ID',
		name: 'eventId',
		description: 'UUID or numeric ID of the event',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: [
					'event',
				],
				operation: [
					'delete',
				],
			},
		},
	},

	// ----------------------------------------
	//                event: get
	// ----------------------------------------
	{
		displayName: 'Event ID',
		name: 'eventId',
		description: 'UUID or numeric ID of the event',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: [
					'event',
				],
				operation: [
					'get',
				],
			},
		},
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: {
				resource: [
					'event',
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
					'event',
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

	// ----------------------------------------
	//              event: publish
	// ----------------------------------------
	{
		displayName: 'Event ID',
		name: 'eventId',
		description: 'UUID or numeric ID of the event',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: [
					'event',
				],
				operation: [
					'publish',
				],
			},
		},
	},

	// ----------------------------------------
	//             event: unpublish
	// ----------------------------------------
	{
		displayName: 'Event ID',
		name: 'eventId',
		description: 'UUID or numeric ID of the event',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: [
					'event',
				],
				operation: [
					'unpublish',
				],
			},
		},
	},

	// ----------------------------------------
	//              event: update
	// ----------------------------------------
	{
		displayName: 'Event ID',
		name: 'eventId',
		description: 'UUID or numeric ID of the event',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: [
					'event',
				],
				operation: [
					'update',
				],
			},
		},
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: [
					'event',
				],
				operation: [
					'update',
				],
			},
		},
		options: [
			{
				displayName: 'Analysis',
				name: 'analysis',
				type: 'options',
				default: 0,
				description: 'Analysis maturity level of the event',
				options: [
					{
						name: 'Initial',
						value: 0,
					},
					{
						name: 'Ongoing',
						value: 1,
					},
					{
						name: 'Complete',
						value: 2,
					},
				],
			},
			{
				displayName: 'Distribution',
				name: 'distribution',
				type: 'options',
				default: 0,
				description: 'Who will be able to see this event once published',
				options: [
					{
						name: 'Your Organization Only',
						value: 0,
					},
					{
						name: 'This Community Only',
						value: 1,
					},
					{
						name: 'Connected Communities',
						value: 2,
					},
					{
						name: 'All Communities',
						value: 3,
					},
					{
						name: 'Sharing Group',
						value: 4,
					},
					{
						name: 'Inherit Event',
						value: 5,
					},
				],
			},
			{
				displayName: 'Information',
				name: 'information',
				type: 'string',
				default: '',
				description: 'Information on the event - max 65535 characters',
			},
			{
				displayName: 'Sharing Group Name or ID',
				name: 'sharing_group_id',
				type: 'options',
				default: '',
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/nodes/expressions.html#expressions">expression</a>. Use only for when <code>Sharing Group</code> is selected in <code>Distribution</code>',
				typeOptions: {
					loadOptionsMethod: 'getSharingGroups',
				},
			},
			{
				displayName: 'Threat Level ID',
				name: 'threat_level_id',
				type: 'options',
				default: 1,
				options: [
					{
						name: 'High',
						value: 1,
					},
					{
						name: 'Medium',
						value: 2,
					},
					{
						name: 'Low',
						value: 3,
					},
					{
						name: 'Undefined',
						value: 4,
					},
				],
			},
		],
	},
];
