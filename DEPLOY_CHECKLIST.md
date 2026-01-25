# Deploy Checklist - AutoForce Performance

## 1) OAuth Google
- Atualizar no Google Cloud Console:
  - Authorized JavaScript origins: `https://SEU-DOMINIO`
  - Authorized redirect URIs: `https://SEU-DOMINIO`
- Confirmar `GOOGLE_CLIENT_ID` no backend e `VITE_GOOGLE_CLIENT_ID` no front
- Domínio permitido: `autoforce.com`

## 2) Backend (Node/Express + Prisma)
- Configurar `.env` de produção com:
  - `DATABASE_URL`
  - `PORT`
  - `CORS_ORIGIN=https://SEU-DOMINIO`
  - `NODE_ENV=production`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_ALLOWED_DOMAIN`
  - RD Station (ID/SECRET/REFRESH/WORKSPACE)
  - Meta (access token + ad account)
  - GA4 (property id + credentials path)
- Aplicar migrations:
  - `npx prisma migrate deploy`
- Reiniciar o backend
- Validar `GET /api/health`

## 3) Frontend (Vite/React)
- Configurar `.env`:
  - `VITE_API_URL=https://SEU-BACKEND/api`
  - `VITE_GOOGLE_CLIENT_ID=...`
- Build:
  - `npm run build`
- Publicar no hosting (Vercel/Netlify/Cloudflare)

## 4) Sync de dados
- Rodar sync inicial (RD emails + automações)
- Validar logs em `/api/emails/sync/logs`

## 5) Segurança e observabilidade
- HTTPS ativo
- Logs do backend em serviço (Railway/Render/Logtail)
- Alertas simples para falhas de sync

## 6) Checklist final
- Login Google funciona com `@autoforce.com`
- Dashboards carregam sem erro
- CORS liberado para o domínio real
