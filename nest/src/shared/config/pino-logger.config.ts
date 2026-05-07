import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'local';
const isProduction = process.env.NODE_ENV === 'production';

export const pinoLogger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isDevelopment ? 'debug' : 'info'),
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: label => {
        return { level: label };
      },
    },
  },
  isDevelopment
    ? pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          messageKey: 'msg',
          levelFirst: false,
          singleLine: false,
          translateTime: 'SYS:HH:MM:ss Z',
          ignore: 'pid,hostname',
          crlf: false,
        },
      })
    : undefined,
);

const HEALTH_CHECK_PATHS = new Set(['/', '/health']);
const HEALTH_CHECK_UA_PREFIXES = ['ELB-HealthChecker', 'kube-probe', 'GoogleHC'];

function isHealthCheckRequest(req: any): boolean {
  const url: string = req.url ?? '';
  const ua: string = req.headers?.['user-agent'] ?? '';
  const path = url.split('?')[0];
  return (
    HEALTH_CHECK_PATHS.has(path) && HEALTH_CHECK_UA_PREFIXES.some(prefix => ua.startsWith(prefix))
  );
}

export const pinoHttpLogger =
  isDevelopment || isProduction
    ? {
        logger: pinoLogger,
        customLogLevel: (req: any, res: any, err: unknown): pino.Level | 'silent' => {
          if (err || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          if (isHealthCheckRequest(req)) return 'silent';
          return 'info';
        },
        serializers: {
          req: (req: any) => ({
            method: req.method,
            url: req.url,
            headers: req.headers,
          }),
          res: (res: any) => ({
            statusCode: res.statusCode,
          }),
        },
      }
    : false;
