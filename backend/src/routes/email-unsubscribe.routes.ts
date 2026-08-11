import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { maskUnsubscribeEmail, readUnsubscribeToken } from '../services/email-unsubscribe.service';

const router = Router();

function readEmail(token: string, res: Response): string | null {
  try {
    return readUnsubscribeToken(token);
  } catch {
    res.status(400).json({ error: 'Este link de desinscrição é inválido.' });
    return null;
  }
}

// Consultar o link nunca altera o cadastro. Isso evita que scanners de segurança
// dos provedores de email cancelem a inscrição só por abrirem o link.
router.get('/:token', async (req: Request, res: Response) => {
  const email = readEmail(req.params.token, res);
  if (!email) return;

  try {
    const suppression = await prisma.emailSuppression.findUnique({ where: { email }, select: { unsubscribedAt: true } });
    res.json({
      valid: true,
      emailMasked: maskUnsubscribeEmail(email),
      unsubscribed: Boolean(suppression),
      unsubscribedAt: suppression?.unsubscribedAt ?? null,
    });
  } catch {
    res.status(500).json({ error: 'Não foi possível consultar sua preferência agora.' });
  }
});

// Também atende ao POST padronizado do cabeçalho List-Unsubscribe-Post.
router.post('/:token', async (req: Request, res: Response) => {
  const email = readEmail(req.params.token, res);
  if (!email) return;

  try {
    const source = req.is('application/x-www-form-urlencoded') ? 'one-click-header' : 'confirmation-page';
    const suppression = await prisma.emailSuppression.upsert({
      where: { email },
      create: { email, reason: 'unsubscribe', source },
      update: {},
      select: { unsubscribedAt: true },
    });

    res.json({
      ok: true,
      emailMasked: maskUnsubscribeEmail(email),
      unsubscribedAt: suppression.unsubscribedAt,
    });
  } catch {
    res.status(500).json({ error: 'Não foi possível registrar sua desinscrição agora.' });
  }
});

export default router;
