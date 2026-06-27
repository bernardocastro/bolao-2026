'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { createPoolSchema, type CreatePoolInput } from '@/server/pools/pool.dto';
import { api, ClientApiError } from '@/lib/api-client';

const RULES: Array<{ key: keyof CreatePoolInput; label: string; hint: string }> = [
  { key: 'pointsExactScore', label: 'Placar exato', hint: 'Cravou o placar' },
  { key: 'pointsGoalDiff', label: 'Diferença de gols', hint: 'Acertou vencedor e saldo' },
  { key: 'pointsCorrectWinner', label: 'Vencedor correto', hint: 'Acertou só o resultado' },
  { key: 'bonusUniqueHit', label: 'Bônus único', hint: 'Único a acertar no bolão' },
];

export default function NewPoolPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreatePoolInput>({
    resolver: zodResolver(createPoolSchema),
    defaultValues: {
      isPrivate: true,
      maxMembers: 100,
      pointsExactScore: 10,
      pointsGoalDiff: 7,
      pointsCorrectWinner: 5,
      bonusUniqueHit: 2,
    },
  });

  async function onSubmit(data: CreatePoolInput) {
    try {
      const { pool } = await api<{ pool: { slug: string } }>('/api/pools', {
        method: 'POST',
        json: data,
      });
      toast.success('Bolão criado! Convide a galera 🎉');
      router.push(`/pools/${pool.slug}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : 'Erro ao criar bolão');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Criar bolão</h1>
        <p className="text-sm text-muted-foreground">Defina o nome e as regras de pontuação.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome do bolão</Label>
              <Input id="name" placeholder="Bolão da Firma" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Input id="description" placeholder="Perdedor paga o churrasco 🍖" {...register('description')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Regras de pontuação</CardTitle>
            <CardDescription>Você pode ajustar depois nas configurações do bolão.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {RULES.map((rule) => (
              <div key={rule.key} className="space-y-1.5">
                <Label htmlFor={rule.key}>{rule.label}</Label>
                <Input
                  id={rule.key}
                  type="number"
                  min={0}
                  max={100}
                  {...register(rule.key, { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">{rule.hint}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Criar bolão 🏆
        </Button>
      </form>
    </div>
  );
}
