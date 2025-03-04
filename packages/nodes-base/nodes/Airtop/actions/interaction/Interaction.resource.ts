import type { INodeProperties } from 'n8n-workflow';

import * as click from './click.operation';
import * as hover from './hover.operation';
import * as type from './type.operation';
import { sessionIdField, windowIdField } from '../common/fields';
export { click, hover, type };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['interaction'],
			},
		},
		options: [
			{
				name: 'Click',
				value: 'click',
				description: 'Click on an element',
				action: 'Click on an element',
			},
			{
				name: 'Hover',
				value: 'hover',
				description: 'Hover over an element',
				action: 'Hover over an element',
			},
			{
				name: 'Type',
				value: 'type',
				description: 'Type text into an element',
				action: 'Type text into an element',
			},
		],
		default: 'click',
	},
	{
		...sessionIdField,
		displayOptions: {
			show: {
				resource: ['interaction'],
			},
		},
	},
	{
		...windowIdField,
		displayOptions: {
			show: {
				resource: ['interaction'],
			},
		},
	},
	...click.description,
	...hover.description,
	...type.description,
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['interaction'],
			},
		},
		options: [
			{
				displayName: 'Visual Scope',
				name: 'visualScope',
				type: 'options',
				default: 'auto',
				description: 'Defines the strategy for visual analysis of the current window',
				options: [
					{
						name: 'Auto',
						description: 'Provides the simplest out-of-the-box experience for most web pages',
						value: 'auto',
					},
					{
						name: 'Viewport',
						description: 'For analysis of the current browser view only',
						value: 'viewport',
					},
					{
						name: 'Page',
						description: 'For analysis of the entire page',
						value: 'page',
					},
					{
						name: 'Scan',
						description:
							"For a full page analysis on sites that have compatibility issues with 'Page' mode",
						value: 'scan',
					},
				],
			},
			{
				displayName: 'Wait for Navigation',
				name: 'waitForNavigation',
				type: 'options',
				default: 'load',
				description:
					"The condition to wait for the navigation to complete after an interaction (click, type or hover). Defaults to 'Fully Loaded'.",
				hint: 'Depending on the condition, the execution might be faster or slower.',
				options: [
					{
						name: 'Fully Loaded (Slower)',
						value: 'load',
					},
					{
						name: 'DOM Only Loaded (Faster)',
						value: 'domcontentloaded',
					},
					{
						name: 'All Network Activity Has Stopped',
						value: 'networkidle0',
					},
					{
						name: 'Most Network Activity Has Stopped',
						value: 'networkidle2',
					},
				],
			},
		],
	},
];
