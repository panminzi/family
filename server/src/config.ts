import 'dotenv/config';

export interface AppConfig {
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  databaseUrl: string;
  uploadsDir: string;
  openaiApiKey: string | null;
  openaiBaseUrl: string | null;
  // Cron expressions for the three meals.
  cronBreakfast: string;
  cronLunch: string;
  cronDinner: string;
  cronSummary: string;
  // When true, the scheduler is started at boot. Tests turn this off.
  enableScheduler: boolean;
  nodeEnv: 'development' | 'production' | 'test';
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v === '1' || v.toLowerCase() === 'true';
}

export function loadConfig(): AppConfig {
  const env = (process.env.NODE_ENV ?? 'development') as AppConfig['nodeEnv'];
  return {
    port: Number(process.env.PORT ?? 3000),
    jwtSecret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret-please-override',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    databaseUrl: process.env.DATABASE_URL ?? '',
    uploadsDir: process.env.UPLOADS_DIR ?? 'uploads',
    openaiApiKey: process.env.OPENAI_API_KEY?.trim() || null,
    openaiBaseUrl: process.env.OPENAI_BASE_URL?.trim() || null,
    cronBreakfast: process.env.CRON_BREAKFAST ?? '30 7 * * *',
    cronLunch: process.env.CRON_LUNCH ?? '0 12 * * *',
    cronDinner: process.env.CRON_DINNER ?? '30 18 * * *',
    cronSummary: process.env.CRON_SUMMARY ?? '0 2 * * 0',
    enableScheduler: envBool('ENABLE_SCHEDULER', env === 'production'),
    nodeEnv: env,
  };
}
