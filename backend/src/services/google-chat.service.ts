// Notificacoes simples via webhook de entrada do Google Chat — sem OAuth,
// so um POST no link do webhook. Desligado ate o usuario configurar
// GOOGLE_CHAT_WEBHOOK_URL (mesmo padrao ja usado por MEETING_BOOKING_URL:
// feature no-op se a env var nao estiver setada, sem precisar de mudanca de
// codigo depois que ele configurar).
export async function sendGoogleChatNotification(message: string): Promise<void> {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
    if (!res.ok) {
      console.error(`[GoogleChat] webhook retornou ${res.status}: ${await res.text().catch(() => '')}`);
    }
  } catch (err) {
    console.error('[GoogleChat] falha ao enviar notificação:', err);
  }
}
