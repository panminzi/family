import { createApp } from './app';
import { loadConfig } from './config';
import { startScheduler } from './jobs/scheduler';
import { activateOpenAiServiceIfConfigured } from './services/openai';

function main(): void {
  const cfg = loadConfig();
  const app = createApp();

  const aiActivated = activateOpenAiServiceIfConfigured(cfg.openaiApiKey, cfg.openaiBaseUrl);

  app.listen(cfg.port, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[server] listening on :${cfg.port} (env=${cfg.nodeEnv}, ai=${
        aiActivated ? 'openai' : 'stub'
      })`,
    );
  });

  if (cfg.enableScheduler) {
    const handle = startScheduler({
      cronBreakfast: cfg.cronBreakfast,
      cronLunch: cfg.cronLunch,
      cronDinner: cfg.cronDinner,
    });
    process.on('SIGTERM', () => handle.stop());
    // eslint-disable-next-line no-console
    console.log('[scheduler] started');
  }
}

main();
