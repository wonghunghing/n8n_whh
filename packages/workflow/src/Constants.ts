export const BINARY_ENCODING = 'base64';
export const WAIT_TIME_UNLIMITED = '3000-01-01T00:00:00.000Z';

export const LOG_LEVELS = ['silent', 'error', 'warn', 'info', 'debug', 'verbose'] as const;

export const CONNECTION_TYPES = [
	'ai_agent',
	'ai_chain',
	'ai_document',
	'ai_embedding',
	'ai_languageModel',
	'ai_memory',
	'ai_outputParser',
	'ai_retriever',
	'ai_textSplitter',
	'ai_tool',
	'ai_vectorRetriever',
	'ai_vectorStore',
	'main',
] as const;

export const CODE_LANGUAGES = ['javaScript', 'json', 'python'] as const;
export const CODE_EXECUTION_MODES = ['runOnceForAllItems', 'runOnceForEachItem'] as const;

/**
 * Nodes whose parameter values may refer to other nodes without expressions.
 * Their content may need to be updated when the referenced node is renamed.
 */
export const NODES_WITH_RENAMABLE_CONTENT = new Set([
	'n8n-nodes-base.code',
	'n8n-nodes-base.function',
	'n8n-nodes-base.functionItem',
]);

// Arbitrary value to represent an empty credential value
export const CREDENTIAL_EMPTY_VALUE =
	'__n8n_EMPTY_VALUE_7b1af746-3729-4c60-9b9b-e08eb29e58da' as const;

export const FORM_TRIGGER_PATH_IDENTIFIER = 'n8n-form';
