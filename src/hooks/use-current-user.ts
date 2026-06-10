'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { PublicUser } from '@/server/auth/auth.dto';

export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ user: PublicUser | null }>('/api/auth/me'),
    select: (data) => data.user,
    staleTime: 5 * 60_000,
  });
}
