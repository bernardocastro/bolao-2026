import { withErrorHandling } from '@/lib/api';
import { rankingService } from '@/server/ranking/ranking.service';
import { prisma } from '@/lib/prisma';

interface Ctx {
  params: { poolId: string };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Card compartilhável do ranking (1080x1080, ideal p/ stories e WhatsApp). */
export const GET = withErrorHandling(async (_req: Request, { params }: Ctx) => {
  const pool = await prisma.pool.findUnique({ where: { id: params.poolId } });
  const entries = (await rankingService.forPool(params.poolId)).slice(0, 5);
  const medals = ['🥇', '🥈', '🥉', '4º', '5º'];

  const rows = entries
    .map(
      (e, i) => `
      <text x="120" y="${480 + i * 90}" font-size="40" fill="#ffffff" font-family="sans-serif">${medals[i]}</text>
      <text x="210" y="${480 + i * 90}" font-size="38" fill="#ffffff" font-weight="600" font-family="sans-serif">${escapeXml(e.name.slice(0, 22))}</text>
      <text x="960" y="${480 + i * 90}" font-size="38" fill="#3ed67c" font-weight="700" text-anchor="end" font-family="sans-serif">${e.totalPoints} pts</text>`,
    )
    .join('');

  const svg = `<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="0%" r="100%">
      <stop offset="0%" stop-color="#0e6132"/>
      <stop offset="100%" stop-color="#06130b"/>
    </radialGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <text x="540" y="160" font-size="56" fill="#3ed67c" font-weight="800" text-anchor="middle" font-family="sans-serif">⚽ BOLÃO 2026</text>
  <text x="540" y="250" font-size="44" fill="#ffffff" font-weight="700" text-anchor="middle" font-family="sans-serif">${escapeXml(pool?.name ?? 'Ranking')}</text>
  <text x="540" y="330" font-size="30" fill="#9ca99f" text-anchor="middle" font-family="sans-serif">Ranking parcial · Copa do Mundo 2026</text>
  <line x1="120" y1="390" x2="960" y2="390" stroke="#1a3325" stroke-width="2"/>
  ${rows}
  <text x="540" y="1000" font-size="28" fill="#9ca99f" text-anchor="middle" font-family="sans-serif">bolao2026.app · venha disputar 🏆</text>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=60',
    },
  });
});
