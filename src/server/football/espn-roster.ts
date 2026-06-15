import { cached } from '@/lib/redis';
import type { TopScorerPlayer } from '@/lib/top-scorer-players';

// All 48 World Cup 2026 teams with ESPN internal IDs
const WC_TEAMS: { id: string; code: string; name: string }[] = [
  { id: '624',   code: 'ALG', name: 'Argélia' },
  { id: '202',   code: 'ARG', name: 'Argentina' },
  { id: '628',   code: 'AUS', name: 'Austrália' },
  { id: '474',   code: 'AUT', name: 'Áustria' },
  { id: '459',   code: 'BEL', name: 'Bélgica' },
  { id: '452',   code: 'BIH', name: 'Bósnia-Herzegovina' },
  { id: '205',   code: 'BRA', name: 'Brasil' },
  { id: '206',   code: 'CAN', name: 'Canadá' },
  { id: '2597',  code: 'CPV', name: 'Cabo Verde' },
  { id: '208',   code: 'COL', name: 'Colômbia' },
  { id: '2850',  code: 'COD', name: 'Congo RD' },
  { id: '477',   code: 'CRO', name: 'Croácia' },
  { id: '11678', code: 'CUW', name: 'Curaçao' },
  { id: '450',   code: 'CZE', name: 'Tchéquia' },
  { id: '209',   code: 'ECU', name: 'Equador' },
  { id: '2620',  code: 'EGY', name: 'Egito' },
  { id: '448',   code: 'ENG', name: 'Inglaterra' },
  { id: '478',   code: 'FRA', name: 'França' },
  { id: '481',   code: 'GER', name: 'Alemanha' },
  { id: '4469',  code: 'GHA', name: 'Gana' },
  { id: '2654',  code: 'HAI', name: 'Haiti' },
  { id: '469',   code: 'IRN', name: 'Irã' },
  { id: '4375',  code: 'IRQ', name: 'Iraque' },
  { id: '4789',  code: 'CIV', name: 'Costa do Marfim' },
  { id: '627',   code: 'JPN', name: 'Japão' },
  { id: '2917',  code: 'JOR', name: 'Jordânia' },
  { id: '203',   code: 'MEX', name: 'México' },
  { id: '2869',  code: 'MAR', name: 'Marrocos' },
  { id: '449',   code: 'NED', name: 'Holanda' },
  { id: '2666',  code: 'NZL', name: 'Nova Zelândia' },
  { id: '464',   code: 'NOR', name: 'Noruega' },
  { id: '2659',  code: 'PAN', name: 'Panamá' },
  { id: '210',   code: 'PAR', name: 'Paraguai' },
  { id: '482',   code: 'POR', name: 'Portugal' },
  { id: '4398',  code: 'QAT', name: 'Catar' },
  { id: '655',   code: 'KSA', name: 'Arábia Saudita' },
  { id: '580',   code: 'SCO', name: 'Escócia' },
  { id: '654',   code: 'SEN', name: 'Senegal' },
  { id: '467',   code: 'RSA', name: 'África do Sul' },
  { id: '451',   code: 'KOR', name: 'Coreia do Sul' },
  { id: '164',   code: 'ESP', name: 'Espanha' },
  { id: '466',   code: 'SWE', name: 'Suécia' },
  { id: '475',   code: 'SUI', name: 'Suíça' },
  { id: '659',   code: 'TUN', name: 'Tunísia' },
  { id: '465',   code: 'TUR', name: 'Turquia' },
  { id: '660',   code: 'USA', name: 'EUA' },
  { id: '212',   code: 'URU', name: 'Uruguai' },
  { id: '2570',  code: 'UZB', name: 'Uzbequistão' },
];

async function fetchTeamRoster(team: (typeof WC_TEAMS)[0]): Promise<TopScorerPlayer[]> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams/${team.id}/roster`,
      { cache: 'no-store' },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { athletes?: Array<{ displayName: string }> };
    return (data.athletes ?? []).map((a) => ({
      name: a.displayName,
      country: team.name,
      countryCode: team.code,
    }));
  } catch {
    return [];
  }
}

export async function fetchAllRosterPlayers(): Promise<TopScorerPlayer[]> {
  return cached('top-scorer:players', 6 * 3600, async () => {
    // Fetch all 48 rosters in parallel
    const nested = await Promise.all(WC_TEAMS.map(fetchTeamRoster));
    const players = nested.flat();
    return players.sort(
      (a, b) => a.country.localeCompare(b.country, 'pt-BR') || a.name.localeCompare(b.name, 'pt-BR'),
    );
  });
}
