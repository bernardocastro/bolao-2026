interface ApiClientError {
  error: string;
  issues?: Record<string, string[]>;
}

export class ClientApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public issues?: Record<string, string[]>,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Fetch wrapper com refresh automático de sessão em 401. */
export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const doFetch = () =>
    fetch(path, {
      ...init,
      headers: {
        ...(init?.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    });

  let res = await doFetch();
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    const ok = await tryRefresh();
    if (ok) res = await doFetch();
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({ error: 'Erro inesperado' }))) as ApiClientError;
    throw new ClientApiError(res.status, data.error, data.issues);
  }
  return res.json() as Promise<T>;
}
