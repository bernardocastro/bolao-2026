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
  // moneyline americano (ex.: -120, +380); null quando não disponível ou após encerrar
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
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
        oddsHome: null,
        oddsDraw: null,
        oddsAway: null,
      };
    });
  }
}

// ESPN public API — no key required, returns FIFA 3-letter codes directly
class EspnFootballProvider implements FootballProvider {
  async fetchMatches(): Promise<ProviderMatch[]> {
    const from = process.env.ESPN_DATES_FROM ?? '20260611';
    const to = process.env.ESPN_DATES_TO ?? '20260720';
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${from}-${to}&limit=200`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`ESPN API respondeu ${res.status}`);

    const data = (await res.json()) as {
      events: Array<{
        id: string;
        date: string;
        competitions: Array<{
          status: {
            type: {
              name: string;
              state: string; // "pre" | "in" | "post"
              completed: boolean;
            };
          };
          competitors: Array<{
            homeAway: 'home' | 'away';
            score: string;
            team: { abbreviation: string };
          }>;
          odds?: Array<{
            moneyline?: {
              home?: { close?: { odds?: string } };
              draw?: { close?: { odds?: string } };
              away?: { close?: { odds?: string } };
            };
          } | null>;
        }>;
      }>;
    };

    return data.events.map((event) => {
      const comp = event.competitions[0]!;
      const statusType = comp.status.type;
      const home = comp.competitors.find((c) => c.homeAway === 'home');
      const away = comp.competitors.find((c) => c.homeAway === 'away');

      let status: ProviderMatch['status'];
      if (statusType.name === 'STATUS_POSTPONED') {
        status = 'POSTPONED';
      } else if (statusType.state === 'post' && statusType.completed) {
        status = 'FINISHED';
      } else if (statusType.state === 'in') {
        status = 'LIVE';
      } else {
        status = 'SCHEDULED';
      }

      const isPre = statusType.state === 'pre';
      const homeScore = home && !isPre ? (parseInt(home.score, 10) ?? null) : null;
      const awayScore = away && !isPre ? (parseInt(away.score, 10) ?? null) : null;

      const oddsEntry = comp.odds?.[0];
      const parseOdds = (raw: string | undefined): number | null => {
        if (!raw) return null;
        const n = parseInt(raw, 10);
        return isNaN(n) ? null : n;
      };
      const oddsHome = isPre ? parseOdds(oddsEntry?.moneyline?.home?.close?.odds) : null;
      const oddsDraw = isPre ? parseOdds(oddsEntry?.moneyline?.draw?.close?.odds) : null;
      const oddsAway = isPre ? parseOdds(oddsEntry?.moneyline?.away?.close?.odds) : null;

      return {
        externalId: `espn_${event.id}`,
        homeTeamCode: home?.team.abbreviation ?? null,
        awayTeamCode: away?.team.abbreviation ?? null,
        kickoffAt: new Date(event.date),
        status,
        homeScore: isNaN(homeScore as number) ? null : homeScore,
        awayScore: isNaN(awayScore as number) ? null : awayScore,
        oddsHome,
        oddsDraw,
        oddsAway,
      };
    });
  }
}

export function getFootballProvider(): FootballProvider {
  if (process.env.FOOTBALL_PROVIDER === 'espn') {
    return new EspnFootballProvider();
  }
  if (process.env.FOOTBALL_PROVIDER === 'api-football' && process.env.FOOTBALL_API_KEY) {
    return new ApiFootballProvider(
      process.env.FOOTBALL_API_KEY,
      process.env.FOOTBALL_API_BASE_URL ?? 'https://v3.football.api-sports.io',
    );
  }
  return new MockFootballProvider();
}
