import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createApiError,
  ERROR_CODES,
  ERROR_MESSAGES,
  type ApiErrorPayload,
  type ApiFieldError,
} from './error-catalog.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const normalized = this.normalizeException(exception, status);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${String(status)}: ${normalized.message}`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception),
      );
    }

    response.status(status).send({
      success: false,
      message: normalized.message,
      error: {
        statusCode: status,
        ...normalized,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private normalizeException(exception: unknown, status: number): ApiErrorPayload {
    if (exception instanceof HttpException) {
      return this.normalizeHttpException(exception, status);
    }

    if (exception instanceof Error) {
      return createApiError({
        code: ERROR_CODES.COMMON_INTERNAL_SERVER_ERROR,
        message: ERROR_MESSAGES.common.internalServerError,
        details: exception.message,
      });
    }

    return createApiError({
      code: ERROR_CODES.COMMON_INTERNAL_SERVER_ERROR,
      message: ERROR_MESSAGES.common.internalServerError,
    });
  }

  private normalizeHttpException(exception: HttpException, status: number): ApiErrorPayload {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return createApiError({
        code: this.defaultCode(status),
        message: response,
      });
    }

    if (typeof response === 'object') {
      const candidate = response as {
        code?: string;
        details?: string;
        message?: string | string[];
        error?: string;
        fieldErrors?: ApiFieldError[];
        errors?: {
          property?: string;
          constraints?: Record<string, string>;
          value?: unknown;
          message?: string;
        }[];
      };

      const normalizedFieldErrors = this.normalizeFieldErrors(candidate);
      const normalizedMessage = this.normalizeMessage(candidate.message, status);

      return createApiError({
        code: candidate.code ?? this.defaultCode(status),
        message: normalizedMessage,
        details:
          candidate.details ?? (typeof candidate.error === 'string' ? candidate.error : undefined),
        ...(normalizedFieldErrors.length > 0 ? { fieldErrors: normalizedFieldErrors } : {}),
      });
    }

    return createApiError({
      code: this.defaultCode(status),
      message: this.defaultMessage(status),
    });
  }

  private normalizeMessage(message: string | string[] | undefined, status: number): string {
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }

    if (Array.isArray(message) && message.length > 0) {
      return ERROR_MESSAGES.common.validationFailed;
    }

    return this.defaultMessage(status);
  }

  private normalizeFieldErrors(candidate: {
    fieldErrors?: ApiFieldError[];
    errors?: {
      property?: string;
      constraints?: Record<string, string>;
      value?: unknown;
      message?: string;
    }[];
    message?: string | string[];
  }): ApiFieldError[] {
    if (Array.isArray(candidate.fieldErrors) && candidate.fieldErrors.length > 0) {
      return candidate.fieldErrors;
    }

    if (Array.isArray(candidate.errors) && candidate.errors.length > 0) {
      return candidate.errors.flatMap(error => {
        if (error.constraints) {
          return Object.values(error.constraints).map(message => ({
            field: error.property ?? 'body',
            message,
            value: error.value,
          }));
        }

        if (error.message) {
          return [
            {
              field: error.property ?? 'body',
              message: error.message,
              value: error.value,
            },
          ];
        }

        return [];
      });
    }

    if (Array.isArray(candidate.message)) {
      return candidate.message.map(message => ({
        field: 'body',
        message,
      }));
    }

    return [];
  }

  private defaultCode(status: number): string {
    switch (status) {
      case 400:
        return ERROR_CODES.COMMON_INVALID_REQUEST;
      case 401:
        return ERROR_CODES.AUTH_UNAUTHORIZED;
      case 403:
        return ERROR_CODES.AUTH_FORBIDDEN;
      case 404:
        return ERROR_CODES.COMMON_NOT_FOUND;
      default:
        return ERROR_CODES.COMMON_INTERNAL_SERVER_ERROR;
    }
  }

  private defaultMessage(status: number): string {
    switch (status) {
      case 400:
        return ERROR_MESSAGES.common.invalidRequest;
      case 401:
        return ERROR_MESSAGES.auth.unauthorized;
      case 403:
        return ERROR_MESSAGES.auth.forbidden;
      case 404:
        return ERROR_MESSAGES.common.notFound;
      default:
        return ERROR_MESSAGES.common.internalServerError;
    }
  }
}
