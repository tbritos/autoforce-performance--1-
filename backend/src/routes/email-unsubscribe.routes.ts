import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { maskUnsubscribeEmail, readUnsubscribePreferenceToken } from '../services/email-unsubscribe.service';
import { emailSuppressionScopeLabel } from '../services/email-preferences.service';

const router = Router();

function readPreference(token: string, res: Response): { email: string; scope: 'newsletter' | 'marketing' } | null {
  try {
    return readUnsubscribePreferenceToken(token);
  } catch {
    res.status(400).json({ error: 'Este link de desinscrição é inválido.' });
    return null;
  }
}

// Consultar o link nunca altera o cadastro. Isso evita que scanners de segurança
// dos provedores de email cancelem a inscrição só por abrirem o link.
router.get('/:token', async (req: Request, res: Response) => {
  const preference = readPreference(req.params.token, res);
  if (!preference) return;
  const { email, scope } = preference;

  try {
    const suppression = await prisma.emailSuppression.findUnique({ where: { email_scope: { email, scope } }, select: { unsubscribedAt: true } });
    res.json({
      valid: true,
      emailMasked: maskUnsubscribeEmail(email),
      scope,
      categoryLabel: emailSuppressionScopeLabel(scope),
      unsubscribed: Boolean(suppression),
      unsubscribedAt: suppression?.unsubscribedAt ?? null,
    });
  } catch {
    res.status(500).json({ error: 'Não foi possível consultar sua preferência agora.' });
  }
});

// Também atende ao POST padronizado do cabeçalho List-Unsubscribe-Post.
router.post('/:token', async (req: Request, res: Response) => {
  const preference = readPreference(req.params.token, res);
  if (!preference) return;
  const { email, scope } = preference;

  try {
    const source = req.is('application/x-www-form-urlencoded') ? 'one-click-header' : 'confirmation-page';
    const suppression = await prisma.emailSuppression.upsert({
      where: { email_scope: { email, scope } },
      create: { email, scope, reason: 'unsubscribe', source },
      update: {},
      select: { unsubscribedAt: true },
    });

    res.json({
      ok: true,
      emailMasked: maskUnsubscribeEmail(email),
      scope,
      categoryLabel: emailSuppressionScopeLabel(scope),
      unsubscribedAt: suppression.unsubscribedAt,
    });
  } catch {
    res.status(500).json({ error: 'Não foi possível registrar sua desinscrição agora.' });
  }
});

export default router;
