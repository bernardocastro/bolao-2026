# ⚽ Bolão 2026

Bolão da Copa do Mundo 2026 com **ranking em tempo real**, feed social, conquistas e ligas privadas. Stack: Next.js 14 (App Router) · TypeScript · Prisma · PostgreSQL · Redis · Socket.IO · TailwindCSS · Docker.

```
joao acertou o placar de Brasil 3x1 Argentina 🎯  →  +10 pts  →  📈 subiu para o top 3
```

## 🚀 Quick start

Pré-requisitos: Node 20+, Docker.

```bash
cp .env.example .env
npm run setup          # docker (postgres+redis) + install + migrate + seed
npm run dev:all        # web :3000 + realtime :3001
```

Ou tudo em containers:

```bash
docker compose up --build
```

Logins de demonstração (seed):

| Usuário | E-mail | Senha |
|---|---|---|
| João (dono do bolão demo) | `joao@example.com` | `senha123` |
| Admin | `admin@bolao2026.app` | `senha123` |

Código de convite demo: **`FIRMA26`**

## 🏗️ Arquitetura

```
┌─────────────┐   HTTP    ┌──────────────────────────────┐
│   Browser    │──────────▶│  Next.js (RSC + API Routes)  │
│              │           │  src/server/* (services)      │
│  Socket.IO   │           └──────────┬───────────────────┘
│   client     │                      │ Prisma        │ publish
│      ▲       │           ┌──────────▼─────┐   ┌─────▼─────┐
│      │       │           │   PostgreSQL    │   │   Redis    │
│      │       │           └────────────────┘   │ cache+pub/sub
│      │  WS   │                                 └─────┬─────┘
│      └───────┼──────────┐                            │ subscribe
└──────────────┘          ▼                            │
                  ┌──────────────────┐                 │
                  │ realtime/server  │◀────────────────┘
                  │   (Socket.IO)    │  fan-out: pool:{id} user:{id}
                  └──────────────────┘
```

- **Clean architecture por feature**: `src/server/{auth,pools,bets,matches,ranking,feed,achievements,notifications,football}` — DTOs (Zod), services, domínio puro (`scoring.engine.ts` é função pura testável).
- **Realtime desacoplado**: a API publica eventos no Redis; o servidor Socket.IO faz fan-out por rooms. Escala horizontal sem sticky sessions na API.
- **Provider de futebol plugável** (`football.provider.ts`): `mock` (resultados via painel admin) ou `api-football` — troque via env, sem tocar no domínio.

### Fluxo de pontuação (o coração do produto)

Admin lança resultado → `resultService.setResult`:
1. pontua todas as apostas (regras **por bolão**: placar exato, diferença de gols, vencedor, bônus zebra, bônus "único a acertar");
2. atualiza agregados (`PoolMember.totalPoints`, streak);
3. recalcula ranking + snapshot da rodada + detecta subida/queda;
4. publica feed ("João cravou o placar!"), conquistas e notificações;
5. emite tudo via Socket.IO — ranking e feed atualizam ao vivo, com animação.

## 📁 Estrutura

```
prisma/            schema + seed (48 seleções, 72 jogos da fase de grupos)
realtime/          servidor Socket.IO standalone
src/
  app/             App Router: (auth), (app), api/
  components/      ui/ (design system) · layout/ · features/
  hooks/           use-socket, use-current-user
  lib/             prisma, redis, jwt, session, rate-limit, api helpers
  server/          domínio por feature (DTOs, services, engine)
  middleware.ts    proteção de rotas + RBAC admin
```

## 🔐 Segurança

JWT access (15min) + refresh com **rotação e detecção de reuso** · cookies `httpOnly`/`secure`/`sameSite` · rate limiting Redis (login, cadastro, comentários — anti-spam) · validação Zod em todas as rotas · headers de segurança (CSP-ready) · sanitização de conteúdo · CSRF mitigado por SameSite + tokens em cookie separado de path.

## 🧪 Scripts

| Comando | Descrição |
|---|---|
| `npm run dev:all` | web + realtime em watch |
| `npm run db:migrate` / `db:seed` / `db:studio` | banco |
| `npm run lint` / `typecheck` / `format` | qualidade (husky roda no pre-commit) |
| `npm run build` | build de produção |

## 🔌 Exemplos de API

```bash
# login
curl -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"joao@example.com","password":"senha123"}' -c cookies.txt

# criar bolão
curl -X POST localhost:3000/api/pools -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"Bolão dos Cria","pointsExactScore":10}'

# palpitar
curl -X PUT localhost:3000/api/bets -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"poolId":"...","matchId":"...","homeScore":3,"awayScore":1}'

# lançar resultado (admin) → dispara toda a cadeia em tempo real
curl -X POST localhost:3000/api/admin/matches/{id}/result -b cookies.txt \
  -H 'Content-Type: application/json' -d '{"homeScore":3,"awayScore":1}'

# card compartilhável do ranking (SVG 1080x1080)
open localhost:3000/api/share/{poolId}
```

## 🗺️ Roadmap

- [ ] Push notifications (Web Push/VAPID) — toasts e in-app já implementados
- [ ] Palpites de classificados do mata-mata (schema já suporta `advancingTeamId`)
- [ ] Virtualização de listas longas (`@tanstack/react-virtual` já no bundle)
- [ ] Testes: `scoring.engine.ts` é puro — comece por ele
