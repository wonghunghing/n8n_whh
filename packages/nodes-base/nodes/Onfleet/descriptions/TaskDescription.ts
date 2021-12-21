import {
	INodeProperties
} from 'n8n-workflow';

export const taskOperations = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		displayOptions: {
			show: {
				resource: [ 'tasks' ],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new Onfleet task.',
			},
			{
				name: 'Create multiple tasks',
				value: 'createBatch',
				description: 'Creating multiple tasks in batch.',
			},
			{
				name: 'Clone',
				value: 'clone',
				description: 'Clone an Onfleet task.',
			},
			{
				name: 'Complete',
				value: 'complete',
				description: 'Force-complete a started Onfleet task.',
			},
			{
				name: 'Remove',
				value: 'delete',
				description: 'Remove an Onfleet task.',
			},
			{
				name: 'List',
				value: 'getAll',
				description: 'List Onfleet tasks.',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a specific Onfleet task.',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an Onfleet task.',
			},

		],
		default: 'get',
	},
] as INodeProperties[];

const merchantIdField = {
	displayName: 'Merchant ID',
	name: 'merchant',
	type: 'string',
	default: '',
	description: 'The ID of the organization that will be displayed to the recipient of the task.',
} as INodeProperties;

const executorIdField = {
	displayName: 'Executor ID',
	name: 'executor',
	type: 'string',
	default: '',
	description: 'The ID of the organization that will be responsible for fulfilling the task.',
} as INodeProperties;

const completeAfterField = {
	displayName: 'CompleteAfter',
	name: 'completeAfter',
	type: 'dateTime',
	default: null,
	description: 'The earliest time the task should be completed.',
} as INodeProperties;

const completeBeforeField = {
	displayName: 'CompleteBefore',
	name: 'completeBefore',
	type: 'dateTime',
	default: null,
	description: 'The latest time the task should be completed.',
} as INodeProperties;

const pickupTaskField = {
	displayName: 'PickupTask',
	name: 'pickupTask',
	type: 'boolean',
	default: false,
	description: 'Whether the task is a pickup task.',
} as INodeProperties;

const notesField = {
	displayName: 'Notes',
	name: 'notes',
	type: 'string',
	default: '',
	description: 'Notes for the task.',
} as INodeProperties;

const quantityField = {
	displayName: 'Quantity',
	name: 'quantity',
	type: 'number',
	default: 0,
	description: 'The number of units to be dropped off while completing this task, for route optimization purposes.',
} as INodeProperties;

const serviceTimeField = {
	displayName: 'Service Time',
	name: 'serviceTime',
	type: 'number',
	default: 0,
	description: 'The number of minutes to be spent by the worker on arrival at this task\'s destination, for route optimization purposes.',
} as INodeProperties;

export const taskFields = [
	{
		displayName: 'ID',
		name: 'id',
		type: 'string',
		displayOptions: {
			show: {
				resource: [ 'tasks' ],
			},
			hide: {
				operation: [
					'create',
					'createBatch',
					'getAll',
				],
			},
		},
		default: '',
		required: true,
		description: 'The ID of the task object for lookup.',
	},
	{
		displayName: 'Short ID',
		name: 'shortId',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: [ 'tasks' ],
				operation: [ 'get' ],
			},
		},
		required: true,
		description: 'Whether the task short ID is used for lookup.',
	},
	{
		displayName: 'From',
		name: 'from',
		type: 'dateTime',
		displayOptions: {
			show: {
				resource: [ 'tasks' ],
				operation: [ 'getAll' ],
			},
		},
		description: 'The starting time of the range. Tasks created or completed at or after this time will be included.',
		required: true,
		default: null,
	},
	{
		displayName: 'Success',
		name: 'success',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: [ 'tasks' ],
				operation: [ 'complete' ],
			},
		},
		description: 'Whether the task\'s completion was successful.',
		required: true,
		default: true,
	},
	{
		displayName: 'Additional fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Fields',
		default: {},
		displayOptions: {
			show: {
				resource: [ 'tasks' ],
				operation: [ 'getAll' ],
			},
		},
		options: [
			{
				displayName: 'To',
				name: 'to',
				type: 'dateTime',
				default: null,
				description: 'The ending time of the range. Defaults to current time if not specified.',
			},
			{
				displayName: 'State',
				name: 'state',
				type: 'multiOptions',
				options: [
					{
						name: 'Unassigned',
						value: 0,
					},
					{
						name: 'Assigned',
						value: 1,
					},
					{
						name: 'Active',
						value: 2,
					},
					{
						name: 'Completed',
						value: 3,
					},
				],
				default: null,
				description: 'The state of the tasks.',
			},
			{
				displayName: 'LastId',
				name: 'lastId',
				type: 'string',
				default: null,
				description: 'The last Id to walk the paginated response.',
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add options',
		default: {},
		displayOptions: {
			show: {
				resource: [ 'tasks' ],
				operation: [ 'clone' ],
			},
		},
		options: [
			{
				displayName: 'Include Metadata',
				name: 'includeMetadata',
				type: 'boolean',
				default: null,
			},
			{
				displayName: 'Include Barcodes',
				name: 'includeBarcodes',
				type: 'boolean',
				default: null,
			},
			{
				displayName: 'Include Dependencies',
				name: 'includeDependencies',
				type: 'boolean',
				default: null,
			},
			{
				displayName: 'Overrides',
				name: 'overrides',
				type: 'json',
				default: null,
			},
		],
	},
	{
		displayName: 'Additional fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Fields',
		default: {},
		displayOptions: {
			show: {
				resource: [ 'tasks' ],
				operation: [ 'update' ],
			},
		},
		options: [
			merchantIdField,
			executorIdField,
			completeAfterField,
			completeBeforeField,
			pickupTaskField,
			notesField,
			quantityField,
			serviceTimeField,
		],
	},
	{
		displayName: 'Additional fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Fields',
		default: {},
		displayOptions: {
			show: {
				resource: [ 'tasks' ],
				operation: [ 'complete' ],
			},
		},
		options: [
			{
				displayName: 'Notes',
				name: 'notes',
				type: 'string',
				default: '',
				description: 'Completion Notes.',
			},
		],
	},
	{
		displayName: 'Additional task fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Fields',
		default: {},
		displayOptions: {
			show: {
				resource: [ 'tasks' ],
				operation: [
					'create',
					'createBatch',
				],
			},
		},
		options: [
			merchantIdField,
			executorIdField,
			completeAfterField,
			completeBeforeField,
			pickupTaskField,
			notesField,
			quantityField,
			serviceTimeField,
			{
				displayName: 'Recipient Name Override',
				name: 'recipientNameOverride',
				type: 'string',
				default: '',
				description: 'Override the recipient name for this task only.',
			},
			{
				displayName: 'Recipient Notes Override',
				name: 'recipientNotes',
				type: 'string',
				default: '',
				description: 'Override the recipient notes for this task only.',
			},
			{
				displayName: 'Recipient Skip SMS Notifications Override',
				name: 'recipientSkipSMSNotifications',
				type: 'boolean',
				default: '',
				description: 'Override the recipient notification settings for this task only.',
			},
			{
				displayName: 'Use Merchant For Proxy Override',
				name: 'useMerchantForProxy',
				type: 'boolean',
				default: '',
				description: 'Override the organization ID to use the merchant orgID when set to true for this task only.',
			},
		],
	},
] as INodeProperties[];
