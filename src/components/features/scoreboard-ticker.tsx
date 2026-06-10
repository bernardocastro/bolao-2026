'use client';

const FIXTURES = [
  'MEX × RSA · 11 JUN · ESTADIO AZTECA',
  'KOR × CZE · 11 JUN · ESTADIO AKRON',
  'CAN × BIH · 12 JUN · BMO FIELD',
  'USA × PAR · 12 JUN · SOFI STADIUM',
  'BRA × MAR · 13 JUN · METLIFE STADIUM',
  'HAI × SCO · 13 JUN · GILLETTE STADIUM',
  'NED × JPN · 14 JUN · AT&T STADIUM',
  'ESP × CPV · 15 JUN · MERCEDES-BENZ',
  'FRA × SEN · 16 JUN · METLIFE STADIUM',
  'ARG × ALG · 16 JUN · ARROWHEAD',
  'POR × COD · 17 JUN · NRG STADIUM',
  'ENG × CRO · 17 JUN · AT&T STADIUM',
];

/** Letreiro estilo placar de estádio com os jogos reais da 1ª rodada. */
export function ScoreboardTicker() {
  const line = FIXTURES.join('  ···  ');
  return (
    <div className="led-panel relative overflow-hidden py-2.5" role="marquee" aria-label="Próximos jogos">
      <div className="animate-marquee whitespace-nowrap motion-reduce:animate-none">
        <span className="led-text">{line}  ···  </span>
        <span className="led-text" aria-hidden>
          {line}  ···  
        </span>
      </div>
      {/* scanlines do painel */}
      <div className="led-scanlines pointer-events-none absolute inset-0" aria-hidden />
    </div>
  );
}
