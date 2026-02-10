import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/error.middleware';
import { authMiddleware } from './middleware/auth.middleware';

// Import routes
import dashboardRoutes from './routes/dashboard.routes';
import leadsRoutes from './routes/leads.routes';
import revenueRoutes from './routes/revenue.routes';
import okrsRoutes from './routes/okrs.routes';
import teamRoutes from './routes/team.routes';
import analyticsRoutes from './routes/analytics.routes';
import calendarRoutes from './routes/calendar.routes';
import campaignsRoutes from './routes/campaigns.routes';
import assetsRoutes from './routes/assets.routes';
import emailRoutes from './routes/email.routes';
import { EmailService } from './services/email.service';
import authRoutes from './routes/auth.routes';
import rdLeadsRoutes from './routes/rdleads.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 204,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// RD Station OAuth callback helper
app.get('/rdstation/callback', (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';

  res.status(200).send(`
    <html>
      <head><title>RD Station OAuth</title></head>
      <body style="font-family: Arial, sans-serif; padding: 24px;">
        <h2>RD Station OAuth</h2>
        <p>Copie o code abaixo e use no POST para gerar o refresh token.</p>
        <pre style="background:#111827;color:#fff;padding:12px;border-radius:8px;">${code || 'code nao encontrado'}</pre>
        ${state ? `<p><strong>state:</strong> ${state}</p>` : ''}
      </body>
    </html>
  `);
});


// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AutoForce Performance API is running' });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Auth middleware for protected routes
app.use('/api', authMiddleware);

// RD Station OAuth token exchange
app.post('/api/rdstation/token', async (req, res, next) => {
  try {
    const { code } = req.body as { code?: string };
    const clientId = process.env.RD_STATION_CLIENT_ID;
    const clientSecret = process.env.RD_STATION_CLIENT_SECRET;

    if (!code || !clientId || !clientSecret) {
      res.status(400).json({
        error: 'Missing code or RD Station credentials',
      });
      return;
    }

    const response = await fetch('https://api.rd.services/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).send(text);
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// RD Station workspace lookup
app.get('/api/rdstation/workspaces', async (req, res, next) => {
  try {
    const { getRdAccessToken } = await import('./services/rdstation.service');
    const token = await getRdAccessToken();

    const response = await fetch('https://api.rd.services/platform/workspaces', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).send(text);
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get('/api/rdstation/test', async (req, res, next) => {
  try {
    const { getRdAccessToken } = await import('./services/rdstation.service');
    await getRdAccessToken();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// API Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/okrs', okrsRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/rdstation', rdLeadsRoutes);

// Error handling middleware (deve ser o último)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 AutoForce Performance API`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

const syncRdData = async () => {
  try {
    await Promise.all([
      EmailService.syncRdCampaigns(),
      EmailService.syncWorkflowStats(),
    ]);
    console.log('ðŸ”„ RD Station sync concluida.');
  } catch (error) {
    console.error('âŒ Falha ao sincronizar RD Station:', error);
  }
};

const syncIntervalMs = 15 * 60 * 1000;
syncRdData();
setInterval(syncRdData, syncIntervalMs);

export default app;
