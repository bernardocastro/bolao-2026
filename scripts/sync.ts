/* eslint-disable no-console */
/**
 * Worker de sincronização: chama o endpoint interno em intervalo fixo.
 * Roda como processo separado (dev: npm run dev:sync · prod: container "sync").
 */
const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const INTERVAL = Number(process.env.SYNC_INTERVAL_SECONDS ?? 60) * 1000;
const SECRET = process.env.CRON_SECRET ?? '';

async function tick(): Promise<void> {
  try {
    const res = await fetch(`${APP_URL}/api/internal/sync`, {
      method: 'POST',
      headers: { 'x-cron-secret': SECRET },
    });
    const data = (await res.json()) as { summary?: Record<string, unknown>; error?: string };
    if (!res.ok) {
      console.error(`[sync] ${res.status}: ${data.error ?? 'erro'}`);
      return;
    }
    const s = data.summary ?? {};
    console.info(
      `[sync] fixtures=${s.fetched} vinculados=${s.linked} horários=${s.kickoffUpdated} ` +
        `ao-vivo=${s.liveUpdated} encerrados=${s.finishedProcessed} sem-par=${s.unmatched}`,
    );
    const errors = s.errors as string[] | undefined;
    if (errors?.length) console.error('[sync] erros:', errors.slice(0, 5));
  } catch (error) {
    console.error('[sync] falha:', error instanceof Error ? error.message : error);
  }
}

console.info(`⚽ Sync worker — a cada ${INTERVAL / 1000}s contra ${APP_URL}`);
void tick();
setInterval(() => void tick(), INTERVAL);
