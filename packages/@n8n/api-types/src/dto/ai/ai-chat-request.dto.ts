import type { AiAssistantSDK } from '@n8n_io/ai-assistant-sdk';
import { z } from 'zod';
import { Z } from 'zod-class';

export class AiChatRequestDto
	extends Z.class({
		payload: z.object({}).passthrough(), // Allow any object shape
		sessionId: z.string().optional(),
	})
	implements AiAssistantSDK.ChatRequestPayload {}

export class AiBuilderChatRequestDto extends Z.class({
	payload: z.object({
		question: z.string(),
		context: z.object({
			currentWorkflow: z.object({}).passthrough(),
		}),
	}),
}) {}
