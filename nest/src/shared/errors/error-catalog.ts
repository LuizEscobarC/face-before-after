export interface ApiFieldError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: string;
  fieldErrors?: ApiFieldError[];
  metadata?: Record<string, unknown>;
}

export const ERROR_CODES = {
  COMMON_INVALID_REQUEST: 'COMMON_INVALID_REQUEST',
  COMMON_VALIDATION_FAILED: 'COMMON_VALIDATION_FAILED',
  COMMON_INTERNAL_SERVER_ERROR: 'COMMON_INTERNAL_SERVER_ERROR',
  COMMON_NOT_FOUND: 'COMMON_NOT_FOUND',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  VISION_UPSTREAM_ERROR: 'VISION_UPSTREAM_ERROR',
  VISION_TIMEOUT: 'VISION_TIMEOUT',
  PHOTO_QUALITY_REJECTED: 'PHOTO_QUALITY_REJECTED',
} as const;

export const ERROR_MESSAGES = {
  common: {
    invalidRequest: 'A requisição enviada é inválida.',
    validationFailed: 'Os dados informados são inválidos. Revise os campos e tente novamente.',
    internalServerError:
      'Não foi possível concluir a operação agora. Tente novamente em instantes.',
    notFound: 'Recurso não encontrado.',
  },
  auth: {
    unauthorized: 'Sua sessão é inválida ou expirou.',
    forbidden: 'Você não tem permissão para executar esta operação.',
  },
  vision: {
    upstreamError: 'O serviço de visão computacional retornou um erro.',
    timeout: 'O serviço de visão computacional demorou demais para responder.',
  },
  photoQuality: {
    rejected: 'A foto enviada não atende aos requisitos mínimos de qualidade.',
  },
} as const;

export function createApiError(payload: ApiErrorPayload): ApiErrorPayload {
  return payload;
}
