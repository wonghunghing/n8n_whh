import { CreateOrUpdateApiKeyRequestDto } from '@n8n/api-types';

import { ApiKeyRepository } from '@/databases/repositories/api-key.repository';
import { Body, Delete, Get, Param, Patch, Post, RestController } from '@/decorators';
import { BadRequestError } from '@/errors/response-errors/bad-request.error';
import { EventService } from '@/events/event.service';
import { License } from '@/license';
import { AuthenticatedRequest } from '@/requests';
import { PublicApiKeyService } from '@/services/public-api-key.service';

@RestController('/api-keys')
export class ApiKeysController {
	constructor(
		private readonly eventService: EventService,
		private readonly publicApiKeyService: PublicApiKeyService,
		private readonly apiKeysRepository: ApiKeyRepository,
		private readonly license: License,
	) {}

	/**
	 * Create an API Key
	 */
	@Post('/')
	async createAPIKey(
		req: AuthenticatedRequest,
		_res: Response,
		@Body payload: CreateOrUpdateApiKeyRequestDto,
	) {
		const currentNumberOfApiKeys = await this.apiKeysRepository.countBy({ userId: req.user.id });

		if (currentNumberOfApiKeys >= this.license.getApiKeysLimit()) {
			throw new BadRequestError('You have reached the maximum number of API keys allowed.');
		}

		const newApiKey = await this.publicApiKeyService.createPublicApiKeyForUser(req.user, {
			withLabel: payload.label,
		});

		this.eventService.emit('public-api-key-created', { user: req.user, publicApi: false });

		return newApiKey;
	}

	/**
	 * Get API keys
	 */
	@Get('/')
	async getAPIKeys(req: AuthenticatedRequest) {
		const apiKeys = await this.publicApiKeyService.getRedactedApiKeysForUser(req.user);
		return apiKeys;
	}

	/**
	 * Delete an API Key
	 */
	@Delete('/:id')
	async deleteAPIKey(req: AuthenticatedRequest, _res: Response, @Param('id') apiKeyId: string) {
		await this.publicApiKeyService.deleteApiKeyForUser(req.user, apiKeyId);

		this.eventService.emit('public-api-key-deleted', { user: req.user, publicApi: false });

		return { success: true };
	}

	/**
	 * Patch an API Key
	 */
	@Patch('/:id')
	async updateAPIKey(
		req: AuthenticatedRequest,
		_res: Response,
		@Param('id') apiKeyId: string,
		@Body payload: CreateOrUpdateApiKeyRequestDto,
	) {
		await this.publicApiKeyService.updateApiKeyForUser(req.user, apiKeyId, {
			label: payload.label,
		});

		return { success: true };
	}
}
