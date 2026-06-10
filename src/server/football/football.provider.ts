/**
 * Provider de dados de futebol desacoplado.
 * Troque a implementação via FOOTBALL_PROVIDER (mock | api-football)
 * sem tocar no resto do sistema.
 *
 * api-football (api-sports.io): World Cup = league 1, season 2026.
 */

export interface ProviderMatch {
  externalId: string;
  homeTeamCode: string | null; // código FIFA do nosso banco (BRA, ARG...) ou null se não mapeado
  awayTeamCode: string | null;
  kickoffAt: Date;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED';
  homeScore: number | null;
  awayScore: number | null;
}

export interface FootballProvider {
  fetchMatches(): Promise<ProviderMatch[]>;
}

/** Nomes usados pela api-football → nossos códigos. Inclui aliases comuns. */
const NAME_TO_CODE: Record<string, string> = {
  mexico: 'MEX',
  'south africa': 'RSA',
  'south korea': 'KOR',
  'korea republic': 'KOR',
  'czech republic': 'CZE',
  czechia: 'CZE',
  canada: 'CAN',
  'bosnia and herzegovina': 'BIH',
  'bosnia & herzegovina': 'BIH',
  'bosnia-herzegovina': 'BIH',
  qatar: 'QAT',
  switzerland: 'SUI',
  brazil: 'BRA',
  morocco: 'MAR',
  haiti: 'HAI',
  scotland: 'SCO',
  usa: 'USA',
  'united states': 'USA',
  paraguay: 'PAR',
  australia: 'AUS',
  turkey: 'TUR',
  turkiye: 'TUR',
  germany: 'GER',
  curacao: 'CUW',
  'ivory coast': 'CIV',
  "cote d'ivoire": 'CIV',
  ecuador: 'ECU',
  netherlands: 'NED',
  japan: 'JPN',
  sweden: 'SWE',
  tunisia: 'TUN',
  belgium: 'BEL',
  egypt: 'EGY',
  iran: 'IRN',
  'new zealand': 'NZL',
  spain: 'ESP',
  'cape verde': 'CPV',
  'cape verde islands': 'CPV',
  'cabo verde': 'CPV',
  'saudi arabia': 'KSA',
  uruguay: 'URU',
  france: 'FRA',
  senegal: 'SEN',
  iraq: 'IRQ',
  norway: 'NOR',
  argentina: 'ARG',
  algeria: 'ALG',
  austria: 'AUT',
  jordan: 'JOR',
  portugal: 'POR',
  'dr congo': 'COD',
  'congo dr': 'COD',
  'democratic republic of congo': 'COD',
  uzbekistan: 'UZB',
  colombia: 'COL',
  england: 'ENG',
  croatia: 'CRO',
  ghana: 'GHA',
  panama: 'PAN',
};

function toCode(providerName: string): string | null {
  const normalized = providerName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
  return NAME_TO_CODE[normalized] ?? null;
}

const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT']);
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

class MockFootballProvider implements FootballProvider {
  async fetchMatches(): Promise<ProviderMatch[]> {
    // Em dev sem API key, os resultados são controlados pelo painel admin.
    return [];
  }
}

class ApiFootballProvider implements FootballProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
  ) {}

  async fetchMatches(): Promise<ProviderMatch[]> {
    const season = process.env.FOOTBALL_API_SEASON ?? '2026';
    const league = process.env.FOOTBALL_API_LEAGUE ?? '1'; // 1 = FIFA World Cup
    const res = await fetch(`${this.baseUrl}/fixtures?league=${league}&season=${season}`, {
      headers: { 'x-apisports-key': this.apiKey },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`api-football respondeu ${res.status}`);
    const data = (await res.json()) as {
      errors?: unknown;
      response: Array<{
        fixture: { id: number; date: string; status: { short: string } };
        teams: { home: { name: string }; away: { name: string } };
        goals: { home: number | null; away: number | null };
      }>;
    };
    if (!Array.isArray(data.response)) throw new Error('api-football: resposta inesperada');

    return data.response.map((f) => {
      const short = f.fixture.status.short;
      return {
        externalId: String(f.fixture.id),
        homeTeamCode: toCode(f.teams.home.name),
        awayTeamCode: toCode(f.teams.away.name),
        kickoffAt: new Date(f.fixture.date),
        status: FINISHED_STATUSES.has(short)
          ? 'FINISHED'
          : LIVE_STATUSES.has(short)
            ? 'LIVE'
            : short === 'PST'
              ? 'POSTPONED'
              : 'SCHEDULED',
        homeScore: f.goals.home,
        awayScore: f.goals.away,
      };
    });
  }
}

export function getFootballProvider(): FootballProvider {
  if (process.env.FOOTBALL_PROVIDER === 'api-football' && process.env.FOOTBALL_API_KEY) {
    return new ApiFootballProvider(
      process.env.FOOTBALL_API_KEY,
      process.env.FOOTBALL_API_BASE_URL ?? 'https://v3.football.api-sports.io',
    );
  }
  return new MockFootballProvider();
}
