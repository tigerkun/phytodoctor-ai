# SDK & API Reference

Programmatic access to VertaaUX via JS SDK, Python SDK, REST API, webhooks, and MCP server.

## JS SDK (`@vertaaux/sdk`)

### Install

```bash
npm install @vertaaux/sdk
```

### Client Setup

```typescript
import { createVertaauxClient } from "@vertaaux/sdk";

const client = createVertaauxClient({
  apiKey: "vtx_...",
  baseUrl: "https://vertaaux.ai/api/v1",  // optional, this is default
  retry: { retries: 2, baseDelayMs: 300 }, // optional
  idempotencyKey: "unique-request-id",      // optional
});
```

### Methods

```typescript
// Create audit (async — returns job ID immediately)
const { job_id } = await client.createAudit({
  url: "https://example.com",
  mode: "standard",  // basic | standard | deep
});

// Poll for completion
const result = await client.getAudit(job_id);
// result.status: "queued" | "running" | "completed" | "failed"
// result.scores: { usability: 85, clarity: 72, ... }
// result.issues: [{ severity, category, ruleId, ... }]

// Check quota
const quota = await client.getQuota();

// Webhooks
const webhook = await client.createWebhook({
  url: "https://your-app.com/webhook",
  events: ["audit.completed"],
});
const webhooks = await client.listWebhooks();
await client.deleteWebhook(webhook.id);
```

### Webhook Signature Verification

```typescript
import { verifyWebhookSignature } from "@vertaaux/sdk";

const isValid = await verifyWebhookSignature({
  secret: "whsec_...",
  payload: rawBody,           // raw request body string
  signature: req.headers["x-vertaaux-signature"],
  timestamp: req.headers["x-vertaaux-timestamp"],
  toleranceSeconds: 300,      // optional, default 300
});
```

### Pagination Helper

```typescript
import { paginate } from "@vertaaux/sdk";

const allAudits = await paginate({
  page: 1,
  limit: 50,
  fetchPage: (page, limit) =>
    fetch(`${baseUrl}/audits?page=${page}&limit=${limit}`)
      .then(r => r.json()),
});
```

### Idempotency

```typescript
import { generateIdempotencyKey, createVertaauxClient } from "@vertaaux/sdk";

const client = createVertaauxClient({
  apiKey: "vtx_...",
  idempotencyKey: generateIdempotencyKey(),
});
// Safe to retry — same key prevents duplicate audits
```

## Python SDK (`vertaaux-api-client`)

```bash
pip install vertaaux-api-client
```

```python
from vertaaux import VertaauxClient

client = VertaauxClient(api_key="vtx_...")

# Create audit
job = client.create_audit(url="https://example.com", mode="standard")

# Poll for result
result = client.get_audit(job.job_id)
print(result.scores)
print(result.issues)

# Check quota
quota = client.get_quota()
```

## REST API (Direct)

Base URL: `https://vertaaux.ai/api/v1`

Auth: `X-API-Key: vtx_...` header on every request.

### Create Audit

```http
POST /api/v1/audit
Content-Type: application/json
X-API-Key: vtx_...

{
  "url": "https://example.com",
  "mode": "standard"
}
```

Response (202):
```json
{
  "job_id": "abc123",
  "status": "queued",
  "url": "https://example.com"
}
```

### Get Audit Result

```http
GET /api/v1/audit/{job_id}
X-API-Key: vtx_...
```

Response (200):
```json
{
  "job_id": "abc123",
  "status": "completed",
  "url": "https://example.com",
  "scores": {
    "usability": 85,
    "clarity": 72,
    "accessibility": 90,
    "ia": 68,
    "conversion": 78,
    "semantic": 82,
    "keyboard": 75
  },
  "issues": [
    {
      "severity": "error",
      "category": "accessibility",
      "ruleId": "color-contrast",
      "message": "...",
      "elementSelector": ".hero-text",
      "wcagCriteria": "1.4.3",
      "fixability": "mechanical",
      "structured_fix": {
        "type": "set-attribute",
        "selector": ".hero-text",
        "attribute": "style",
        "value": "color: #1a1a1a"
      }
    }
  ]
}
```

### Other Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/quota` | Check remaining audit quota |
| POST | `/api/v1/webhooks` | Create webhook |
| GET | `/api/v1/webhooks` | List webhooks |
| DELETE | `/api/v1/webhooks/{id}` | Delete webhook |
| POST | `/api/v1/a11y/audit` | Accessibility-only audit |
| GET | `/api/v1/audits` | List past audits |
| GET | `/api/v1/findings` | Query findings across audits |
| POST | `/api/v1/verify` | Verify a fix |
| POST | `/api/v1/share` | Generate shareable link |
| GET | `/api/v1/tracked-sites` | List tracked sites |

## MCP Server

VertaaUX provides an MCP (Model Context Protocol) server for AI agent integration (Claude Desktop, custom agents).

### Manifest

```json
{
  "schema_version": "2024-12-01",
  "name": "vertaaux",
  "version": "1.5-beta",
  "description": "VertaaUX programmatic audits for usability, accessibility, IA, conversion.",
  "api": {
    "type": "openapi",
    "url": "https://vertaaux.ai/openapi.json",
    "has_user_authentication": true
  },
  "capabilities": { "tools": true }
}
```

### MCP Tools Available

- `create_audit` — Start an audit job
- `get_audit` — Get audit results
- `get_quota` — Check remaining quota
- `create_webhook` — Set up webhooks

MCP findings include `structured_fix`, `fixability`, and `recommended_fix` fields designed for AI agent consumption.

### Claude Desktop Setup

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "vertaaux": {
      "url": "https://vertaaux.ai/mcp",
      "headers": {
        "X-API-Key": "vtx_..."
      }
    }
  }
}
```

## Webhooks

### Event Types

- `audit.completed` — Audit finished (includes scores + issues)
- `audit.failed` — Audit failed (includes error reason)

### Payload Structure

```json
{
  "event": "audit.completed",
  "timestamp": "2026-04-05T12:00:00.000Z",
  "data": {
    "job_id": "abc123",
    "url": "https://example.com",
    "scores": { ... },
    "issues": [ ... ]
  }
}
```

### Security

Always verify webhook signatures using the SDK's `verifyWebhookSignature()` function. Signatures use HMAC-SHA256 with a shared secret. Requests include:
- `X-VertaaUX-Signature` — hex-encoded HMAC
- `X-VertaaUX-Timestamp` — unix timestamp (ms)

Reject requests older than 5 minutes (replay protection).

## Rate Limits

- Free tier: rate-limited per endpoint
- Pro tier: higher limits
- 429 responses include `Retry-After` header
- SDK auto-retries 429s and 5xx with exponential backoff

## Audit Source Tracking

Every audit records its source in metadata: `"web"`, `"api"`, `"cli"`, `"mcp"`, `"sdk"`, `"scheduler"`. Use this for analytics and debugging.
