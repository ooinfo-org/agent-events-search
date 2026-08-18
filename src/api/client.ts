const BASE = (process.env.OOINFO_BASE_URL ?? 'https://ooinfo.org.br').replace(/\/$/, '');
const USER_AGENT = 'base-eventos-agent/0.1';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

let tokens: Tokens | null = null;

interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  access_token?: string;
  refresh_token?: string;
  tokens?: { accessToken: string; refreshToken: string };
  data?: { accessToken?: string; refreshToken?: string; tokens?: { accessToken: string; refreshToken: string } };
}

function extractTokens(payload: LoginResponse): { accessToken: string; refreshToken: string } {
  const at = payload.accessToken ?? payload.access_token ?? payload.tokens?.accessToken ?? payload.data?.accessToken ?? payload.data?.tokens?.accessToken;
  const rt = payload.refreshToken ?? payload.refresh_token ?? payload.tokens?.refreshToken ?? payload.data?.refreshToken ?? payload.data?.tokens?.refreshToken;
  if (!at || !rt) {
    throw new Error(`Login sem tokens no payload: ${JSON.stringify(payload).slice(0, 300)}`);
  }
  return { accessToken: at, refreshToken: rt };
}

export async function login(): Promise<Tokens> {
  const email = process.env.USER_LOGIN;
  const password = process.env.PASS_LOGIN;
  if (!email || !password) {
    throw new Error('USER_LOGIN ou PASS_LOGIN ausente no .env');
  }

  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({ email, identifier: email, password }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Login falhou ${res.status}: ${text.slice(0, 300)}`);
  }

  const payload = JSON.parse(text) as LoginResponse;
  const { accessToken, refreshToken } = extractTokens(payload);
  tokens = { accessToken, refreshToken, expiresAt: Date.now() + 10 * 60 * 1000 };
  return tokens;
}

async function ensureToken(): Promise<string> {
  if (!tokens || Date.now() >= tokens.expiresAt) {
    await login();
  }
  return tokens!.accessToken;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | number | boolean | undefined>;
}

function buildRequestBody(body: unknown): { body: BodyInit | undefined; contentType: string | undefined } {
  if (body === undefined) return { body: undefined, contentType: undefined };
  if (body instanceof FormData) return { body, contentType: undefined };
  return { body: JSON.stringify(body), contentType: 'application/json' };
}

export async function apiRequest<T = unknown>(path: string, opts: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, query } = opts;

  let url = `${BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  const { body: reqBody, contentType } = buildRequestBody(body);

  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
  };
  if (contentType) headers['Content-Type'] = contentType;
  if (auth) headers['Authorization'] = `Bearer ${await ensureToken()}`;

  let res = await fetch(url, { method, headers, body: reqBody });

  if (res.status === 401 && auth) {
    tokens = null;
    headers['Authorization'] = `Bearer ${await ensureToken()}`;
    res = await fetch(url, { method, headers, body: reqBody });
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export const LIST_ID_EVENTOS = process.env.OOINFO_LIST_ID_EVENTOS ?? 'cms3ippif002gwfsw2lo4g4fz';
export const BASE_URL = BASE;
