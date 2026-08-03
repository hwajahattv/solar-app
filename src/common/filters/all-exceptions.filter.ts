import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** Statuses at or above this are our fault and deserve a stack trace in the log. */
const SERVER_ERROR_THRESHOLD = 500;

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  error: string;
  path: string;
  timestamp: string;
}

/**
 * Normalises every failure into one JSON shape so web, mobile and TV clients can
 * share a single error-handling path.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status: number =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = this.resolveMessage(exception);

    if (status >= SERVER_ERROR_THRESHOLD) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}: ${message}`,
        (exception as Error)?.stack,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} -> ${status}: ${message}`,
      );
    }

    // Streaming endpoints may already have flushed headers; nothing to send then.
    if (response.headersSent) return;

    const body: ApiErrorBody = {
      statusCode: status,
      message,
      error: HttpStatus[status] ?? 'ERROR',
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  private resolveMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === 'string') return payload;

      const message = (payload as { message?: string | string[] }).message;
      if (Array.isArray(message)) return message.join('; ');
      if (message) return message;
      return exception.message;
    }

    return exception instanceof Error ? exception.message : 'Unexpected error';
  }
}
