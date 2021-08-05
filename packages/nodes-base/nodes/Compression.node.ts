import {
	BINARY_ENCODING,
	IExecuteFunctions,
} from 'n8n-core';

import { promises as fs } from 'fs';

import {
	IBinaryKeyData,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import * as fflate from 'fflate';

import { promisify } from 'util';

const gunzip = promisify(fflate.gunzip);
const gzip = promisify(fflate.gzip);
const unzip = promisify(fflate.unzip);
const zip = promisify(fflate.zip);

import * as mime from 'mime-types';

const ALREADY_COMPRESSED = [
	'7z',
	'aifc',
	'bz2',
	'doc',
	'docx',
	'gif',
	'gz',
	'heic',
	'heif',
	'jpg',
	'jpeg',
	'mov',
	'mp3',
	'mp4',
	'pdf',
	'png',
	'ppt',
	'pptx',
	'rar',
	'webm',
	'webp',
	'xls',
	'xlsx',
	'zip',
];

export class Compression implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Compression',
		name: 'compression',
		icon: 'fa:file-archive',
		group: ['transform'],
		subtitle: '={{$parameter["operation"]}}',
		version: 1,
		description: 'Compress and uncompress files',
		defaults: {
			name: 'Compression',
			color: '#408000',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				options: [
					{
						name: 'Compress',
						value: 'compress',
					},
					{
						name: 'Decompress',
						value: 'decompress',
					},
				],
				default: 'decompress',
			},
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						operation: [
							'compress',
							'decompress',
						],
					},

				},
				placeholder: '',
				description: 'Name of the binary property which contains<br />the data for the file(s) to be compress/decompress. Multiple can be used separated by ,',
			},
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'options',
				default: '',
				options: [
					{
						name: 'gzip',
						value: 'gzip',
					},
					{
						name: 'zip',
						value: 'zip',
					},
				],
				displayOptions: {
					show: {
						operation: [
							'compress',
						],
					},
				},
				description: 'Format of the output file',
			},
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: '',
				placeholder: 'data.zip',
				required: true,
				displayOptions: {
					show: {
						operation: [
							'compress',
						],
						outputFormat: [
							'zip',
						],
					},

				},
				description: 'Name of the file to be compressed',
			},
			{
				displayName: 'Binary Property Output',
				name: 'binaryPropertyOutput',
				type: 'string',
				default: 'data',
				required: false,
				displayOptions: {
					show: {
						outputFormat: [
							'zip',
						],
						operation: [
							'compress',
						],
					},
				},
				placeholder: '',
				description: 'Name of the binary property to which to<br />write the data of the compressed files.',
			},
			{
				displayName: 'Output Prefix',
				name: 'outputPrefix',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						operation: [
							'compress',
						],
						outputFormat: [
							'gzip',
						],
					},
				},
				description: 'Prefix use for all gzip compresed files',
			},
			{
				displayName: 'Output Prefix',
				name: 'outputPrefix',
				type: 'string',
				default: 'file_',
				required: true,
				displayOptions: {
					show: {
						operation: [
							'decompress',
						],
					},
				},
				description: 'Prefix use for all decompressed files',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const length = items.length as unknown as number;
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < length; i++) {

			if (operation === 'decompress') {
				const binaryPropertyNames = (this.getNodeParameter('binaryPropertyName', 0) as string).split(',').map(key => key.trim());

				const outputPrefix = this.getNodeParameter('outputPrefix', 0) as string;

				const binaryObject: IBinaryKeyData = {};

				let zipIndex = 0;

				for (const [index, binaryPropertyName] of binaryPropertyNames.entries()) {
					if (items[i].binary === undefined) {
						throw new NodeOperationError(this.getNode(), 'No binary data exists on item!');
					}
					//@ts-ignore
					if (items[i].binary[binaryPropertyName] === undefined) {
						throw new NodeOperationError(this.getNode(), `No binary data property "${binaryPropertyName}" does not exists on item!`);
					}
					
					const binaryData = (items[i].binary as IBinaryKeyData)[binaryPropertyName];
					const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(binaryData);

					if (binaryData.fileExtension === 'zip') {
						const files = await unzip(binaryDataBuffer);

						for (const key of Object.keys(files)) {
							// when files are compresed using MACOSX for some reason they are duplicated under __MACOSX
							if (key.includes('__MACOSX')) {
								continue;
							}

							const data = await this.helpers.prepareBinaryData(Buffer.from(files[key].buffer), key);

							binaryObject[`${outputPrefix}${zipIndex++}`] = data;
						}
					} else if (binaryData.fileExtension === 'gz') {
						const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(binaryData);
						const file = await gunzip(binaryDataBuffer);

						const fileName = binaryData.fileName?.split('.')[0];

						const propertyName = `${outputPrefix}${index}`;

						binaryObject[propertyName] = await this.helpers.prepareBinaryData(Buffer.from(file.buffer), fileName);
						const fileExtension = mime.extension(binaryObject[propertyName].mimeType) as string;
						binaryObject[propertyName].fileName = `${fileName}.${fileExtension}`;
						binaryObject[propertyName].fileExtension = fileExtension;
					}
				}

				returnData.push({
					json: items[i].json,
					binary: binaryObject,
				});
			}

			if (operation === 'compress') {
				const binaryPropertyNames = (this.getNodeParameter('binaryPropertyName', 0) as string).split(',').map(key => key.trim());

				const outputFormat = this.getNodeParameter('outputFormat', 0) as string;

				const zipData: fflate.Zippable = {};

				const binaryObject: IBinaryKeyData = {};

				for (const [index, binaryPropertyName] of binaryPropertyNames.entries()) {

					if (items[i].binary === undefined) {
						throw new NodeOperationError(this.getNode(), 'No binary data exists on item!');
					}
					//@ts-ignore
					if (items[i].binary[binaryPropertyName] === undefined) {
						throw new NodeOperationError(this.getNode(), `No binary data property "${binaryPropertyName}" does not exists on item!`);
					}

					const binaryData = (items[i].binary as IBinaryKeyData)[binaryPropertyName];

					if (outputFormat === 'zip') {
						const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(binaryData);
						zipData[binaryData.fileName as string] = [
							binaryDataBuffer, {
								level: ALREADY_COMPRESSED.includes(binaryData.fileExtension as string) ? 0 : 6,
							},
						];

					} else if (outputFormat === 'gzip') {
						const outputPrefix = this.getNodeParameter('outputPrefix', 0) as string;

						const data = await gzip(Buffer.from(binaryData.data, BINARY_ENCODING)) as Uint8Array;

						const fileName = binaryData.fileName?.split('.')[0];

						binaryObject[`${outputPrefix}${index}`] = await this.helpers.prepareBinaryData(Buffer.from(data), `${fileName}.gzip`);
					}
				}

				if (outputFormat === 'zip') {
					const fileName = this.getNodeParameter('fileName', 0) as string;

					const binaryPropertyOutput = this.getNodeParameter('binaryPropertyOutput', 0) as string;

					const buffer = await zip(zipData);

					const data = await this.helpers.prepareBinaryData(Buffer.from(buffer), fileName);

					returnData.push({
						json: items[i].json,
						binary: {
							[binaryPropertyOutput]: data,
						},
					});
				}

				if (outputFormat === 'gzip') {
					returnData.push({
						json: items[i].json,
						binary: binaryObject,
					});
				}
			}
		}

		return this.prepareOutputData(returnData);
	}
}
