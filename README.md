# Knox Solar Gateway (backend)

NestJS API that fronts the ShineMonitor cloud and the RTSP camera. Clients sign
in with their own ShineMonitor username and password. The gateway is the only
component that holds those credentials or understands inverter-specific data
shapes.

## Running

```bash
cp .env.example .env    # AUTH_SECRET and DATABASE_URL are required
npm install
npm run start:dev
```

- API: <http://localhost:3000/api/v1>
- OpenAPI explorer: <http://localhost:3000/api/docs>

## Authentication

1. `POST /api/v1/auth/login` with `{ "username", "password" }` — the gateway
   validates the pair against ShineMonitor, upserts the `User` row, and returns
   an opaque Bearer token.
2. Send `Authorization: Bearer <token>` on every subsequent call. Device and
   telemetry routes then talk to ShineMonitor as **that** user.
3. `POST /api/v1/auth/logout` revokes the token.
4. Camera `<img>` tags cannot set headers, so `/camera/stream` and
   `/camera/snapshot` also accept `?access_token=<token>`.
5. `GET /api/v1/auth/users` lists accounts that have signed in (no secrets).
6. `GET /api/v1/session` is public so the SPA can poll start-up state. Without
   a token it returns `{ authenticated: false }`.

ShineMonitor passwords are stored encrypted with `AUTH_SECRET` so serverless
instances can refresh the upstream token without prompting again. Rotating
`AUTH_SECRET` invalidates stored passwords; users must sign in once more.

## Module map

| Module         | Responsibility                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `shine/`       | Transport, HMAC-SHA1 signing, **per-user** session lifecycle. Nothing else talks to the upstream directly.              |
| `auth/`        | Login, logout, user registry, gateway sessions, request auth context. Never exposes the ShineMonitor token or password. |
| `devices/`     | Lists inverters and their identifiers.                                                                                  |
| `telemetry/`   | Energy flow snapshot and data logger history, both normalised by pure mappers.                                          |
| `controls/`    | Reads and writes inverter settings; owns the preferred profile.                                                         |
| `alarms/`      | Alarm list with ISO timestamps and computed durations.                                                                  |
| `camera/`      | RTSP → MJPEG transcoding. The only module that needs ffmpeg.                                                            |
| `diagnostics/` | Signed passthrough to arbitrary upstream actions, for support use.                                                      |
| `health/`      | Liveness probe.                                                                                                         |

## Design decisions

**Per-user upstream sessions.** `ShineSessionService` resolves the caller from
async-local auth context, de-duplicates concurrent logins for that user, and
refreshes 60 s before expiry. `ShineApiService` retries a call once after
re-authenticating when the upstream reports a token error.

**Gateway sessions are revocable.** Bearer tokens are random and stored as
SHA-256 hashes in `UserSession`. Logout sets `revokedAt`.

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

| Method   | Path                                  | Purpose                              |
| -------- | ------------------------------------- | ------------------------------------ |
| GET      | `/api/v1/health`                      | Liveness                             |
| POST     | `/api/v1/auth/login`                  | ShineMonitor login → gateway token   |
| POST     | `/api/v1/auth/logout`                 | Revoke gateway token                 |
| GET      | `/api/v1/auth/me`                     | Current user                         |
| GET      | `/api/v1/auth/users`                  | Users who have logged in             |
| GET      | `/api/v1/session`                     | Auth state                           |
| POST     | `/api/v1/session/refresh`             | Force ShineMonitor re-login          |
| GET      | `/api/v1/devices`                     | Inverter list for the signed-in user |
| GET      | `/api/v1/telemetry/energy-flow`       | Live snapshot                        |
| GET      | `/api/v1/telemetry/history`           | Data logger page                     |
| GET      | `/api/v1/controls/fields`             | Writable settings                    |
| GET      | `/api/v1/controls/fields/:id/value`   | Current value                        |
| PUT      | `/api/v1/controls/fields/:id/value`   | Write one setting                    |
| GET/POST | `/api/v1/controls/profiles/preferred` | Describe / apply the profile         |
| GET      | `/api/v1/alarms`                      | Alarm list                           |
| GET      | `/api/v1/camera/status`               | Camera availability                  |
| GET      | `/api/v1/camera/stream`               | MJPEG stream                         |
| GET      | `/api/v1/camera/snapshot`             | Single JPEG                          |
| POST     | `/api/v1/diagnostics/shine-call`      | Raw signed passthrough               |

Device-scoped endpoints take `pn`, `sn`, `devcode` and `devaddr`, which come from
`GET /devices`.

## Testing

```bash
npm test
```

Covers signature construction, credential encryption, energy flow derivation and
history normalisation. No test contacts the live upstream.
