/* eslint-disable no-console */
import { PrismaClient, MatchStage } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Grupos OFICIAIS da Copa do Mundo 2026 (sorteio de 05/12/2025 + repescagens).
 * Ordem dos times = posição do sorteio (1–4), usada para montar os confrontos:
 *   Rodada 1: 1×2 e 3×4 · Rodada 2: 1×3 e 4×2 · Rodada 3: 4×1 e 2×3
 * Fonte: FIFA / Wikipedia (2026 FIFA World Cup).
 */
const GROUPS: Record<string, Array<{ name: string; code: string; iso: string }>> = {
  A: [
    { name: 'México', code: 'MEX', iso: 'mx' },
    { name: 'África do Sul', code: 'RSA', iso: 'za' },
    { name: 'Coreia do Sul', code: 'KOR', iso: 'kr' },
    { name: 'Tchéquia', code: 'CZE', iso: 'cz' },
  ],
  B: [
    { name: 'Canadá', code: 'CAN', iso: 'ca' },
    { name: 'Bósnia e Herzegovina', code: 'BIH', iso: 'ba' },
    { name: 'Catar', code: 'QAT', iso: 'qa' },
    { name: 'Suíça', code: 'SUI', iso: 'ch' },
  ],
  C: [
    { name: 'Brasil', code: 'BRA', iso: 'br' },
    { name: 'Marrocos', code: 'MAR', iso: 'ma' },
    { name: 'Haiti', code: 'HAI', iso: 'ht' },
    { name: 'Escócia', code: 'SCO', iso: 'gb-sct' },
  ],
  D: [
    { name: 'Estados Unidos', code: 'USA', iso: 'us' },
    { name: 'Paraguai', code: 'PAR', iso: 'py' },
    { name: 'Austrália', code: 'AUS', iso: 'au' },
    { name: 'Turquia', code: 'TUR', iso: 'tr' },
  ],
  E: [
    { name: 'Alemanha', code: 'GER', iso: 'de' },
    { name: 'Curaçao', code: 'CUW', iso: 'cw' },
    { name: 'Costa do Marfim', code: 'CIV', iso: 'ci' },
    { name: 'Equador', code: 'ECU', iso: 'ec' },
  ],
  F: [
    { name: 'Países Baixos', code: 'NED', iso: 'nl' },
    { name: 'Japão', code: 'JPN', iso: 'jp' },
    { name: 'Suécia', code: 'SWE', iso: 'se' },
    { name: 'Tunísia', code: 'TUN', iso: 'tn' },
  ],
  G: [
    { name: 'Bélgica', code: 'BEL', iso: 'be' },
    { name: 'Egito', code: 'EGY', iso: 'eg' },
    { name: 'Irã', code: 'IRN', iso: 'ir' },
    { name: 'Nova Zelândia', code: 'NZL', iso: 'nz' },
  ],
  H: [
    { name: 'Espanha', code: 'ESP', iso: 'es' },
    { name: 'Cabo Verde', code: 'CPV', iso: 'cv' },
    { name: 'Arábia Saudita', code: 'KSA', iso: 'sa' },
    { name: 'Uruguai', code: 'URU', iso: 'uy' },
  ],
  I: [
    { name: 'França', code: 'FRA', iso: 'fr' },
    { name: 'Senegal', code: 'SEN', iso: 'sn' },
    { name: 'Iraque', code: 'IRQ', iso: 'iq' },
    { name: 'Noruega', code: 'NOR', iso: 'no' },
  ],
  J: [
    { name: 'Argentina', code: 'ARG', iso: 'ar' },
    { name: 'Argélia', code: 'ALG', iso: 'dz' },
    { name: 'Áustria', code: 'AUT', iso: 'at' },
    { name: 'Jordânia', code: 'JOR', iso: 'jo' },
  ],
  K: [
    { name: 'Portugal', code: 'POR', iso: 'pt' },
    { name: 'RD Congo', code: 'COD', iso: 'cd' },
    { name: 'Uzbequistão', code: 'UZB', iso: 'uz' },
    { name: 'Colômbia', code: 'COL', iso: 'co' },
  ],
  L: [
    { name: 'Inglaterra', code: 'ENG', iso: 'gb-eng' },
    { name: 'Croácia', code: 'CRO', iso: 'hr' },
    { name: 'Gana', code: 'GHA', iso: 'gh' },
    { name: 'Panamá', code: 'PAN', iso: 'pa' },
  ],
};

/**
 * Calendário OFICIAL da fase de grupos — 72 jogos com horário exato (UTC)
 * e estádio, conforme tabela divulgada pela FIFA em 06/12/2025.
 * Horários originais em ET (UTC-4) convertidos para UTC.
 */
interface Fixture {
  home: string;
  away: string;
  round: number;
  utc: string;
  venue: string;
}

const FIXTURES: Fixture[] = [
  { home: 'MEX', away: 'RSA', round: 1, utc: '2026-06-11T19:00:00Z', venue: 'Estadio Azteca, Cidade do México' },
  { home: 'KOR', away: 'CZE', round: 1, utc: '2026-06-12T02:00:00Z', venue: 'Estadio Akron, Zapopan' },
  { home: 'CAN', away: 'BIH', round: 1, utc: '2026-06-12T19:00:00Z', venue: 'BMO Field, Toronto' },
  { home: 'USA', away: 'PAR', round: 1, utc: '2026-06-13T01:00:00Z', venue: 'SoFi Stadium, Inglewood' },
  { home: 'QAT', away: 'SUI', round: 1, utc: '2026-06-13T19:00:00Z', venue: "Levi's Stadium, Santa Clara" },
  { home: 'BRA', away: 'MAR', round: 1, utc: '2026-06-13T22:00:00Z', venue: 'MetLife Stadium, East Rutherford' },
  { home: 'HAI', away: 'SCO', round: 1, utc: '2026-06-14T01:00:00Z', venue: 'Gillette Stadium, Foxborough' },
  { home: 'AUS', away: 'TUR', round: 1, utc: '2026-06-14T16:00:00Z', venue: 'BC Place, Vancouver' },
  { home: 'GER', away: 'CUW', round: 1, utc: '2026-06-14T17:00:00Z', venue: 'NRG Stadium, Houston' },
  { home: 'NED', away: 'JPN', round: 1, utc: '2026-06-14T20:00:00Z', venue: 'AT&T Stadium, Arlington' },
  { home: 'CIV', away: 'ECU', round: 1, utc: '2026-06-14T23:00:00Z', venue: 'Lincoln Financial Field, Filadélfia' },
  { home: 'SWE', away: 'TUN', round: 1, utc: '2026-06-15T02:00:00Z', venue: 'Estadio BBVA, Monterrey' },
  { home: 'ESP', away: 'CPV', round: 1, utc: '2026-06-15T16:00:00Z', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { home: 'BEL', away: 'EGY', round: 1, utc: '2026-06-15T19:00:00Z', venue: 'Lumen Field, Seattle' },
  { home: 'KSA', away: 'URU', round: 1, utc: '2026-06-15T22:00:00Z', venue: 'Hard Rock Stadium, Miami Gardens' },
  { home: 'IRN', away: 'NZL', round: 1, utc: '2026-06-16T01:00:00Z', venue: 'SoFi Stadium, Inglewood' },
  { home: 'FRA', away: 'SEN', round: 1, utc: '2026-06-16T19:00:00Z', venue: 'MetLife Stadium, East Rutherford' },
  { home: 'IRQ', away: 'NOR', round: 1, utc: '2026-06-16T22:00:00Z', venue: 'Gillette Stadium, Foxborough' },
  { home: 'ARG', away: 'ALG', round: 1, utc: '2026-06-17T01:00:00Z', venue: 'Arrowhead Stadium, Kansas City' },
  { home: 'AUT', away: 'JOR', round: 1, utc: '2026-06-17T04:00:00Z', venue: "Levi's Stadium, Santa Clara" },
  { home: 'POR', away: 'COD', round: 1, utc: '2026-06-17T17:00:00Z', venue: 'NRG Stadium, Houston' },
  { home: 'ENG', away: 'CRO', round: 1, utc: '2026-06-17T20:00:00Z', venue: 'AT&T Stadium, Arlington' },
  { home: 'GHA', away: 'PAN', round: 1, utc: '2026-06-17T23:00:00Z', venue: 'BMO Field, Toronto' },
  { home: 'UZB', away: 'COL', round: 1, utc: '2026-06-18T02:00:00Z', venue: 'Estadio Azteca, Cidade do México' },
  { home: 'CZE', away: 'RSA', round: 2, utc: '2026-06-18T16:00:00Z', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { home: 'SUI', away: 'BIH', round: 2, utc: '2026-06-18T19:00:00Z', venue: 'SoFi Stadium, Inglewood' },
  { home: 'CAN', away: 'QAT', round: 2, utc: '2026-06-18T22:00:00Z', venue: 'BC Place, Vancouver' },
  { home: 'MEX', away: 'KOR', round: 2, utc: '2026-06-19T01:00:00Z', venue: 'Estadio Akron, Zapopan' },
  { home: 'USA', away: 'AUS', round: 2, utc: '2026-06-19T19:00:00Z', venue: 'Lumen Field, Seattle' },
  { home: 'SCO', away: 'MAR', round: 2, utc: '2026-06-19T22:00:00Z', venue: 'Gillette Stadium, Foxborough' },
  { home: 'BRA', away: 'HAI', round: 2, utc: '2026-06-20T00:30:00Z', venue: 'Lincoln Financial Field, Filadélfia' },
  { home: 'TUR', away: 'PAR', round: 2, utc: '2026-06-20T03:00:00Z', venue: "Levi's Stadium, Santa Clara" },
  { home: 'NED', away: 'SWE', round: 2, utc: '2026-06-20T17:00:00Z', venue: 'NRG Stadium, Houston' },
  { home: 'GER', away: 'CIV', round: 2, utc: '2026-06-20T20:00:00Z', venue: 'BMO Field, Toronto' },
  { home: 'ECU', away: 'CUW', round: 2, utc: '2026-06-21T00:00:00Z', venue: 'Arrowhead Stadium, Kansas City' },
  { home: 'TUN', away: 'JPN', round: 2, utc: '2026-06-21T04:00:00Z', venue: 'Estadio BBVA, Monterrey' },
  { home: 'ESP', away: 'KSA', round: 2, utc: '2026-06-21T16:00:00Z', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { home: 'BEL', away: 'IRN', round: 2, utc: '2026-06-21T19:00:00Z', venue: 'SoFi Stadium, Inglewood' },
  { home: 'URU', away: 'CPV', round: 2, utc: '2026-06-21T22:00:00Z', venue: 'Hard Rock Stadium, Miami Gardens' },
  { home: 'NZL', away: 'EGY', round: 2, utc: '2026-06-22T01:00:00Z', venue: 'BC Place, Vancouver' },
  { home: 'ARG', away: 'AUT', round: 2, utc: '2026-06-22T17:00:00Z', venue: 'AT&T Stadium, Arlington' },
  { home: 'FRA', away: 'IRQ', round: 2, utc: '2026-06-22T21:00:00Z', venue: 'Lincoln Financial Field, Filadélfia' },
  { home: 'NOR', away: 'SEN', round: 2, utc: '2026-06-23T00:00:00Z', venue: 'MetLife Stadium, East Rutherford' },
  { home: 'JOR', away: 'ALG', round: 2, utc: '2026-06-23T03:00:00Z', venue: "Levi's Stadium, Santa Clara" },
  { home: 'POR', away: 'UZB', round: 2, utc: '2026-06-23T17:00:00Z', venue: 'NRG Stadium, Houston' },
  { home: 'ENG', away: 'GHA', round: 2, utc: '2026-06-23T20:00:00Z', venue: 'Gillette Stadium, Foxborough' },
  { home: 'PAN', away: 'CRO', round: 2, utc: '2026-06-23T23:00:00Z', venue: 'BMO Field, Toronto' },
  { home: 'COL', away: 'COD', round: 2, utc: '2026-06-24T02:00:00Z', venue: 'Estadio Akron, Zapopan' },
  { home: 'SUI', away: 'CAN', round: 3, utc: '2026-06-24T19:00:00Z', venue: 'BC Place, Vancouver' },
  { home: 'BIH', away: 'QAT', round: 3, utc: '2026-06-24T19:00:00Z', venue: 'Lumen Field, Seattle' },
  { home: 'SCO', away: 'BRA', round: 3, utc: '2026-06-24T22:00:00Z', venue: 'Hard Rock Stadium, Miami Gardens' },
  { home: 'MAR', away: 'HAI', round: 3, utc: '2026-06-24T22:00:00Z', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { home: 'CZE', away: 'MEX', round: 3, utc: '2026-06-25T01:00:00Z', venue: 'Estadio Azteca, Cidade do México' },
  { home: 'RSA', away: 'KOR', round: 3, utc: '2026-06-25T01:00:00Z', venue: 'Estadio BBVA, Monterrey' },
  { home: 'CUW', away: 'CIV', round: 3, utc: '2026-06-25T20:00:00Z', venue: 'Lincoln Financial Field, Filadélfia' },
  { home: 'ECU', away: 'GER', round: 3, utc: '2026-06-25T20:00:00Z', venue: 'MetLife Stadium, East Rutherford' },
  { home: 'JPN', away: 'SWE', round: 3, utc: '2026-06-25T23:00:00Z', venue: 'AT&T Stadium, Arlington' },
  { home: 'TUN', away: 'NED', round: 3, utc: '2026-06-25T23:00:00Z', venue: 'Arrowhead Stadium, Kansas City' },
  { home: 'TUR', away: 'USA', round: 3, utc: '2026-06-26T02:00:00Z', venue: 'SoFi Stadium, Inglewood' },
  { home: 'PAR', away: 'AUS', round: 3, utc: '2026-06-26T02:00:00Z', venue: "Levi's Stadium, Santa Clara" },
  { home: 'NOR', away: 'FRA', round: 3, utc: '2026-06-26T19:00:00Z', venue: 'Gillette Stadium, Foxborough' },
  { home: 'SEN', away: 'IRQ', round: 3, utc: '2026-06-26T19:00:00Z', venue: 'BMO Field, Toronto' },
  { home: 'CPV', away: 'KSA', round: 3, utc: '2026-06-27T00:00:00Z', venue: 'NRG Stadium, Houston' },
  { home: 'URU', away: 'ESP', round: 3, utc: '2026-06-27T00:00:00Z', venue: 'Estadio Akron, Zapopan' },
  { home: 'EGY', away: 'IRN', round: 3, utc: '2026-06-27T03:00:00Z', venue: 'Lumen Field, Seattle' },
  { home: 'NZL', away: 'BEL', round: 3, utc: '2026-06-27T03:00:00Z', venue: 'BC Place, Vancouver' },
  { home: 'PAN', away: 'ENG', round: 3, utc: '2026-06-27T21:00:00Z', venue: 'MetLife Stadium, East Rutherford' },
  { home: 'CRO', away: 'GHA', round: 3, utc: '2026-06-27T21:00:00Z', venue: 'Lincoln Financial Field, Filadélfia' },
  { home: 'COL', away: 'POR', round: 3, utc: '2026-06-27T23:30:00Z', venue: 'Hard Rock Stadium, Miami Gardens' },
  { home: 'COD', away: 'UZB', round: 3, utc: '2026-06-27T23:30:00Z', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { home: 'ALG', away: 'AUT', round: 3, utc: '2026-06-28T02:00:00Z', venue: 'Arrowhead Stadium, Kansas City' },
  { home: 'JOR', away: 'ARG', round: 3, utc: '2026-06-28T02:00:00Z', venue: 'AT&T Stadium, Arlington' },
];

const ACHIEVEMENTS = [
  { code: 'PROPHET', name: 'Profeta', description: 'Acerte 5 placares exatos', icon: 'eye', tier: 2 },
  { code: 'ON_FIRE', name: 'Em Chamas', description: 'Acerte 5 palpites consecutivos', icon: 'flame', tier: 2 },
  { code: 'ZEBRA_MASTER', name: 'Zebra Master', description: 'Acerte uma vitória de azarão', icon: 'sparkles', tier: 1 },
  { code: 'KNOCKOUT_KING', name: 'Rei do Mata-Mata', description: 'Acerte 4 classificados no mata-mata', icon: 'crown', tier: 3 },
  { code: 'SHARPSHOOTER', name: 'Atirador de Elite', description: 'Acerte 3 placares exatos na mesma rodada', icon: 'target', tier: 3 },
  { code: 'FIRST_BLOOD', name: 'Primeiro Sangue', description: 'Faça seu primeiro palpite', icon: 'swords', tier: 1 },
];

async function main() {
  console.info('🌱 Seeding Bolão 2026 (tabela oficial)...');

  for (const a of ACHIEVEMENTS) {
    await prisma.achievement.upsert({ where: { code: a.code }, update: a, create: a });
  }

  // Times + classificação zerada
  const teamByCode = new Map<string, string>();
  for (const [groupName, teams] of Object.entries(GROUPS)) {
    for (const t of teams) {
      const team = await prisma.team.upsert({
        where: { code: t.code },
        update: { name: t.name, groupName, flagUrl: `https://flagcdn.com/w80/${t.iso}.png` },
        create: {
          name: t.name,
          code: t.code,
          groupName,
          flagUrl: `https://flagcdn.com/w80/${t.iso}.png`,
        },
      });
      teamByCode.set(t.code, team.id);
      await prisma.standing.upsert({
        where: { teamId_groupName: { teamId: team.id, groupName } },
        update: {},
        create: { teamId: team.id, groupName },
      });
    }
  }

  // Partidas da fase de grupos (72 jogos, horários e sedes oficiais)
  const codeToGroup = new Map<string, string>();
  for (const [groupName, teams] of Object.entries(GROUPS)) {
    for (const t of teams) codeToGroup.set(t.code, groupName);
  }
  const matchCount = await prisma.match.count();
  if (matchCount === 0) {
    for (const f of FIXTURES) {
      await prisma.match.create({
        data: {
          stage: MatchStage.GROUP,
          round: f.round,
          groupName: codeToGroup.get(f.home)!,
          kickoffAt: new Date(f.utc),
          venue: f.venue,
          homeTeamId: teamByCode.get(f.home)!,
          awayTeamId: teamByCode.get(f.away)!,
        },
      });
    }
  }
  console.info(`⚽ ${await prisma.match.count()} partidas (fase de grupos oficial)`);

  // Usuários demo
  const password = await bcrypt.hash('senha123', 12);
  const usersData = [
    { email: 'admin@bolao2026.app', username: 'admin', name: 'Admin', role: 'ADMIN' as const, bio: 'Comissário técnico do sistema' },
    { email: 'joao@example.com', username: 'joao10', name: 'João Silva', role: 'USER' as const, bio: 'Hexa vem! 🇧🇷' },
    { email: 'maria@example.com', username: 'maria_gol', name: 'Maria Souza', role: 'USER' as const, bio: 'Rainha dos placares exatos' },
    { email: 'pedro@example.com', username: 'pedrozebra', name: 'Pedro Lima', role: 'USER' as const, bio: 'Sempre aposto na zebra 🦓' },
  ];
  const users = [];
  for (const u of usersData) {
    users.push(
      await prisma.user.upsert({
        where: { email: u.email },
        update: { passwordHash: password }, // migra hashes antigos para bcrypt
        create: {
          ...u,
          passwordHash: password,
          avatarUrl: `https://api.dicebear.com/9.x/thumbs/png?seed=${u.username}`,
        },
      }),
    );
  }

  // Bolão demo
  const owner = users[1]!;
  const existingPool = await prisma.pool.findUnique({ where: { slug: 'bolao-da-firma' } });
  if (!existingPool) {
    const pool = await prisma.pool.create({
      data: {
        name: 'Bolão da Firma',
        description: 'O tradicional bolão do escritório. Perdedor paga o churrasco! 🍖',
        slug: 'bolao-da-firma',
        inviteCode: 'FIRMA26',
        ownerId: owner.id,
        members: {
          create: users.map((u, i) => ({
            userId: u.id,
            role: u.id === owner.id ? 'OWNER' : i === 0 ? 'ADMIN' : 'MEMBER',
          })),
        },
      },
    });
    await prisma.feedPost.create({
      data: {
        type: 'POOL_CREATED',
        poolId: pool.id,
        actorId: owner.id,
        content: `${owner.name} criou o bolão "Bolão da Firma" 🏆`,
      },
    });
  }

  console.info('✅ Seed concluído com a tabela oficial da Copa 2026.');
  console.info('   Login demo: joao@example.com / senha123');
  console.info('   Admin:      admin@bolao2026.app / senha123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
