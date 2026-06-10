# 🚀 Deploy em produção

Arquitetura de produção (a Vercel é serverless — Socket.IO e worker vivem fora):

```
Vercel (Next.js)  ──── Neon (Postgres, pooled)
   │  publish                │
   └──── Upstash (Redis) ────┤
              │ pub/sub      │
   Railway/Render            │
   ├─ realtime (Socket.IO) ◀─┘
   └─ sync worker (opcional)
```

## 1. Banco — Neon (grátis)

1. [neon.tech](https://neon.tech) → novo projeto → copie as duas connection strings:
   - **Pooled** (`...-pooler...`) → `DATABASE_URL`
   - **Direct** → `DIRECT_URL` (usada só pelas migrations)
2. Seed (uma vez, da sua máquina):
   ```bash
   DATABASE_URL="<pooled>" DIRECT_URL="<direct>" npx prisma migrate deploy
   DATABASE_URL="<pooled>" npm run db:seed
   ```

## 2. Redis — Upstash (grátis)

[upstash.com](https://upstash.com) → criar Redis → copie a URL **TLS** (`rediss://default:...@....upstash.io:6379`) → `REDIS_URL`. O ioredis funciona direto com `rediss://`.

## 3. Realtime — Railway ou Render

Crie um serviço Node apontando para o repositório:

- **Build:** `npm install`
- **Start:** `npx tsx realtime/server.ts`
- **Env:** `REDIS_URL`, `JWT_ACCESS_SECRET` (igual ao da Vercel!), `SOCKET_CORS_ORIGIN=https://SEU-APP.vercel.app`
- O servidor usa `process.env.PORT` automaticamente.

Anote a URL pública (ex.: `https://bolao-realtime.up.railway.app`).

> Render free hiberna após 15 min ocioso (sockets caem e religam). Para uso sério em dias de jogo, Railway/Render pagos (~US$5/mês) mantêm o processo vivo.

## 4. Web — Vercel

1. Suba o repositório no GitHub e importe na Vercel.
2. O `vercel-build` já roda `prisma generate && prisma migrate deploy && next build`.
3. Variáveis de ambiente (Production):

| Variável | Valor |
|---|---|
| `DATABASE_URL` | pooled do Neon |
| `DIRECT_URL` | direct do Neon |
| `REDIS_URL` | rediss:// do Upstash |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | segredos novos e fortes (32+ chars) |
| `NEXT_PUBLIC_APP_URL` | `https://SEU-APP.vercel.app` |
| `NEXT_PUBLIC_SOCKET_URL` | URL do realtime (passo 3) |
| `CRON_SECRET` | segredo forte (o Vercel Cron envia `Authorization: Bearer` com ele) |
| `FOOTBALL_PROVIDER` | `api-football` |
| `FOOTBALL_API_KEY` | sua chave |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | do Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://SEU-APP.vercel.app/api/auth/google/callback` |

4. No Google Cloud Console, adicione o redirect URI de produção no OAuth client.

## 5. Sincronização em produção

- **Plano Hobby da Vercel:** cron só 1×/dia (`vercel.json` já configura 12:00 UTC). Para sync frequente grátis, use [cron-job.org](https://cron-job.org): `POST https://SEU-APP.vercel.app/api/internal/sync` com header `x-cron-secret: <CRON_SECRET>` a cada 1–5 min nos dias de jogo.
- **Alternativa:** rode o worker (`npx tsx scripts/sync.ts`) como segundo serviço no Railway com `APP_URL=https://SEU-APP.vercel.app`.
- **Plano Pro:** mude o schedule do `vercel.json` para `*/5 * * * *` e apague o resto.

## 6. Checklist final

- [ ] Login/cadastro funcionando no domínio de produção
- [ ] Socket conecta (badge "AO VIVO" / toasts) — confira o console do navegador
- [ ] `POST /api/internal/sync` com o secret retorna summary
- [ ] Login Google redireciona certo
- [ ] Convide os amigos com o código do bolão 🏆
