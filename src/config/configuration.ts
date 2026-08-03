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

export interface AppConfiguration {
  port: number;
  corsOrigins: string[];
  /** IANA zone used to interpret upstream wall-clock timestamps and "today". */
  timezone: string;
  shine: ShineConfig;
  camera: CameraConfig;
}

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const configuration = (): AppConfiguration => ({
  port: toInt(process.env.PORT, 3000),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
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
});
