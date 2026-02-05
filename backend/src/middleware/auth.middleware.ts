import { Request, Response, NextFunction } from 'express';
import { verifyGoogleToken } from '../services/auth.service';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Libera rotas de saúde e autenticação (públicas)
    if (req.path === '/health' || req.path.startsWith('/auth')) {
      next();
      return;
    }

    // 2. Validação por API KEY (Para Automações e Scripts)
    const apiKey = req.headers['x-api-key'];
    const internalApiKey = process.env.INTERNAL_API_KEY;

    if (apiKey && internalApiKey && apiKey === internalApiKey) {
      // Se a chave for válida, tratamos como um usuário "system" ou apenas liberamos
      (req as any).user = { name: 'System Automation', role: 'admin' };
      next();
      return;
    }

    // 3. Validação por Token do Google (Para Usuários no Frontend)
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      res.status(401).json({ error: 'Unauthorized: No token or API Key provided' });
      return;
    }

    const user = await verifyGoogleToken(token);
    (req as Request & { user?: typeof user }).user = user;
    next();
  } catch (error) {
    // Log para ajudar no debug do Railway se algo falhar
    console.error('Auth Error:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
};