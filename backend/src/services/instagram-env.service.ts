export function getInstagramAppId(): string {
  return (process.env.INSTAGRAM_APP_ID || process.env.Instagram_App_ID || '').trim();
}

export function getInstagramAppSecret(): string {
  return (process.env.INSTAGRAM_APP_SECRET || process.env.Instagram_App_Secret || '').trim();
}

export function getInstagramWebhookVerifyToken(): string {
  return (
    process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN
    || process.env.Instagram_Webhook_Verify_Token
    || ''
  ).trim();
}
