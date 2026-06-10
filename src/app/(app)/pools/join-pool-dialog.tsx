'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { api, ClientApiError } from '@/lib/api-client';

export function JoinPoolDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function join() {
    setLoading(true);
    try {
      const { pool } = await api<{ pool: { slug: string } }>('/api/pools/join', {
        method: 'POST',
        json: { inviteCode: code.trim() },
      });
      toast.success('Bem-vindo ao bolão! 🎉');
      setOpen(false);
      router.push(`/pools/${pool.slug}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : 'Código inválido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Ticket className="h-4 w-4" /> Entrar com código
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrar em um bolão</DialogTitle>
          <DialogDescription>Cole o código de convite que você recebeu.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) void join();
          }}
          className="flex gap-2"
        >
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="EX: FIRMA26"
            className="font-mono uppercase tracking-widest"
            maxLength={20}
            autoFocus
          />
          <Button type="submit" loading={loading} disabled={!code.trim()}>
            Entrar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
