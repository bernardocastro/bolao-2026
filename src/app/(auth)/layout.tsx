import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8 font-display text-2xl font-bold">
        Bolão<span className="text-primary">2026</span>
      </Link>
      <div className="glass w-full max-w-md rounded-xl p-6 sm:p-8">{children}</div>
    </div>
  );
}
