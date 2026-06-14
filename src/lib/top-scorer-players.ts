export interface TopScorerPlayer {
  name: string;
  country: string;
  countryCode: string;
}

export const TOP_SCORER_PLAYERS: TopScorerPlayer[] = [
  // Argentina
  { name: 'Lionel Messi', country: 'Argentina', countryCode: 'ARG' },
  { name: 'Lautaro Martínez', country: 'Argentina', countryCode: 'ARG' },
  { name: 'Julián Álvarez', country: 'Argentina', countryCode: 'ARG' },
  // Brasil
  { name: 'Vinicius Jr.', country: 'Brasil', countryCode: 'BRA' },
  { name: 'Rodrygo', country: 'Brasil', countryCode: 'BRA' },
  { name: 'Raphinha', country: 'Brasil', countryCode: 'BRA' },
  { name: 'Endrick', country: 'Brasil', countryCode: 'BRA' },
  { name: 'Gabriel Martinelli', country: 'Brasil', countryCode: 'BRA' },
  // Inglaterra
  { name: 'Harry Kane', country: 'Inglaterra', countryCode: 'ENG' },
  { name: 'Bukayo Saka', country: 'Inglaterra', countryCode: 'ENG' },
  { name: 'Phil Foden', country: 'Inglaterra', countryCode: 'ENG' },
  { name: 'Jude Bellingham', country: 'Inglaterra', countryCode: 'ENG' },
  // França
  { name: 'Kylian Mbappé', country: 'França', countryCode: 'FRA' },
  { name: 'Antoine Griezmann', country: 'França', countryCode: 'FRA' },
  { name: 'Marcus Thuram', country: 'França', countryCode: 'FRA' },
  // Portugal
  { name: 'Cristiano Ronaldo', country: 'Portugal', countryCode: 'POR' },
  { name: 'Rafael Leão', country: 'Portugal', countryCode: 'POR' },
  { name: 'Gonçalo Ramos', country: 'Portugal', countryCode: 'POR' },
  // Espanha
  { name: 'Álvaro Morata', country: 'Espanha', countryCode: 'ESP' },
  { name: 'Nico Williams', country: 'Espanha', countryCode: 'ESP' },
  { name: 'Dani Olmo', country: 'Espanha', countryCode: 'ESP' },
  // Alemanha
  { name: 'Kai Havertz', country: 'Alemanha', countryCode: 'GER' },
  { name: 'Florian Wirtz', country: 'Alemanha', countryCode: 'GER' },
  { name: 'Jamal Musiala', country: 'Alemanha', countryCode: 'GER' },
  // Holanda
  { name: 'Cody Gakpo', country: 'Holanda', countryCode: 'NED' },
  { name: 'Memphis Depay', country: 'Holanda', countryCode: 'NED' },
  // Noruega
  { name: 'Erling Haaland', country: 'Noruega', countryCode: 'NOR' },
  // Bélgica
  { name: 'Romelu Lukaku', country: 'Bélgica', countryCode: 'BEL' },
  // Uruguai
  { name: 'Darwin Núñez', country: 'Uruguai', countryCode: 'URU' },
  // Colômbia
  { name: 'Luis Díaz', country: 'Colômbia', countryCode: 'COL' },
  { name: 'Jhon Durán', country: 'Colômbia', countryCode: 'COL' },
  // EUA
  { name: 'Christian Pulisic', country: 'EUA', countryCode: 'USA' },
  // México
  { name: 'Hirving Lozano', country: 'México', countryCode: 'MEX' },
  { name: 'Raúl Jiménez', country: 'México', countryCode: 'MEX' },
  // Japão
  { name: 'Kaoru Mitoma', country: 'Japão', countryCode: 'JPN' },
  { name: 'Takefusa Kubo', country: 'Japão', countryCode: 'JPN' },
  // Coreia do Sul
  { name: 'Son Heung-min', country: 'Coreia do Sul', countryCode: 'KOR' },
  // Marrocos
  { name: 'Youssef En-Nesyri', country: 'Marrocos', countryCode: 'MAR' },
  // Equador
  { name: 'Enner Valencia', country: 'Equador', countryCode: 'ECU' },
  // Senegal
  { name: 'Sadio Mané', country: 'Senegal', countryCode: 'SEN' },
].sort((a, b) => a.country.localeCompare(b.country, 'pt-BR') || a.name.localeCompare(b.name, 'pt-BR'));

// June 17 23:59 BRT = June 18 02:59 UTC
export const TOP_SCORER_DEADLINE = new Date('2026-06-18T03:00:00Z');

export function isTopScorerOpen(): boolean {
  return new Date() < TOP_SCORER_DEADLINE;
}
