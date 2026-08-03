import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import type { Response } from 'express';

import type { CameraConfig } from '../config/configuration';

/** Boundary token advertised in the multipart response and produced by ffmpeg's mpjpeg muxer. */
const MJPEG_BOUNDARY = 'ffmpeg';

@Injectable()
export class CameraService {
  private readonly logger = new Logger(CameraService.name);
  private readonly config: CameraConfig;
  private activeStreams = 0;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<CameraConfig>('camera');
  }

  get isConfigured(): boolean {
    return Boolean(this.config.rtspUrl);
  }

  get status(): {
    configured: boolean;
    activeStreams: number;
    maxStreams: number;
  } {
    return {
      configured: this.isConfigured,
      activeStreams: this.activeStreams,
      maxStreams: this.config.maxConcurrentStreams,
    };
  }

  /**
   * Pipes an MJPEG stream to the response. One ffmpeg process is spawned per
   * viewer, so the concurrency cap protects the host from runaway transcoding.
   */
  stream(response: Response, onClose: (handler: () => void) => void): void {
    this.assertConfigured();

    if (this.activeStreams >= this.config.maxConcurrentStreams) {
      throw new ServiceUnavailableException(
        `Camera stream limit reached (${this.config.maxConcurrentStreams} concurrent viewers)`,
      );
    }

    const ffmpeg = spawn(
      this.config.ffmpegPath,
      [
        '-rtsp_transport',
        'tcp',
        '-fflags',
        'nobuffer',
        '-flags',
        'low_delay',
        '-i',
        this.config.rtspUrl,
        '-an',
        '-r',
        String(this.config.fps),
        '-q:v',
        String(this.config.quality),
        '-f',
        'mpjpeg',
        '-',
      ],
      { windowsHide: true },
    );

    this.activeStreams += 1;
    this.logger.log(
      `Camera stream started (${this.activeStreams}/${this.config.maxConcurrentStreams} viewers)`,
    );

    response.writeHead(200, {
      'Content-Type': `multipart/x-mixed-replace; boundary=${MJPEG_BOUNDARY}`,
      'Cache-Control': 'no-cache, no-store',
      Pragma: 'no-cache',
      Connection: 'close',
    });

    ffmpeg.stdout.pipe(response);

    let stderrTail = '';
    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-800);
    });

    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      this.activeStreams = Math.max(0, this.activeStreams - 1);
      if (!ffmpeg.killed) ffmpeg.kill('SIGKILL');
    };

    ffmpeg.on('error', (error) => {
      this.logger.error(`ffmpeg failed to start: ${error.message}`);
      release();
      response.end();
    });

    ffmpeg.on('close', (code) => {
      if (code)
        this.logger.warn(`ffmpeg exited with code ${code}:\n${stderrTail}`);
      release();
      response.end();
    });

    onClose(release);
  }

  /** Captures a single frame, used as a poster image and by clients that cannot hold a stream open. */
  async snapshot(): Promise<Buffer> {
    this.assertConfigured();

    const ffmpeg = spawn(
      this.config.ffmpegPath,
      [
        '-rtsp_transport',
        'tcp',
        '-i',
        this.config.rtspUrl,
        '-frames:v',
        '1',
        '-q:v',
        '5',
        '-f',
        'image2',
        '-update',
        '1',
        '-',
      ],
      { windowsHide: true },
    );

    const chunks: Buffer[] = [];
    ffmpeg.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));

    const timeout = setTimeout(() => {
      if (!ffmpeg.killed) ffmpeg.kill('SIGKILL');
    }, this.config.snapshotTimeoutMs);

    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg.on('error', reject);
        ffmpeg.on('close', () => resolve());
      });
    } finally {
      clearTimeout(timeout);
    }

    const frame = Buffer.concat(chunks);
    if (frame.length === 0) {
      throw new ServiceUnavailableException(
        'The camera did not return a frame',
      );
    }

    return frame;
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'CAMERA_RTSP is not configured on this deployment',
      );
    }
  }
}
