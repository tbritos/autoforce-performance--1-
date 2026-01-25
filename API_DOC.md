# AutoForce Performance API

## Auth
All routes under `/api/*` require:
```
Authorization: Bearer <GOOGLE_ID_TOKEN>
```

### Exemplo curl (com token)
```bash
curl -H "Authorization: Bearer SEU_TOKEN" https://SEU-BACKEND/api/health
```

### POST /api/auth/google
Validate Google credential and return user profile.
```json
{
  "credential": "<google_id_token>"
}
```
Response:
```json
{
  "user": {
    "email": "usuario@autoforce.com",
    "name": "Usuario",
    "avatar": "https://...",
    "role": "AutoForce Member"
  }
}
```

Exemplo curl:
```bash
curl -X POST https://SEU-BACKEND/api/auth/google \
  -H "Content-Type: application/json" \
  -d "{\"credential\":\"SEU_TOKEN\"}"
```

### GET /api/auth/me
Validate token and return user.

---

## Health
### GET /api/health
Response:
```json
{ "status": "ok", "message": "AutoForce Performance API is running" }
```

---

## Dashboard
### GET /api/dashboard/metrics
Response: `Metric[]`

### GET /api/dashboard/history
Response: `ChartData[]`

---

## Acompanhamento Diario
### GET /api/leads/daily
Response:
```json
[
  { "id": "1", "date": "2026-01-25", "mql": 10, "sql": 3, "sales": 1, "conversionRate": 30 }
]
```

Exemplo curl:
```bash
curl https://SEU-BACKEND/api/leads/daily \
  -H "Authorization: Bearer SEU_TOKEN"
```

### POST /api/leads/daily
```json
{ "date": "2026-01-25", "mql": 10, "sql": 3, "sales": 1, "conversionRate": 30 }
```

Exemplo curl:
```bash
curl -X POST https://SEU-BACKEND/api/leads/daily \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-01-25\",\"mql\":10,\"sql\":3,\"sales\":1,\"conversionRate\":30}"
```

### PUT /api/leads/daily/:id
```json
{ "date": "2026-01-25", "mql": 12, "sql": 4, "sales": 1, "conversionRate": 33.3 }
```

Exemplo curl:
```bash
curl -X PUT https://SEU-BACKEND/api/leads/daily/LEAD_ID \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-01-25\",\"mql\":12,\"sql\":4,\"sales\":1,\"conversionRate\":33.3}"
```

### DELETE /api/leads/daily/:id
Exemplo curl:
```bash
curl -X DELETE https://SEU-BACKEND/api/leads/daily/LEAD_ID \
  -H "Authorization: Bearer SEU_TOKEN"
```

---

## Ganhos
### GET /api/revenue/transactions
Query params:
- `origin=Google Ads`
- `product=Autodromo,Autopilot`

Response:
```json
[
  {
    "id": "1",
    "date": "2026-01-25",
    "businessName": "Loja X",
    "setupValue": 1000,
    "mrrValue": 500,
    "origin": "Google Ads",
    "product": ["Autodromo", "Autopilot"]
  }
]
```

Exemplo curl:
```bash
curl "https://SEU-BACKEND/api/revenue/transactions?origin=Google%20Ads&product=Autodromo,Autopilot" \
  -H "Authorization: Bearer SEU_TOKEN"
```

### POST /api/revenue/transactions
```json
{
  "date": "2026-01-25",
  "businessName": "Loja X",
  "setupValue": 1000,
  "mrrValue": 500,
  "origin": "Google Ads",
  "product": ["Autodromo", "Autopilot"]
}
```

Exemplo curl:
```bash
curl -X POST https://SEU-BACKEND/api/revenue/transactions \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-01-25\",\"businessName\":\"Loja X\",\"setupValue\":1000,\"mrrValue\":500,\"origin\":\"Google Ads\",\"product\":[\"Autodromo\",\"Autopilot\"]}"
```

### PUT /api/revenue/transactions/:id
```json
{
  "date": "2026-01-25",
  "businessName": "Loja X",
  "setupValue": 1200,
  "mrrValue": 550,
  "origin": "Google Ads",
  "product": ["Autodromo", "Autopilot"]
}
```

Exemplo curl:
```bash
curl -X PUT https://SEU-BACKEND/api/revenue/transactions/REVENUE_ID \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-01-25\",\"businessName\":\"Loja X\",\"setupValue\":1200,\"mrrValue\":550,\"origin\":\"Google Ads\",\"product\":[\"Autodromo\",\"Autopilot\"]}"
```

### DELETE /api/revenue/transactions/:id
Exemplo curl:
```bash
curl -X DELETE https://SEU-BACKEND/api/revenue/transactions/REVENUE_ID \
  -H "Authorization: Bearer SEU_TOKEN"
```

---

## OKRs
### GET /api/okrs
Response:
```json
[
  {
    "id": "1",
    "quarter": "Q1 2026",
    "objective": "Crescer leads",
    "progress": 60,
    "keyResults": [
      { "id": "kr1", "title": "MQLs", "currentValue": 100, "targetValue": 300, "unit": "#" }
    ]
  }
]
```

Exemplo curl:
```bash
curl https://SEU-BACKEND/api/okrs \
  -H "Authorization: Bearer SEU_TOKEN"
```

### POST /api/okrs
```json
{
  "id": "1",
  "quarter": "Q1 2026",
  "objective": "Crescer leads",
  "progress": 60,
  "keyResults": [
    { "id": "kr1", "title": "MQLs", "currentValue": 100, "targetValue": 300, "unit": "#" }
  ]
}
```

Exemplo curl:
```bash
curl -X POST https://SEU-BACKEND/api/okrs \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"1\",\"quarter\":\"Q1 2026\",\"objective\":\"Crescer leads\",\"progress\":60,\"keyResults\":[{\"id\":\"kr1\",\"title\":\"MQLs\",\"currentValue\":100,\"targetValue\":300,\"unit\":\"#\"}]}"
```

### PUT /api/okrs/:id
```json
{
  "id": "1",
  "quarter": "Q1 2026",
  "objective": "Crescer leads",
  "progress": 70,
  "keyResults": [
    { "id": "kr1", "title": "MQLs", "currentValue": 150, "targetValue": 300, "unit": "#" }
  ]
}
```

Exemplo curl:
```bash
curl -X PUT https://SEU-BACKEND/api/okrs/OKR_ID \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"1\",\"quarter\":\"Q1 2026\",\"objective\":\"Crescer leads\",\"progress\":70,\"keyResults\":[{\"id\":\"kr1\",\"title\":\"MQLs\",\"currentValue\":150,\"targetValue\":300,\"unit\":\"#\"}]}"
```

### DELETE /api/okrs/:id
Exemplo curl:
```bash
curl -X DELETE https://SEU-BACKEND/api/okrs/OKR_ID \
  -H "Authorization: Bearer SEU_TOKEN"
```

---

## Calendario Marketing
### GET /api/calendar/events
Response:
```json
[
  { "id": "1", "title": "Campanha X", "startDate": "2026-02-20", "endDate": "2026-02-26", "color": "#2563eb", "notes": "Obs" }
]
```

Exemplo curl:
```bash
curl https://SEU-BACKEND/api/calendar/events \
  -H "Authorization: Bearer SEU_TOKEN"
```

### POST /api/calendar/events
```json
{ "title": "Campanha X", "startDate": "2026-02-20", "endDate": "2026-02-26", "color": "#2563eb", "notes": "Obs" }
```

Exemplo curl:
```bash
curl -X POST https://SEU-BACKEND/api/calendar/events \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Campanha X\",\"startDate\":\"2026-02-20\",\"endDate\":\"2026-02-26\",\"color\":\"#2563eb\",\"notes\":\"Obs\"}"
```

### PUT /api/calendar/events/:id
```json
{ "title": "Campanha X", "startDate": "2026-02-20", "endDate": "2026-02-27", "color": "#2563eb", "notes": "Obs" }
```

### DELETE /api/calendar/events/:id
No body.

---

## Biblioteca de Ativos
### GET /api/assets
Response:
```json
[
  {
    "id": "1",
    "name": "LP Feirao",
    "category": "LP",
    "link": "https://...",
    "notes": "Obs",
    "tags": ["lp", "meta"],
    "versions": []
  }
]
```

Exemplo curl:
```bash
curl https://SEU-BACKEND/api/assets \
  -H "Authorization: Bearer SEU_TOKEN"
```

### POST /api/assets
```json
{
  "name": "LP Feirao",
  "category": "LP",
  "link": "https://...",
  "notes": "Obs",
  "tags": ["lp", "meta"],
  "versions": []
}
```

Exemplo curl:
```bash
curl -X POST https://SEU-BACKEND/api/assets \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"LP Feirao\",\"category\":\"LP\",\"link\":\"https://...\",\"notes\":\"Obs\",\"tags\":[\"lp\",\"meta\"],\"versions\":[]}"
```

### PUT /api/assets/:id
```json
{
  "name": "LP Feirao",
  "category": "LP",
  "link": "https://...",
  "notes": "Obs",
  "tags": ["lp", "meta"]
}
```

### DELETE /api/assets/:id
No body.

### POST /api/assets/:id/versions
```json
{ "label": "v2", "link": "https://..." }
```

Exemplo curl:
```bash
curl -X POST https://SEU-BACKEND/api/assets/ASSET_ID/versions \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"label\":\"v2\",\"link\":\"https://...\"}"
```

### PUT /api/assets/:id/versions/:versionId
```json
{ "label": "v3", "link": "https://..." }
```

### DELETE /api/assets/:id/versions/:versionId
No body.

---

## Campanhas
### GET /api/campaigns
### POST /api/campaigns
```json
{
  "name": "Campanha A",
  "platform": "Meta",
  "status": "Ativa",
  "budget": 1000,
  "startDate": "2026-01-01",
  "endDate": "2026-01-31",
  "kpi": "Leads",
  "notes": "Obs"
}
```

Exemplo curl:
```bash
curl -X POST https://SEU-BACKEND/api/campaigns \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Campanha A\",\"platform\":\"Meta\",\"status\":\"Ativa\",\"budget\":1000,\"startDate\":\"2026-01-01\",\"endDate\":\"2026-01-31\",\"kpi\":\"Leads\",\"notes\":\"Obs\"}"
```

### PUT /api/campaigns/:id
### DELETE /api/campaigns/:id

### GET /api/campaigns/meta
Query params: `startDate`, `endDate`

---

## Landing Pages / Analytics
### GET /api/analytics/landing-pages
Query params:
- `startDate=YYYY-MM-DD`
- `endDate=YYYY-MM-DD`
- `hostName=lp.autodromo.com.br`

### POST /api/analytics/sync-ga4
Forca sincronizacao GA4.

Exemplo curl:
```bash
curl -X POST https://SEU-BACKEND/api/analytics/sync-ga4 \
  -H "Authorization: Bearer SEU_TOKEN"
```

---

## Emails / RD Station
### GET /api/emails/campaigns?source=manual
### GET /api/emails/campaigns/rdstation
### GET /api/emails/campaigns/rdstation/sync
### GET /api/emails/automation/rdstation
### GET /api/emails/automation/rdstation/sync
### GET /api/emails/sync/logs
Query params: `limit=50`

### POST /api/emails/campaigns
```json
{ "name": "Email X", "date": "2026-01-25", "sends": 0, "opens": 0, "clicks": 0, "conversions": 0, "bounce": 0 }
```

Exemplo curl:
```bash
curl -X POST https://SEU-BACKEND/api/emails/campaigns \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Email X\",\"date\":\"2026-01-25\",\"sends\":0,\"opens\":0,\"clicks\":0,\"conversions\":0,\"bounce\":0}"
```

### PUT /api/emails/campaigns/:id
### DELETE /api/emails/campaigns/:id
