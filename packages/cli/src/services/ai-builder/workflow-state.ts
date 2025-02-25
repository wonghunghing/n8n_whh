import type { BaseMessage } from '@langchain/core/messages';
import { Annotation, END } from '@langchain/langgraph';

import type { SimpleWorkflow } from './types';

export const WorkflowState = Annotation.Root({
	messages: Annotation<BaseMessage[]>({
		reducer: (x, y) => x.concat(y),
	}),
	// The original prompt from the user.
	prompt: Annotation<string>({ reducer: (x, y) => y ?? x ?? '' }),
	// The list of logically derived workflow steps.
	steps: Annotation<string[]>({ reducer: (x, y) => y ?? x ?? [] }),
	// The list of candidate or selected n8n node names.
	nodes: Annotation<string[]>({ reducer: (x, y) => y ?? x ?? [] }),
	// Boolean flag indicating if the user is satisfied with the current workflow selection.
	userReview: Annotation<boolean>({ reducer: (x, y) => y ?? x ?? false }),
	// The JSON representation of the workflow being built.
	workflowJSON: Annotation<SimpleWorkflow>({
		reducer: (x, y) => y ?? x ?? { nodes: [], connections: {} },
	}),
	// The next phase to be executed in the workflow graph.
	next: Annotation<string>({ reducer: (x, y) => y ?? x ?? END, default: () => END }),
});

export function escapeSingleCurlyBrackets(text?: string): string | undefined {
	if (text === undefined) return undefined;

	let result = text;

	result = result
		// First handle triple brackets to avoid interference with double brackets
		.replace(/(?<!{){{{(?!{)/g, '{{{{')
		.replace(/(?<!})}}}(?!})/g, '}}}}')
		// Then handle single brackets, but only if they're not part of double brackets
		// Convert single { to {{ if it's not already part of {{ or {{{
		.replace(/(?<!{){(?!{)/g, '{{')
		// Convert single } to }} if it's not already part of }} or }}}
		.replace(/(?<!})}(?!})/g, '}}');

	return result;
}
