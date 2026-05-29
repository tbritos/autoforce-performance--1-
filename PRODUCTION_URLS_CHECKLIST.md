# Checklist de URLs para producao

Atualize estes valores quando o sistema sair de `localhost` e for publicado em dominio real.

## Variaveis do frontend

Arquivo/local de configuracao do frontend:

```env
VITE_API_URL=https://SEU_BACKEND/api
VITE_GOOGLE_CLIENT_ID=SEU_GOOGLE_CLIENT_ID.apps.googleusercontent.com
```

## Variaveis do backend

Arquivo/local de configuracao do backend:

```env
APP_URL=https://SEU_BACKEND
FRONTEND_URL=https://SEU_FRONTEND
CORS_ORIGIN=https://SEU_FRONTEND
```

Se houver mais de um frontend permitido, use virgula:

```env
CORS_ORIGIN=https://SEU_FRONTEND,https://www.SEU_FRONTEND
```

## Google Cloud Console

Console:

```text
https://console.cloud.google.com/apis/credentials
```

No OAuth Client usado pelo sistema, atualizar:

### Authorized JavaScript origins

```text
https://SEU_FRONTEND
```

### Authorized redirect URIs

Login Google do sistema:

```text
https://SEU_BACKEND/api/auth/google/redirect
```

Conexoes Google:

```text
https://SEU_BACKEND/api/connections/GOOGLE_ANALYTICS/callback
https://SEU_BACKEND/api/connections/GOOGLE_ADS/callback
https://SEU_BACKEND/api/connections/GOOGLE_CALENDAR/callback
```

## Meta for Developers

Console:

```text
https://developers.facebook.com/apps/
```

No app Meta usado em `META_APP_ID`, atualizar em:

```text
Facebook Login > Settings > Valid OAuth Redirect URIs
```

Adicionar:

```text
https://SEU_BACKEND/api/connections/META_ADS/callback
```

Se usar Web OAuth em producao, confirmar tambem:

```text
App Domains: SEU_FRONTEND
Website URL: https://SEU_FRONTEND
```

Para desenvolvimento local, se a Meta bloquear com "dominio dessa URL nao esta incluido nos dominios do app", adicionar em:

```text
Settings > Basic > App Domains
```

```text
localhost
```

E, se estiver usando a URL por IP da rede, adicionar tambem o IP/host usado no navegador.

## RD Station

No aplicativo RD Station, atualizar a URL de callback para:

```text
https://SEU_BACKEND/api/connections/RD_STATION/callback
```

Variaveis relacionadas:

```env
RD_STATION_CLIENT_ID=
RD_STATION_CLIENT_SECRET=
RD_STATION_REFRESH_TOKEN=
RD_STATION_WORKSPACE_ID=
```

## Pipedrive

Se usar API token, nao ha callback OAuth obrigatorio. Atualizar apenas:

```env
PIPEDRIVE_API_TOKEN=
PIPEDRIVE_DOMAIN=seusubdominio
```

Se migrar para OAuth, cadastrar:

```text
https://SEU_BACKEND/api/connections/PIPEDRIVE/callback
```

E configurar:

```env
PIPEDRIVE_CLIENT_ID=
PIPEDRIVE_CLIENT_SECRET=
```

## Meta Ads token manual

Se continuar usando token manual em vez de OAuth:

```env
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=act_XXXXXXXXXXXX
META_BUSINESS_ID=
```

Preferir System User Token para producao.

## Conferencia final

Antes de publicar:

- `APP_URL` deve apontar para o backend publico, sem `/api`.
- `FRONTEND_URL` deve apontar para o frontend publico.
- `VITE_API_URL` deve apontar para o backend publico com `/api`.
- `CORS_ORIGIN` deve conter exatamente o dominio do frontend.
- Todas as callbacks OAuth devem usar `https`.
- Nenhuma callback de producao deve apontar para `localhost`.
- Reiniciar backend e rebuildar frontend depois de trocar variaveis.
