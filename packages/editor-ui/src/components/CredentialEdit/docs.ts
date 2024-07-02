export const CREDENTIAL_MARKDOWN_DOCS: Record<string, string> = {
	aws: 'To configure this credential, you\'ll need:\n\n- An <a href="https://aws.amazon.com/" target="_blank">AWS</a> account\n\n- The AWS **Region**: select your region\n- The **Access Key ID**: provided when you generate an access key\n- The **Secret Access Key**: provided when you generate an access key\n\nRefer to the <a href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html" target="_blank">AWS Managing Access Keys documentation</a> for instructions on generating and updating access keys.\n\n## Using a temporary security credential\n\nYou can configure the access key as a temporary security credential by toggling the slider on.\n\nIf you select this option, you must add a **Session token** to the credential.\n\nRefer to the <a href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp.html" target="_blank">AWS Temporary security credential documentation</a> for more information on working with temporary security credentials.\n\n## Virtual Private Cloud usage (custom endpoint)\n\nIf you use <a href="https://aws.amazon.com/vpc/" target="_blank">Amazon Virtual Private Cloud VPC</a> to host n8n, you can establish a connection between your VPC and these apps:\n\n- Rekognition\n- Lambda\n- SNS\n- SES\n- SQS\n- S3\n\nTo use these apps with a custom endpoint, toggle the **Custom endpoint** slider on and add the relevant custom endpoint(s).\n\nIf you don\'t add a custom endpoint, the n8n credential will use the default endpoint.',
	gmailOAuth2:
		'## Prerequisites\n* <a href="https://cloud.google.com/" target="_blank">Google Cloud</a> account\n* <a href="https://developers.google.com/workspace/marketplace/create-gcp-project" target="_blank">Google Cloud Platform project</a>\n* If you haven\'t used OAuth in your Google Cloud project before, you need to <a href="https://developers.google.com/workspace/guides/configure-oauth-consent" target="_blank">configure the OAuth consent screen</a>.\n## Set up OAuth in Google Cloud\n1. Note the **OAuth Redirect URL** from this modal.\n2. Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console | APIs and services</a> and make sure you\'re in the project you want to use.\n![Google project dropdown](https://docs.n8n.io/_images/integrations/builtin/credentials/google/check-google-project.png)\n3. **Optional:** If you haven\'t used OAuth in your Google Cloud project before, you need to <a href="https://developers.google.com/workspace/guides/configure-oauth-consent" target="_blank">configure the OAuth consent screen</a>.\n	1. Select **OAuth consent screen**.\n	2. For **User Type**, select **Internal** for user access within your organization\'s Google workspace or **External** for any user with a Google account.\n	3. Select **Create**.\n	4. Enter the essential information: **App name**, **User support email**, and the **Email addresses** field in **Developer contact information**.\n	5. Add an authorized domain: select **+ ADD DOMAIN**. Enter `n8n.cloud` if using n8n\'s Cloud service, or the domain of your n8n instance if you\'re self-hosting.\n	6. Select **SAVE AND CONTINUE** to go to the **Scopes** page.\n	7. You don\'t need to set any scopes. Select **SAVE AND CONTINUE** again to go to the **Summary** page.\n	8. On the **Summary** page, review the information, then select **BACK TO DASHBOARD**.\n4. Select **+ CREATE CREDENTIALS > OAuth client ID**.\n![Create credentials](https://docs.n8n.io/_images/integrations/builtin/credentials/google/create-credentials.png)\n5. In the **Application type** dropdown, select **Web application**. Google automatically generates a name.\n![Web application](https://docs.n8n.io/_images/integrations/builtin/credentials/google/application-web-application.png)\n6. Under **Authorized redirect URIs**, select **+ ADD URI**. Paste in the OAuth redirect URL from n8n.\n![OAuth Callback URL](https://docs.n8n.io/_images/integrations/builtin/credentials/google/oauth_callback.png) \n![Add URI](https://docs.n8n.io/_images/integrations/builtin/credentials/google/add-uri.png)\n7. Select **CREATE**.\n8. Enable each Google service API that you want to use:\n	1. Access your <a href="https://console.cloud.google.com/apis/library" target="_blank">Google Cloud Console - Library</a>. Make sure you\'re in the correct project.\n	2. Search for and select the API(s) you want to enable. For example, for the Gmail node, search for and enable the Gmail API.\n	3. Select **ENABLE**.\n## Create and test your connection\nIn n8n:\n1. Enter your new **Client ID** and **Client Secret** from Google Cloud Console in the credentials modal.\n2. Select **Sign in with Google** to complete your Google authentication.\n3. **Save** your new credentials.\n## Video\n<div class="video-container">\n<iframe width="100%" height="auto" src="https://www.youtube.com/embed/gZ6N2H3_vys" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>\n</div>',
	openAiApi:
		'To configure this credential, you\'ll need:\n\n- An <a href="https://openai.com/" target="_blank">OpenAI</a> account.\n\n- An **API Key**: From your OpenAI account, open the <a href="https://platform.openai.com/api-keys" target="_blank">API keys</a> page to create an API key. Refer to the <a href="https://platform.openai.com/docs/quickstart/account-setup" target="_blank">API Quickstart Account Setup documentation</a> for more information.\n- An **Organization ID**: Required if you belong to multiple organizations; otherwise, leave this blank.\n    - Go to your <a href="https://platform.openai.com/account/organization" target="_blank">Organization Settings</a> page to get your Organization ID. Refer to <a href="https://platform.openai.com/docs/guides/production-best-practices/setting-up-your-organization" target="_blank">Setting up your organization</a> for more information.\n    - API requests made using an Organization ID will count toward the organization\'s subscription quota.\n',
};
