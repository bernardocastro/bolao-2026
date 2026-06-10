#!/usr/bin/env bash
set -e
echo "🏆 Bolão 2026 — setup"
[ -f .env ] || cp .env.example .env
echo "→ Subindo Postgres + Redis..."
docker compose up -d postgres redis
echo "→ Instalando dependências..."
npm install
echo "→ Aguardando banco..."
sleep 3
echo "→ Rodando migrations..."
npx prisma migrate dev --name init
echo "→ Populando seeds..."
npm run db:seed
echo "✅ Pronto! Rode: npm run dev:all"
