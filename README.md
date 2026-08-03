# Knox Solar Gateway (backend)

NestJS API that fronts the ShineMonitor cloud and the RTSP camera. It is the only
component that holds credentials or understands inverter-specific data shapes.

## Running

```bash
cp .env.example .env    # SHINE_USR and SHINE_PWD are required
npm install
npm run start:dev
```

- API: <http://localhost:3000/api/v1>
- OpenAPI explorer: <http://localhost:3000/api/docs>

## Module map

| Module | Responsibility |
| --- | --- |
| `shine/` | Transport, HMAC-SHA1 signing, session lifecycle. Nothing else talks to the upstream directly. |
| `auth/` | Reports session state to clients. Never exposes the token or password. |
| `devices/` | Lists inverters and their identifiers. |
| `telemetry/` | Energy flow snapshot and data logger history, both normalised by pure mappers. |
| `controls/` | Reads and writes inverter settings; owns the preferred profile. |
| `alarms/` | Alarm list with ISO timestamps and computed durations. |
| `camera/` | RTSP → MJPEG transcoding. The only module that needs ffmpeg. |
| `diagnostics/` | Signed passthrough to arbitrary upstream actions, for support use. |
| `health/` | Liveness probe. |

## Design decisions

**One upstream session, shared by all clients.** `ShineSessionService` logs in
once, de-duplicates concurrent logins and refreshes 60 s before expiry.
`ShineApiService` retries a call once after re-authenticating when the upstream
reports a token error, so clients never see a transient auth failure.

**Mappers are pure functions.** `energy-flow.mapper.ts` and `history.mapper.ts`
take raw upstream payloads and return DTOs. They have no dependencies, which is
why the tricky parts — noise thresholds, load current derivation, constant-column
detection — are directly unit tested.

**Thresholds are named constants, not magic numbers.** A grid reading of 0.4 V is
electrical noise, not an active grid. Those cut-offs live at the top of the
mapper with an explanation rather than being scattered through rendering code.

**Parameter ids are a lookup table.** `FLOW_PARAMETER_IDS` maps our vocabulary to
ShineMonitor's. Supporting a different inverter family is a data change.

**Camera concurrency is capped.** One ffmpeg process is spawned per viewer, so
`CAMERA_MAX_STREAMS` protects the host from runaway transcoding.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/health` | Liveness |
| GET | `/api/v1/session` | Auth state |
| POST | `/api/v1/session/refresh` | Force re-login |
| GET | `/api/v1/devices` | Inverter list |
| GET | `/api/v1/telemetry/energy-flow` | Live snapshot |
| GET | `/api/v1/telemetry/history` | Data logger page |
| GET | `/api/v1/controls/fields` | Writable settings |
| GET | `/api/v1/controls/fields/:id/value` | Current value |
| PUT | `/api/v1/controls/fields/:id/value` | Write one setting |
| GET/POST | `/api/v1/controls/profiles/preferred` | Describe / apply the profile |
| GET | `/api/v1/alarms` | Alarm list |
| GET | `/api/v1/camera/status` | Camera availability |
| GET | `/api/v1/camera/stream` | MJPEG stream |
| GET | `/api/v1/camera/snapshot` | Single JPEG |
| POST | `/api/v1/diagnostics/shine-call` | Raw signed passthrough |

Device-scoped endpoints take `pn`, `sn`, `devcode` and `devaddr`, which come from
`GET /devices`.

## Testing

```bash
npm test
```

Covers signature construction, energy flow derivation and history normalisation.
No test contacts the live upstream.
