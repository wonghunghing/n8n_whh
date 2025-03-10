import { ApplicationError, jsonParse } from 'n8n-workflow';
import { z } from 'zod';
import { Z } from 'zod-class';

const VALID_SELECT_FIELDS = [
	'id',
	'name',
	'createdAt',
	'updatedAt',
	'project',
	'tags',
	'parentFolder',
	'workflowCount',
] as const;

const VALID_SORT_OPTIONS = [
	'name:asc',
	'name:desc',
	'createdAt:asc',
	'createdAt:desc',
	'updatedAt:asc',
	'updatedAt:desc',
] as const;

// Filter schema - only allow specific properties
export const filterSchema = z
	.object({
		parentFolderId: z.string().optional(),
		name: z.string().optional(),
		tags: z.array(z.string()).optional(),
	})
	.strict();

// Common transformers
const parseJsonArray = (val: string): unknown => {
	if (!val.trim().startsWith('[')) {
		throw new ApplicationError('Expected a JSON array starting with [');
	}
	return jsonParse(val);
};

const isArrayOfStrings = (val: unknown): val is string[] => {
	return Array.isArray(val) && val.every((item) => typeof item === 'string');
};

// ---------------------
// Parameter Validators
// ---------------------

// Filter parameter validation
const filterValidator = z
	.string()
	.optional()
	.transform((val, ctx) => {
		if (!val) return undefined;
		try {
			const parsed: unknown = jsonParse(val);
			try {
				return filterSchema.parse(parsed);
			} catch (e) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Invalid filter fields',
					path: ['filter'],
				});
				return z.NEVER;
			}
		} catch (e) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Invalid filter format',
				path: ['filter'],
			});
			return z.NEVER;
		}
	});

// Skip parameter validation
const skipValidator = z
	.string()
	.optional()
	.transform((val) => (val ? parseInt(val, 10) : 0))
	.refine((val) => val === undefined || !isNaN(val), {
		message: 'Skip must be a valid number',
	});

// Take parameter validation
const takeValidator = z
	.string()
	.optional()
	.transform((val) => (val ? parseInt(val, 10) : 10))
	.refine((val) => val === undefined || !isNaN(val), {
		message: 'Take must be a valid number',
	});

// Select parameter validation
const selectValidator = z
	.string()
	.optional()
	.superRefine((val, ctx) => {
		if (!val) return;

		try {
			// Parse as JSON array
			const parsed = parseJsonArray(val);

			// Validate it's an array of strings
			if (!isArrayOfStrings(parsed)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Select must be an array of strings',
					path: ['select'],
				});
				return z.NEVER;
			}

			// Validate each field
			for (const field of parsed) {
				if (!VALID_SELECT_FIELDS.includes(field as (typeof VALID_SELECT_FIELDS)[number])) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `Invalid select field: ${field}. Valid fields are: ${VALID_SELECT_FIELDS.join(', ')}`,
						path: ['select'],
					});
					return z.NEVER;
				}
			}
		} catch (e) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Invalid select format',
				path: ['select'],
			});
			return z.NEVER;
		}
	})
	.transform((val) => {
		if (!val) return undefined;

		try {
			const parsed = parseJsonArray(val) as string[];
			const selectObject: Record<string, true> = {};

			for (const field of parsed) {
				if (VALID_SELECT_FIELDS.includes(field as (typeof VALID_SELECT_FIELDS)[number])) {
					selectObject[field] = true;
				}
			}

			return Object.keys(selectObject).length > 0 ? selectObject : undefined;
		} catch (e) {
			return undefined;
		}
	});

// SortBy parameter validation
const sortByValidator = z
	.enum(VALID_SORT_OPTIONS, { message: `sortBy must be one of: ${VALID_SORT_OPTIONS.join(', ')}` })
	.optional();

export class ListFolderQueryDto extends Z.class({
	filter: filterValidator,
	skip: skipValidator,
	take: takeValidator,
	select: selectValidator,
	sortBy: sortByValidator,
}) {}
