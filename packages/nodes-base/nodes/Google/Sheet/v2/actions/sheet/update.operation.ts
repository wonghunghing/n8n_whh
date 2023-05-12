import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import type {
	ISheetUpdateData,
	SheetProperties,
	ValueInputOption,
	ValueRenderOption,
} from '../../helpers/GoogleSheets.types';
import { NodeOperationError } from 'n8n-workflow';
import type { GoogleSheet } from '../../helpers/GoogleSheet';
import { untilSheetSelected } from '../../helpers/GoogleSheets.utils';
import { cellFormat, handlingExtraData, locationDefine } from './commonDescription';

export const description: SheetProperties = [
	{
		displayName: 'Data Mode',
		name: 'dataMode',
		type: 'options',
		options: [
			{
				name: 'Auto-Map Input Data to Columns',
				value: 'autoMapInputData',
				description: 'Use when node input properties match destination column names',
			},
			{
				name: 'Map Each Column Below',
				value: 'defineBelow',
				description: 'Set the value for each destination column',
			},
			{
				name: 'Nothing',
				value: 'nothing',
				description: 'Do not send anything',
			},
		],
		displayOptions: {
			show: {
				resource: ['sheet'],
				operation: ['update'],
				'@version': [3],
			},
			hide: {
				...untilSheetSelected,
			},
		},
		default: 'defineBelow',
		description: 'Whether to insert the input data this node receives in the new row',
	},
	{
		// eslint-disable-next-line n8n-nodes-base/node-param-display-name-miscased, n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
		displayName: 'Column to match on',
		name: 'columnToMatchOn',
		type: 'options',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
		typeOptions: {
			loadOptionsDependsOn: ['sheetName.value'],
			loadOptionsMethod: 'getSheetHeaderRowAndSkipEmpty',
		},
		default: '',
		hint: "Used to find the correct row to update. Doesn't get changed.",
		displayOptions: {
			show: {
				resource: ['sheet'],
				operation: ['update'],
				'@version': [3],
			},
			hide: {
				...untilSheetSelected,
			},
		},
	},
	{
		displayName: 'Value of Column to Match On',
		name: 'valueToMatchOn',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['sheet'],
				operation: ['update'],
				dataMode: ['defineBelow'],
				'@version': [3],
			},
			hide: {
				...untilSheetSelected,
			},
		},
	},
	{
		displayName: 'Values to Send',
		name: 'fieldsUi',
		placeholder: 'Add Field',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		displayOptions: {
			show: {
				resource: ['sheet'],
				operation: ['update'],
				dataMode: ['defineBelow'],
				'@version': [3],
			},
			hide: {
				...untilSheetSelected,
			},
		},
		default: {},
		options: [
			{
				displayName: 'Field',
				name: 'values',
				values: [
					{
						// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
						displayName: 'Column',
						name: 'column',
						type: 'options',
						description:
							'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code-examples/expressions/">expression</a>',
						typeOptions: {
							loadOptionsDependsOn: ['sheetName.value', 'columnToMatchOn'],
							loadOptionsMethod: 'getSheetHeaderRowAndAddColumn',
						},
						default: '',
					},
					{
						displayName: 'Column Name',
						name: 'columnName',
						type: 'string',
						default: '',
						displayOptions: {
							show: {
								column: ['newColumn'],
							},
						},
					},
					{
						displayName: 'Value',
						name: 'fieldValue',
						type: 'string',
						default: '',
					},
				],
			},
		],
	},
	{
		displayName: 'Columns',
		name: 'columns',
		type: 'resourceMapper',
		noDataExpression: true,
		default: {
			mappingMode: 'defineBelow',
			value: null,
		},
		required: true,
		typeOptions: {
			loadOptionsDependsOn: ['sheetName.value'],
			resourceMapper: {
				resourceMapperMethod: 'getMappingColumns',
				mode: 'update',
				fieldWords: {
					singular: 'column',
					plural: 'columns',
				},
				addAllFields: true,
				noFieldsError: 'No columns found in sheet.',
				multiKeyMatch: false,
				matchingFieldsLabels: {
					title: 'Custom matching columns title',
					description: 'Custom matching columns description',
					hint: 'Custom matching columns hint',
				},
			},
		},
		displayOptions: {
			show: {
				resource: ['sheet'],
				operation: ['update'],
				'@version': [4],
			},
			hide: {
				...untilSheetSelected,
			},
		},
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['sheet'],
				operation: ['update'],
			},
			hide: {
				...untilSheetSelected,
			},
		},
		options: [...cellFormat, ...locationDefine, ...handlingExtraData],
	},
];

export async function execute(
	this: IExecuteFunctions,
	sheet: GoogleSheet,
	sheetName: string,
): Promise<INodeExecutionData[]> {
	const items = this.getInputData();
	const valueInputMode = this.getNodeParameter('options.cellFormat', 0, 'RAW') as ValueInputOption;
	const range = `${sheetName}!A:Z`;

	const options = this.getNodeParameter('options', 0, {});

	const valueRenderMode = (options.valueRenderMode || 'UNFORMATTED_VALUE') as ValueRenderOption;

	const locationDefineOptions = (options.locationDefine as IDataObject)?.values as IDataObject;

	const nodeVersion = this.getNode().typeVersion;

	let headerRow = 0;
	let firstDataRow = 1;

	if (locationDefineOptions) {
		if (locationDefineOptions.headerRow) {
			headerRow = parseInt(locationDefineOptions.headerRow as string, 10) - 1;
		}
		if (locationDefineOptions.firstDataRow) {
			firstDataRow = parseInt(locationDefineOptions.firstDataRow as string, 10) - 1;
		}
	}

	let columnNames: string[] = [];

	const sheetData = await sheet.getData(sheetName, 'FORMATTED_VALUE');

	if (sheetData === undefined || sheetData[headerRow] === undefined) {
		throw new NodeOperationError(
			this.getNode(),
			`Could not retrieve the column names from row ${headerRow + 1}`,
		);
	}

	columnNames = sheetData[headerRow];
	const newColumns = new Set<string>();

	const columnsToMatchOn: string[] =
		nodeVersion < 4
			? [this.getNodeParameter('columnToMatchOn', 0) as string]
			: (this.getNodeParameter('columns.matchingColumns', 0) as string[]);

	const dataMode =
		nodeVersion < 4
			? (this.getNodeParameter('dataMode', 0) as string)
			: (this.getNodeParameter('columns.mappingMode', 0) as string);

	// TODO: Add support for multiple columns to match on in the next overhaul
	const keyIndex = columnNames.indexOf(columnsToMatchOn[0]);

	const columnValues = await sheet.getColumnValues(
		range,
		keyIndex,
		firstDataRow,
		valueRenderMode,
		sheetData,
	);

	const updateData: ISheetUpdateData[] = [];

	const mappedValues: IDataObject[] = [];

	for (let i = 0; i < items.length; i++) {
		if (dataMode === 'nothing') continue;

		const data: IDataObject[] = [];

		if (dataMode === 'autoMapInputData') {
			const handlingExtraDataOption = (options.handlingExtraData as string) || 'insertInNewColumn';
			if (handlingExtraDataOption === 'ignoreIt') {
				data.push(items[i].json);
			}
			if (handlingExtraDataOption === 'error') {
				Object.keys(items[i].json).forEach((key) => {
					if (!columnNames.includes(key)) {
						throw new NodeOperationError(this.getNode(), 'Unexpected fields in node input', {
							itemIndex: i,
							description: `The input field '${key}' doesn't match any column in the Sheet. You can ignore this by changing the 'Handling extra data' field, which you can find under 'Options'.`,
						});
					}
				});
				data.push(items[i].json);
			}
			if (handlingExtraDataOption === 'insertInNewColumn') {
				Object.keys(items[i].json).forEach((key) => {
					if (!columnNames.includes(key)) {
						newColumns.add(key);
					}
				});
				data.push(items[i].json);
			}
		} else {
			const valueToMatchOn =
				nodeVersion < 4
					? (this.getNodeParameter('valueToMatchOn', i) as string)
					: (this.getNodeParameter(`columns.value[${columnsToMatchOn[0]}]`, i) as string);

			if (nodeVersion < 4) {
				const valuesToSend = this.getNodeParameter('fieldsUi.values', i, []) as IDataObject[];
				if (!valuesToSend?.length) {
					throw new NodeOperationError(
						this.getNode(),
						"At least one value has to be added under 'Values to Send'",
					);
				}
				const fields = valuesToSend.reduce((acc, entry) => {
					if (entry.column === 'newColumn') {
						const columnName = entry.columnName as string;

						if (!columnNames.includes(columnName)) {
							newColumns.add(columnName);
						}

						acc[columnName] = entry.fieldValue as string;
					} else {
						acc[entry.column as string] = entry.fieldValue as string;
					}
					return acc;
				}, {} as IDataObject);

				fields[columnsToMatchOn[0]] = valueToMatchOn;

				data.push(fields);
			} else {
				const mappingValues = this.getNodeParameter('columns.value', i) as IDataObject;
				if (Object.keys(mappingValues).length === 0) {
					throw new NodeOperationError(
						this.getNode(),
						"At least one value has to be added under 'Values to Send'",
					);
				}
				data.push(mappingValues);
				mappedValues.push(mappingValues);
			}
		}

		if (newColumns.size) {
			await sheet.updateRows(
				sheetName,
				[columnNames.concat([...newColumns])],
				(options.cellFormat as ValueInputOption) || 'RAW',
				headerRow + 1,
			);
		}

		const preparedData = await sheet.prepareDataForUpdateOrUpsert(
			data,
			columnsToMatchOn[0],
			range,
			headerRow,
			firstDataRow,
			valueRenderMode,
			false,
			[columnNames.concat([...newColumns])],
			columnValues,
		);

		updateData.push(...preparedData.updateData);
	}

	if (updateData.length) {
		await sheet.batchUpdate(updateData, valueInputMode);
	}

	if (nodeVersion < 4 || dataMode === 'autoMapInputData') {
		return items;
	} else {
		return this.helpers.returnJsonArray(mappedValues);
	}
}
