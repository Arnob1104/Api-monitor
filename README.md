<img width="1223" height="598" alt="image" src="https://github.com/user-attachments/assets/74283e9f-b85a-4fa3-b393-dc84aa8b11f1" />

# ApiWatch: Intelligent API Monitoring & Alert System

ApiWatch checks responses from external APIs (patient and operational data), detects anomalies, asks an LLM to write a short human-readable alert, stores it in Supabase, and shows everything in a React dashboard. It can also email a report.

```
 JSON batch ──► POST /monitor ──► validate ──► detect anomalies ──► LLM alert text (Groq)
 (or sample file)                                                         │  falls back to rule-based text
                                                                          ▼
 React dashboard ◄── GET /alerts ◄── Supabase (alerts table) ◄── store, dedupe, auto-resolve ──► email (optional)
```

## Features

- **Batch processing:** send any number of API responses in one request (default limit 1000).
- **Anomaly detection:** slow responses, 4xx/5xx errors, zero or missing records, missing fields, inconsistent data.
- **AI alerts:** Groq LLM writes the alert. If the LLM is down or no key is set, a rule-based message is used, so no alert is ever lost.
- **Smart storage:** one active alert per API and issue. Repeats raise `occurrence_count` instead of creating duplicates. Alerts auto-resolve when the API recovers.
- **REST API:** `/monitor`, `/alerts`, plus stats, resolve, and email report endpoints.
- **Dashboard:** severity overview bar, filters, expandable details, resolve button, paste-and-check panel, 15-second auto refresh.
- **Email (optional):** Nodemailer over SMTP, free with a Gmail app password.
- **Logging and errors:** JSON logs to `backend/logs/app.log` and the console, central error handler, per-item failure isolation.

## Project structure

```
api-monitor/
├── supabase/schema.sql              # database table, run once
├── backend/
│   ├── data/sample_api_responses.json   # static JSON input
│   ├── tests/anomalyDetector.test.js
│   └── src/
│       ├── server.js, app.js
│       ├── config/                  # env config, Supabase client
│       ├── routes/ controllers/     # HTTP layer
│       ├── services/
│       │   ├── anomalyDetector.js   # pure detection rules
│       │   ├── aiAlert.service.js   # Groq call + fallback text
│       │   ├── monitor.service.js   # the pipeline
│       │   └── email.service.js     # Nodemailer
│       ├── repositories/alert.repository.js   # all database access
│       ├── prompts/alertPrompt.js   # LLM prompts
│       ├── middleware/              # logging, errors, async wrapper
│       └── utils/                   # logger, AppError, concurrency limiter
└── frontend/                        # React + Vite + Tailwind
```

## Setup

Requirements: Node.js 18 or newer.

### 1. Supabase (database)

1. Create a free project at https://supabase.com.
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql`, and run it.
3. Open **Project Settings > API** and copy the **Project URL** and the **service_role** key.
   The service_role key must only live in the backend `.env`. Never put it in the frontend.

### 2. Groq (free LLM)

1. Create a key at https://console.groq.com/keys.
2. The default model is `llama-3.1-8b-instant` (free tier). Change it with `GROQ_MODEL` if you like.
3. No key? The app still works and writes rule-based alert text.

### 3. Backend

```bash
cd backend
cp .env.example .env      # then fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, GROQ_API_KEY
npm install
npm run dev               # http://localhost:5000
```

### 4. Frontend

```bash
cd frontend
cp .env.example .env      # VITE_API_URL=http://localhost:5000
npm install
npm run dev               # http://localhost:5173
```

Open http://localhost:5173 and click **Run sample data**.

### 5. Email (optional)

Gmail is free: turn on 2-step verification, create an **App password** at https://myaccount.google.com/apppasswords, then set in `backend/.env`:

```
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=<the 16-character app password>
EMAIL_FROM="ApiWatch <you@gmail.com>"
EMAIL_TO=oncall@example.com
```

New alerts at or above `EMAIL_MIN_SEVERITY` (default `high`) are emailed automatically. The **Email active alerts** button sends the full active list on demand. For testing without a real inbox, Mailtrap and Ethereal also offer free SMTP.

## Run the tests

```bash
cd backend
npm test        # 10 unit tests for the detection rules, no database or network needed
```

## API reference

| Method | Path | Purpose |
|---|---|---|
| POST | `/monitor` | Check a batch. Body: a JSON array, or `{ "apis": [...] }` |
| POST | `/monitor/sample` | Check the bundled `data/sample_api_responses.json` |
| GET | `/alerts` | List alerts. Query: `status=active\|resolved\|all` (default `active`), `severity`, `api_name`, `limit`, `offset` |
| GET | `/alerts/stats` | Active alert counts by severity |
| PATCH | `/alerts/:id/resolve` | Mark an alert resolved |
| POST | `/alerts/report` | Email the active alerts |
| GET | `/health` | Liveness, LLM and email status |

```bash
curl -X POST http://localhost:5000/monitor \
  -H "Content-Type: application/json" \
  -d '[{"api_name":"AppointmentAPI","response_time_ms":5500,"status_code":500,"records_returned":0}]'

curl http://localhost:5000/alerts
```

`POST /monitor` returns a summary: counts of checked, healthy, new, updated, and resolved alerts, how many messages came from the LLM, items that were rejected as malformed, and the stored alerts.

## Detection rules

Thresholds are configurable (`RESPONSE_TIME_WARN_MS`, `RESPONSE_TIME_CRITICAL_MS`).

| Condition | Type | Severity |
|---|---|---|
| HTTP 5xx | `SERVER_ERROR` | critical |
| HTTP 4xx | `CLIENT_ERROR` | high |
| HTTP 1xx or 3xx | `UNEXPECTED_STATUS` | low |
| Response time at or above 2000 ms | `HIGH_RESPONSE_TIME` | medium |
| Response time at or above 5000 ms | `HIGH_RESPONSE_TIME` | high |
| 0 records on a 2xx response (except 204) | `ZERO_RECORDS` | high |
| 0 records on a failed response | `ZERO_RECORDS` | medium |
| Error status but records returned | `INCONSISTENT_DATA` | medium |
| Negative record count | `INCONSISTENT_DATA` | high |
| Negative response time | `INCONSISTENT_DATA` | medium | 
| Missing `status_code`, `response_time_ms`, or `records_returned` | `MISSING_DATA` | medium |

An alert's severity is the highest severity among its anomalies. Items without a usable `api_name`, or with non-numeric values, are rejected and reported in the response without failing the rest of the batch.

## Key design decisions

- **Pure detector, separate pipeline.** `anomalyDetector.js` has no I/O, so it is trivial to unit test and reuse.
- **LLM is an enhancement, not a dependency.** Calls have a timeout, one retry for 429/5xx, a concurrency cap, and a deterministic fallback. The prompt tells the model to use only the supplied facts and to hedge causes.
- **Deduplication in the database.** A partial unique index (`api_name`, `anomaly_key` where active) guarantees one active alert per issue even under concurrent requests. The code handles the conflict by updating instead.
- **Auto-resolve.** When an API recovers, or its issue changes, stale alerts are resolved so `/alerts` reflects the current state. Skipped for an API that appears more than once in the same batch, because its current state would be ambiguous.
- **Repository layer.** All Supabase access is in one file, so swapping the database touches one place.
- **Failure isolation.** One failed LLM call or database write does not lose the rest of the batch. If nothing at all can be stored, the API returns 502.

## Scalability notes and limits

- LLM and database calls run with bounded concurrency, so a large batch does not flood Groq's rate limits.
- A very large volume would move detection to a queue (for example BullMQ) and poll the APIs on a schedule. Today the system is push-based: something sends results to `/monitor`.
- Free Groq limits apply. If you hit a 429, the retry and fallback keep alerts flowing.
