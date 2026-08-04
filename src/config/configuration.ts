import { resolveControlsSecret } from '../controls/controls-auth.util';

export interface ShineConfig {
  upstreamUrl: string;
  companyKey: string;
  username: string;
  password: string;
  requestTimeoutMs: number;
  locale: string;
}

export interface CameraConfig {
  rtspUrl: string;
  ffmpegPath: string;
  fps: number;
  quality: number;
  maxConcurrentStreams: number;
  snapshotTimeoutMs: number;
}

export interface ControlsConfig {
  password: string;
  secret: string;
}

export interface AppConfiguration {
  port: number;
  corsOrigins: string[];
  /** IANA zone used to interpret upstream wall-clock timestamps and "today". */
  timezone: string;
  shine: ShineConfig;
  camera: CameraConfig;
  controls: ControlsConfig;
}

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Normalize CORS origins from env.
 * Vercel/dashboard values often include quotes or a trailing slash; browsers
 * never send those, so an unnormalized allowlist silently rejects the SPA.
 */
export function parseCorsOrigins(raw: string | undefined): string[] {
  const source = raw?.trim() ? raw : 'http://localhost:4200';
  return source
    .split(/[\n,]/)
    .map((origin) =>
      origin
        .trim()
        .replace(/^['"]+|['"]+$/g, '')
        .replace(/\/+$/, ''),
    )
    .filter(Boolean);
}

export const configuration = (): AppConfiguration => {
  const controlsPassword = process.env.CONTROLS_PASSWORD ?? '';
  return {
    port: toInt(process.env.PORT, 3000),
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
    timezone: process.env.APP_TIMEZONE ?? 'Asia/Karachi',
    shine: {
      upstreamUrl:
        process.env.SHINE_UPSTREAM_URL ??
        'http://android.shinemonitor.com/public/',
      companyKey: process.env.SHINE_COMPANY_KEY ?? 'bnrl_frRFjEz8Mkn',
      username: process.env.SHINE_USR ?? '',
      password: process.env.SHINE_PWD ?? '',
      requestTimeoutMs: toInt(process.env.SHINE_TIMEOUT_MS, 30000),
      locale: process.env.SHINE_LOCALE ?? 'en_US',
    },
    camera: {
      rtspUrl: process.env.CAMERA_RTSP ?? '',
      ffmpegPath: process.env.FFMPEG_PATH ?? 'ffmpeg',
      fps: toInt(process.env.CAMERA_FPS, 10),
      quality: toInt(process.env.CAMERA_QUALITY, 6),
      maxConcurrentStreams: toInt(process.env.CAMERA_MAX_STREAMS, 3),
      snapshotTimeoutMs: toInt(process.env.CAMERA_SNAPSHOT_TIMEOUT_MS, 15000),
    },
    controls: {
      password: controlsPassword,
      secret: resolveControlsSecret(
        controlsPassword,
        process.env.CONTROLS_SECRET ?? '',
      ),
    },
  };
};
