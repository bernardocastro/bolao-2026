'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api-client';

const schema = z.object({ email: z.string().email('E-mail inválido') });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    try {
      await api('/api/auth/forgot-password', { method: 'POST', json: data });
      setSent(true);
    } catch {
      toast.error('Erro ao enviar. Tente novamente.');
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <p className="mb-2 text-4xl">📬</p>
        <h1 className="font-display mb-2 text-xl font-bold">Verifique seu e-mail</h1>
        <p className="text-sm text-muted-foreground">
          Se o endereço existir, enviamos as instruções de recuperação.
        </p>
        <Button variant="link" asChild className="mt-4">
          <Link href="/login">Voltar ao login</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-display mb-1 text-2xl font-bold">Recuperar senha</h1>
      <p className="mb-6 text-sm text-muted-foreground">Enviaremos um link para redefinir sua senha.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" placeholder="voce@exemplo.com" {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Enviar link
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          Voltar ao login
        </Link>
      </p>
    </>
  );
}
