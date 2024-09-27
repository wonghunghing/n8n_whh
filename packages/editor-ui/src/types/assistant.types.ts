import { VIEWS } from '@/constants';
import type { Schema } from '@/Interface';
import type {
	ICredentialType,
	IDataObject,
	INode,
	INodeIssues,
	INodeParameters,
} from 'n8n-workflow';

export namespace ChatRequest {
	export interface NodeExecutionSchema {
		nodeName: string;
		schema: Schema;
	}

	export interface WorkflowContext {
		executionSchema?: NodeExecutionSchema[];
	}

	export interface ErrorContext {
		error: {
			name: string;
			message: string;
			type?: string;
			description?: string | null;
			lineNumber?: number;
			stack?: string;
		};
		node: INode;
		nodeInputData?: IDataObject;
	}

	export interface InitErrorHelper extends ErrorContext, WorkflowContext {
		role: 'user';
		type: 'init-error-helper';
		user: {
			firstName: string;
		};
		authType?: { name: string; value: string };
	}

	export interface InitSupportChat {
		role: 'user';
		type: 'init-support-chat';
		user: {
			firstName: string;
		};
		context?: UserContext;
		question: string;
	}

	export interface InitCredHelp {
		role: 'user';
		type: 'init-cred-help';
		user: {
			firstName: string;
		};
		question: string;
		credentialType: {
			name: string;
			displayName: string;
		};
	}

	export type InteractionEventName = 'node-execution-succeeded' | 'node-execution-errored';

	interface EventRequestPayload {
		role: 'user';
		type: 'event';
		eventName: InteractionEventName;
		error?: ErrorContext['error'];
	}

	export interface UserChatMessage {
		role: 'user';
		type: 'message';
		text: string;
		quickReplyType?: string;
		context?: UserContext;
	}

	export interface UserContext {
		activeNodeInfo?: {
			node?: INode;
			nodeIssues?: INodeIssues;
			executionStatus?: {
				status: string;
				error?: ErrorContext['error'];
			};
		};
		activeCredentials?: Pick<ICredentialType, 'name' | 'displayName'>;
		currentView: VIEWS;
	}

	export type RequestPayload =
		| {
				payload: InitErrorHelper | InitSupportChat | InitCredHelp;
		  }
		| {
				payload: EventRequestPayload | UserChatMessage;
				sessionId: string;
		  };

	interface CodeDiffMessage {
		role: 'assistant';
		type: 'code-diff';
		description?: string;
		codeDiff?: string;
		suggestionId: string;
		solution_count: number;
	}

	interface QuickReplyOption {
		text: string;
		type: string;
		isFeedback?: boolean;
	}

	interface AssistantChatMessage {
		role: 'assistant';
		type: 'message';
		text: string;
		step?: 'n8n_documentation' | 'n8n_forum';
		codeSnippet?: string;
	}

	interface AssistantSummaryMessage {
		role: 'assistant';
		type: 'summary';
		title: string;
		content: string;
	}

	interface EndSessionMessage {
		role: 'assistant';
		type: 'event';
		eventName: 'end-session';
	}

	interface AgentChatMessage {
		role: 'assistant';
		type: 'agent-suggestion';
		title: string;
		text: string;
	}

	interface AgentThinkingStep {
		role: 'assistant';
		type: 'intermediate-step';
		text: string;
		step: string;
	}

	export type MessageResponse =
		| ((
				| AssistantChatMessage
				| CodeDiffMessage
				| AssistantSummaryMessage
				| AgentChatMessage
				| AgentThinkingStep
		  ) & {
				quickReplies?: QuickReplyOption[];
		  })
		| EndSessionMessage;

	export interface ResponsePayload {
		sessionId?: string;
		messages: MessageResponse[];
	}
}

export namespace ReplaceCodeRequest {
	export interface RequestPayload {
		sessionId: string;
		suggestionId: string;
	}

	export interface ResponsePayload {
		sessionId: string;
		parameters: INodeParameters;
	}
}
