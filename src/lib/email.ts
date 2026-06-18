import { Resend } from 'resend';

const FROM = process.env.EMAIL_FROM ?? 'Bolão 2026 <no-reply@bolao2026.app>';

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Redefinição de senha — Bolão 2026',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h1 style="font-size:22px;font-weight:700;margin-bottom:8px">Redefinir sua senha</h1>
        <p style="color:#555;margin-bottom:24px">
          Recebemos uma solicitação para redefinir a senha da sua conta no Bolão 2026.
          Clique no botão abaixo para criar uma nova senha. O link expira em 30 minutos.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#22c55e;color:#fff;font-weight:600;
                  text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px">
          Redefinir senha
        </a>
        <p style="color:#999;font-size:12px;margin-top:32px">
          Se você não solicitou a redefinição, ignore este e-mail — sua senha permanece a mesma.
        </p>
        <p style="color:#ccc;font-size:12px">
          Ou acesse diretamente: <a href="${resetUrl}" style="color:#22c55e">${resetUrl}</a>
        </p>
      </div>
    `,
  });
}
