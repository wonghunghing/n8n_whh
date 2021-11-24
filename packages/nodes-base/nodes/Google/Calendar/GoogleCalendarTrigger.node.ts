
import {
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
	NodeApiError,
} from 'n8n-workflow';

import {
	googleApiRequest,
	googleApiRequestAllItems,
} from './GenericFunctions';

import * as moment from 'moment';

export class GoogleCalendarTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Google Calendar Trigger',
		name: 'googleCalendarTrigger',
		icon: 'file:googleCalendar.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["triggerOn"]}}',
		description: '',
		defaults: {
			name: 'Google Calendar Trigger',
			color: '#3E87E4',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'googleCalendarOAuth2Api',
				required: true,
			},
		],
		polling: true,
		properties: [
			{
				displayName: 'Calendar Name/ID',
				name: 'calendarId',
				type: 'options',
				required: true,
				typeOptions: {
					loadOptionsMethod: 'getCalendars',
				},
				default: '',
			},
			{
				displayName: 'Trigger On',
				name: 'triggerOn',
				type: 'options',
				required: true,
				default: '',
				options: [
					{
						name: 'Event Created',
						value: 'eventCreated',
					},
					{
						name: 'Event Ended',
						value: 'eventEnded',
					},
					{
						name: 'Event Started',
						value: 'eventStarted',
					},
					{
						name: 'Event Updated',
						value: 'eventUpdated',
					},
				],
				description: '',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Match Term',
						name: 'matchTerm',
						type: 'string',
						default: '',
						description: 'Free text search terms to filter events that match these terms in any field, except for extended properties',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			// Get all the calendars to display them to user so that he can
			// select them easily
			async getCalendars(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const calendars = await googleApiRequestAllItems.call(
					this,
					'items',
					'GET',
					'/calendar/v3/users/me/calendarList',
				);
				for (const calendar of calendars) {
					returnData.push({
						name: calendar.summary,
						value: calendar.id,
					});
				}
				return returnData;
			},
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const triggerOn = this.getNodeParameter('triggerOn') as string;
		const calendarId = this.getNodeParameter('calendarId') as string;
		const webhookData = this.getWorkflowStaticData('node');
		const matchTerm = this.getNodeParameter('options.matchTerm', '') as string;

		const now = moment().utc().format();

		const startDate = webhookData.lastTimeChecked as string || now;

		const endDate = now;

		const qs: IDataObject = {
			showDeleted: false,
		};

		if (matchTerm !== '') {
			qs.q = matchTerm;
		}

		let events;

		if (triggerOn === 'eventCreated' || triggerOn === 'eventUpdated') {
			Object.assign(qs, {
				updatedMin: startDate,
				orderBy: 'updated',
			});
		} else if (triggerOn === 'eventStarted' || triggerOn === 'eventEnded') {
			Object.assign(qs, {
				singleEvents: true,
				timeMin: moment(startDate).startOf('second').utc().format(),
				timeMax: moment(endDate).endOf('second').utc().format(),
				orderBy: 'startTime',
			});
		}

		if (this.getMode() === 'manual') {
			delete qs.updatedMin;
			delete qs.timeMin;
			delete qs.timeMax;

			qs.maxResults = 1;
			events = await googleApiRequest.call(this, 'GET', `/calendar/v3/calendars/${calendarId}/events`, {}, qs);
			events = events.items;
		} else {
			events = await googleApiRequestAllItems.call(this, 'items', 'GET', `/calendar/v3/calendars/${calendarId}/events`, {}, qs);
			if (triggerOn === 'eventCreated') {
				events = events.filter((event: { created: string }) => moment(event.created).isBetween(startDate, endDate));
			} else if (triggerOn === 'eventUpdated') {
				events = events.filter((event: { created: string, updated: string }) => !moment(moment(event.created).format('YYYY-MM-DDTHH:mm:ss')).isSame(moment(event.updated).format('YYYY-MM-DDTHH:mm:ss')));
			} else if (triggerOn === 'eventStarted') {
				events = events.filter((event: { start: { dateTime: string } }) => moment(event.start.dateTime).isBetween(startDate, endDate, null, '[]'));
			} else if (triggerOn === 'eventEnded') {
				events = events.filter((event: { end: { dateTime: string } }) => moment(event.end.dateTime).isBetween(startDate, endDate, null, '[]'));
			}
		}

		webhookData.lastTimeChecked = endDate;

		if (Array.isArray(events) && events.length) {
			return [this.helpers.returnJsonArray(events)];
		}

		if (this.getMode() === 'manual') {
			throw new NodeApiError(this.getNode(), { message: 'No data with the current filter could be found' });
		}

		return null;
	}
}