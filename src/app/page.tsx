import Link from 'next/link';
import { ArrowRight, Trophy, Zap, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StadiumBits } from '@/components/features/stadium-bits';
import { ScoreboardTicker } from '@/components/features/scoreboard-ticker';

const FEATURES = [
  {
    icon: Trophy,
    title: 'Ligas privadas',
    description: 'Crie seu bolão, defina as regras de pontuação e convide a galera com um código.',
  },
  {
    icon: Zap,
    title: 'Ranking ao vivo',
    description: 'Pontuação instantânea a cada gol. Veja sua posição mudar em tempo real.',
  },
  {
    icon: Users,
    title: 'Resenha garantida',
    description: 'Feed social com curtidas, comentários e conquistas para registrar cada mancada.',
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container flex h-16 items-center justify-between">
        <span className="font-display text-lg font-bold">
          Bolão<span className="text-primary">2026</span>
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Criar conta</Link>
          </Button>
        </div>
      </header>

      {/* letreiro estilo placar com os jogos reais */}
      <ScoreboardTicker />

      <main className="flex-1">
        <section className="relative overflow-hidden">
          {/* matriz de LEDs animada ao fundo */}
          <StadiumBits className="opacity-60 [mask-image:radial-gradient(ellipse_70%_80%_at_50%_40%,black,transparent)]" />

          <div className="container relative z-10 flex flex-col items-center gap-6 py-20 text-center lg:py-32">
            <span className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary backdrop-blur-sm">
              ⚽ Copa do Mundo 2026 · EUA, México e Canadá
            </span>
            <h1 className="font-display max-w-3xl text-balance text-4xl font-extrabold tracking-tight lg:text-6xl">
              O bolão definitivo da <span className="text-primary">Copa 2026</span>
            </h1>
            <p className="max-w-xl text-balance text-lg text-muted-foreground">
              Palpites, rankings em tempo real, conquistas e muita zoeira. Reúna seus amigos e
              descubra quem realmente entende de futebol.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/register">
                  Começar agora <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Já tenho conta</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="container grid gap-4 pb-24 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass rounded-lg p-6">
              <f.icon className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-1 font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        Bolão 2026 — feito com 💚 para a maior Copa de todos os tempos
      </footer>
    </div>
  );
}
