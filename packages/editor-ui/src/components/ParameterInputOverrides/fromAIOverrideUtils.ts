import {
	extractFromAICalls,
	FROM_AI_AUTO_GENERATED_MARKER,
	type INodeTypeDescription,
	type NodeParameterValueType,
	type NodePropertyTypes,
} from 'n8n-workflow';
import { i18n } from '@/plugins/i18n';

export type OverrideContext = {
	parameter: {
		name: string;
		displayName: string;
		type: NodePropertyTypes;
		noDataExpression?: boolean;
		typeOptions?: { editor?: string };
	};
	value: NodeParameterValueType;
	path: string;
};

type ExtraPropValue = {
	initialValue: string;
	tooltip: string;
	type: NodePropertyTypes;
	typeOptions?: { rows?: number };
};

type FromAIExtraProps = 'description';

export type FromAIOverride = {
	type: 'fromAI';
	readonly extraProps: Record<FromAIExtraProps, ExtraPropValue>;
	extraPropValues: Partial<Record<string, NodeParameterValueType>>;
};

function sanitizeFromAiParameterName(s: string) {
	s = s.replace(/[^a-zA-Z0-9\-]/g, '_');

	if (s.length >= 64) {
		s = s.slice(0, 63);
	}

	return s;
}

const NODE_DENYLIST = ['toolCode', 'toolHttpRequest'];

const PATH_DENYLIST = [
	'parameters.name',
	'parameters.description',
	// This is used in e.g. the telegram node if the dropdown selects manual mode
	'parameters.toolDescription',
];

export const fromAIExtraProps: Record<FromAIExtraProps, ExtraPropValue> = {
	description: {
		initialValue: '',
		type: 'string',
		typeOptions: { rows: 2 },
		tooltip: i18n.baseText('parameterOverride.descriptionTooltip'),
	},
};

function isExtraPropKey(
	extraProps: FromAIOverride['extraProps'],
	key: PropertyKey,
): key is keyof FromAIOverride['extraProps'] {
	return extraProps.hasOwnProperty(key);
}

export function updateExtraPropValues(override: FromAIOverride, expr: string) {
	const { extraProps, extraPropValues } = override;
	const overrides = parseOverrides(expr);
	if (overrides) {
		for (const [key, value] of Object.entries(overrides)) {
			if (isExtraPropKey(extraProps, key)) {
				if (extraProps[key].initialValue === value) {
					delete extraPropValues[key];
				} else {
					extraPropValues[key] = value;
				}
			}
		}
	}
}

function fieldTypeToFromAiType(propType: NodePropertyTypes) {
	switch (propType) {
		case 'boolean':
		case 'number':
		case 'json':
			return propType;
		default:
			return 'string';
	}
}

export function isOverrideValue(s: string) {
	return s.startsWith(`={{ ${FROM_AI_AUTO_GENERATED_MARKER} $fromAI(`);
}

export function buildValueFromOverride(
	override: FromAIOverride,
	props: Pick<OverrideContext, 'parameter'>,
	includeMarker: boolean,
) {
	const { extraPropValues, extraProps } = override;
	const marker = includeMarker ? `${FROM_AI_AUTO_GENERATED_MARKER} ` : '';
	const key = sanitizeFromAiParameterName(props.parameter.displayName);
	const description =
		extraPropValues?.description?.toString() ?? extraProps.description.initialValue;
	// We want to escape these characters here as the generated formula needs to be valid JS code, and we risk
	// closing the string prematurely without it.
	// If we don't escape \ then 'my \` description' as user input would end up as 'my \\` description'
	// in the generated code, causing an unescaped backtick to close the string.
	const sanitizedDescription = description.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
	const type = fieldTypeToFromAiType(props.parameter.type);

	return `={{ ${marker}$fromAI('${key}', \`${sanitizedDescription}\`, '${type}') }}`;
}

export function parseOverrides(
	s: string,
): Record<keyof FromAIOverride['extraProps'], string | undefined> | null {
	try {
		// `extractFromAICalls` has different escape semantics from JS strings
		// Specifically it makes \ escape any following character.
		// So we need to escape our \ so we don't drop them accidentally
		const calls = extractFromAICalls(s.replaceAll(/\\/g, '\\\\'));
		if (calls.length === 1) {
			return {
				description: calls[0].description,
			};
		}
	} catch (e) {}

	return null;
}

export function canBeContentOverride(
	props: Pick<OverrideContext, 'path' | 'parameter'>,
	nodeType: INodeTypeDescription | null,
) {
	if (NODE_DENYLIST.some((x) => nodeType?.name?.endsWith(x) ?? false)) return false;

	if (PATH_DENYLIST.includes(props.path)) return false;

	const codex = nodeType?.codex;
	if (!codex?.categories?.includes('AI') || !codex?.subcategories?.AI?.includes('Tools'))
		return false;

	return !props.parameter.noDataExpression && 'options' !== props.parameter.type;
}

export function makeOverrideValue(
	context: OverrideContext,
	nodeType: INodeTypeDescription | null | undefined,
): FromAIOverride | null {
	if (!nodeType) return null;

	if (canBeContentOverride(context, nodeType)) {
		const fromAiOverride: FromAIOverride = {
			type: 'fromAI',
			extraProps: fromAIExtraProps,
			extraPropValues: {},
		};
		updateExtraPropValues(fromAiOverride, context.value?.toString() ?? '');
		return fromAiOverride;
	}

	return null;
}
