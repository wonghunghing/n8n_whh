import {
	ChannelProperties,
} from '../../Interfaces';

export const channelAddUserDescription: ChannelProperties = [
	{
		displayName: 'Channel Name or ID',
		name: 'channelId',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getChannels',
		},
		options: [],
		default: '',
		required: true,
		displayOptions: {
			show: {
				operation: [
					'addUser',
				],
				resource: [
					'channel',
				],
			},
		},
		description: 'The ID of the channel to invite user to',
	},
	{
		displayName: 'User Name or ID',
		name: 'userId',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getUsers',
		},
		options: [],
		default: '',
		required: true,
		displayOptions: {
			show: {
				operation: [
					'addUser',
				],
				resource: [
					'channel',
				],
			},
		},
		description: 'The ID of the user to invite into channel',
	},
];
