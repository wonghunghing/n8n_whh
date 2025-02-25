import {
	AiChatRequestDto,
	AiApplySuggestionRequestDto,
	AiAskRequestDto,
	AiFreeCreditsRequestDto,
	AiBuilderChatRequestDto,
} from '@n8n/api-types';
import type { AiAssistantSDK } from '@n8n_io/ai-assistant-sdk';
import { Response } from 'express';
import type { IWorkflowBase } from 'n8n-workflow';
import { OPEN_AI_API_CREDENTIAL_TYPE } from 'n8n-workflow';
import { strict as assert } from 'node:assert';
import { WritableStream } from 'node:stream/web';

import { FREE_AI_CREDITS_CREDENTIAL_NAME } from '@/constants';
import { CredentialsService } from '@/credentials/credentials.service';
import { Body, Post, RestController } from '@/decorators';
import { InternalServerError } from '@/errors/response-errors/internal-server.error';
import type { CredentialRequest } from '@/requests';
import { AuthenticatedRequest } from '@/requests';
import { AiBuilderService } from '@/services/ai-builder/ai-builder.service';
import { AiService } from '@/services/ai.service';
import { UserService } from '@/services/user.service';

export type FlushableResponse = Response & { flush: () => void };

@RestController('/ai')
export class AiController {
	constructor(
		private readonly aiService: AiService,
		private readonly aiBuilderService: AiBuilderService,
		private readonly credentialsService: CredentialsService,
		private readonly userService: UserService,
	) {}

	@Post('/build', { rateLimit: { limit: 100 } })
	async build(
		req: AuthenticatedRequest,
		res: FlushableResponse,
		@Body payload: AiBuilderChatRequestDto,
	) {
		try {
			const aiResponse = this.aiBuilderService.chat(
				{
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
					question: payload.payload.question ?? '',
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
					currentWorkflow: payload.payload.context.currentWorkflow as IWorkflowBase,
				},
				req.user,
			);

			res.header('Content-type', 'application/json-lines').flush();

			// Handle the stream
			for await (const chunk of aiResponse) {
				res.flush();
				res.write(JSON.stringify(chunk) + '⧉⇋⇋➽⌑⧉§§\n');
			}

			// Send end event
			// res.write(JSON.stringify({ type: 'done' }) + '⧉⇋⇋➽⌑⧉§§\n');
			res.end();
		} catch (e) {
			console.error('Stream error:', e);
			assert(e instanceof Error);
			throw new InternalServerError(e.message, e);
		}
	}

	@Post('/chat', { rateLimit: { limit: 100 } })
	async chat(req: AuthenticatedRequest, res: FlushableResponse, @Body payload: AiChatRequestDto) {
		try {
			const aiResponse = await this.aiService.chat(payload, req.user);
			if (aiResponse.body) {
				res.header('Content-type', 'application/json-lines').flush();
				await aiResponse.body.pipeTo(
					new WritableStream({
						write(chunk) {
							res.write(chunk);
							res.flush();
						},
					}),
				);
				res.end();
			}
		} catch (e) {
			assert(e instanceof Error);
			throw new InternalServerError(e.message, e);
		}
	}

	@Post('/chat/apply-suggestion')
	async applySuggestion(
		req: AuthenticatedRequest,
		_: Response,
		@Body payload: AiApplySuggestionRequestDto,
	): Promise<AiAssistantSDK.ApplySuggestionResponse> {
		try {
			return await this.aiService.applySuggestion(payload, req.user);
		} catch (e) {
			assert(e instanceof Error);
			throw new InternalServerError(e.message, e);
		}
	}

	@Post('/ask-ai')
	async askAi(
		req: AuthenticatedRequest,
		_: Response,
		@Body payload: AiAskRequestDto,
	): Promise<AiAssistantSDK.AskAiResponsePayload> {
		try {
			return await this.aiService.askAi(payload, req.user);
		} catch (e) {
			assert(e instanceof Error);
			throw new InternalServerError(e.message, e);
		}
	}

	@Post('/free-credits')
	async aiCredits(req: AuthenticatedRequest, _: Response, @Body payload: AiFreeCreditsRequestDto) {
		try {
			const aiCredits = await this.aiService.createFreeAiCredits(req.user);

			const credentialProperties: CredentialRequest.CredentialProperties = {
				name: FREE_AI_CREDITS_CREDENTIAL_NAME,
				type: OPEN_AI_API_CREDENTIAL_TYPE,
				data: {
					apiKey: aiCredits.apiKey,
					url: aiCredits.url,
				},
				isManaged: true,
				projectId: payload?.projectId,
			};

			const newCredential = await this.credentialsService.createCredential(
				credentialProperties,
				req.user,
			);

			await this.userService.updateSettings(req.user.id, {
				userClaimedAiCredits: true,
			});

			return newCredential;
		} catch (e) {
			assert(e instanceof Error);
			throw new InternalServerError(e.message, e);
		}
	}
}
