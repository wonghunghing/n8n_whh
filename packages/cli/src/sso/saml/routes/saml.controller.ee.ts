import express from 'express';
import { issueCookie } from '@/auth/jwt';
import { AuthError } from '@/ResponseHelper';
import { samlEnabledMiddleware } from '../middleware/samlEnabledMiddleware';
import { SamlService } from '../saml.service.ee';
import { LoggerProxy } from 'n8n-workflow';
import { SamlUrls } from '../constants';

/**
 * SSO Endpoints that are protected by samlEnabledMiddleware require
 * both isSamlEnabled and isSamlCurrentAuthenticationMethod to be true
 */

export const samlController = express.Router();
samlController.use(samlEnabledMiddleware);

/**
 * POST /sso/saml/acs
 * Assertion Consumer Service endpoint
 */
samlController.post(SamlUrls.acs, async (req: express.Request, res: express.Response) => {
	const loginResult = await SamlService.getInstance().handleSamlLogin(req);
	if (loginResult) {
		if (loginResult.authenticatedUser) {
			await issueCookie(res, loginResult.authenticatedUser);
			if (loginResult.onboardingRequired) {
				LoggerProxy.debug('// TODO:SAML: redirect to user saml onboarding page');
				return res.redirect('/settings/personal');
			} else {
				return res.redirect('/');
			}
		}
	}
	throw new AuthError('SAML Authentication failed');
});

/**
 * GET /sso/saml/initsso
 * Access URL for implementing SP-init SSO
 */
samlController.get(SamlUrls.initSSO, async (req: express.Request, res: express.Response) => {
	const url = SamlService.getInstance().getRedirectLoginRequestUrl();
	if (url) {
		return res.redirect(url);
	} else {
		throw new AuthError('SAML redirect failed, please check your SAML configuration.');
	}
});
