import type { Functionality, IDataObject, JsonObject } from '../../Interfaces';
import { ApplicationError } from '../application.error';
import type { ReportingOptions } from '../error.types';

interface ExecutionBaseErrorOptions extends ReportingOptions {
	cause?: Error;
	errorResponse?: JsonObject;
}

export abstract class ExecutionBaseError extends ApplicationError {
	description: string | null | undefined;

	cause?: Error;

	errorResponse?: JsonObject;

	timestamp: number;

	context: IDataObject = {};

	lineNumber: number | undefined;

	functionality: Functionality = 'regular';

	constructor(message: string, options: ExecutionBaseErrorOptions = {}) {
		super(message, options);

		// TODO: write test, fixes:
		// `Cannot assign to read only property 'name' of object 'Error...`
		Object.defineProperty(this, 'name', { value: this.constructor.name });
		this.timestamp = Date.now();

		const { cause, errorResponse } = options;
		if (cause instanceof ExecutionBaseError) {
			this.context = cause.context;
		} else if (cause && !(cause instanceof Error)) {
			this.cause = cause;
		}

		if (errorResponse) this.errorResponse = errorResponse;
	}

	toJSON?() {
		return {
			message: this.message,
			lineNumber: this.lineNumber,
			timestamp: this.timestamp,
			name: this.name,
			description: this.description,
			context: this.context,
			cause: this.cause,
		};
	}
}
