# Configurar OAuth das Integracoes

Para o botao **Conectar** funcionar como em ferramentas como Reportei, o sistema precisa ter um app OAuth cadastrado em cada provedor. O usuario final nao mexe nessas credenciais: ele apenas autoriza a propria conta na tela do provedor.

## URL de callback

Use sempre este formato ao cadastrar redirect/callback URL nos provedores:

```text
APP_URL/api/connections/PLATAFORMA/callback
```

Exemplos:

```text
https://seu-backend.com/api/connections/GOOGLE_ADS/callback
https://seu-backend.com/api/connections/GOOGLE_ANALYTICS/callback
https://seu-backend.com/api/connections/GOOGLE_CALENDAR/callback
https://seu-backend.com/api/connections/META_ADS/callback
https://seu-backend.com/api/connections/RD_STATION/callback
https://seu-backend.com/api/connections/PIPEDRIVE/callback
```

Em desenvolvimento local:

```text
http://localhost:5000/api/connections/GOOGLE_ADS/callback
```

## Variaveis obrigatorias

### Base

```env
APP_URL=http://localhost:5000
ENCRYPTION_KEY=64_caracteres_hexadecimais
```

`ENCRYPTION_KEY` deve ter 64 caracteres hexadecimais. Exemplo para gerar:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Google Ads, GA4 e Google Calendar

Cadastre um app OAuth no Google Cloud Console e habilite as APIs necessarias.

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
```

Depois de conectar, configure tambem pela tela ou API:

```text
Google Ads: customerId
Google Analytics: propertyIds
Google Calendar: calendarId
```

### Meta Ads

Cadastre um app no Meta Developers com Login do Facebook/OAuth.

```env
META_APP_ID=
META_APP_SECRET=
```

Depois de conectar, configure tambem:

```text
Meta Ads: adAccountId
```

### RD Station

Cadastre um app no RD Station.

```env
RD_STATION_CLIENT_ID=
RD_STATION_CLIENT_SECRET=
```

### Pipedrive

Cadastre um app OAuth no Pipedrive Marketplace.

```env
PIPEDRIVE_CLIENT_ID=
PIPEDRIVE_CLIENT_SECRET=
```

Alternativa: usar API token pela tela de Integracoes, preenchendo `Dominio Pipedrive` e `API token manual`.

## Fluxo esperado

1. Preencher as credenciais do app OAuth no `.env`.
2. Reiniciar o backend.
3. Abrir a tela **Integracoes**.
4. Clicar em **Conectar**.
5. Autorizar a conta no provedor.
6. Preencher IDs adicionais na area **Configuracao da integracao**, quando necessario.
7. Clicar em **Sincronizar**.

## API

Verificar se o OAuth esta pronto:

```bash
curl https://SEU-BACKEND/api/connections/requirements \
  -H "Authorization: Bearer SEU_TOKEN"
```

Salvar IDs adicionais:

```bash
curl -X PUT https://SEU-BACKEND/api/connections/GOOGLE_ANALYTICS/config \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"metadata\":{\"propertyIds\":\"484560591,349265313\"}}"
```

Forcar sync:

```bash
curl -X POST https://SEU-BACKEND/api/connections/GOOGLE_ADS/sync \
  -H "Authorization: Bearer SEU_TOKEN"
```
