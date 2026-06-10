import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl">🟥</p>
      <h1 className="font-display text-3xl font-bold">Cartão vermelho!</h1>
      <p className="text-muted-foreground">Essa página foi expulsa de campo (404).</p>
      <Button asChild>
        <Link href="/dashboard">Voltar ao jogo</Link>
      </Button>
    </div>
  );
}
