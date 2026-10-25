import { DurableObject } from 'cloudflare:workers';

const SHARDS = 8;
const ONLINE_WINDOW_MS = 75_000;
const SESSION_ID_PATTERN = /^[a-f0-9-]{32,36}$/i;

interface DurableStub {
  fetch(request: Request): Promise<Response>;
}

interface DurableNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): DurableStub;
}

interface Env {
  PRESENCE: DurableNamespace;
  ALLOWED_ORIGINS: string;
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extra,
    },
  });
}

function corsHeaders(origin: string): Record<string, string> {
  if (!origin) return { Vary: 'Origin', 'Cache-Control': 'no-store' };
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  };
}

function isAllowedOrigin(origin: string, env: Env): boolean {
  if (!origin) return true;
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .some(value => value === '*' || value === origin);
}

function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

async function requestShard(env: Env, shardNumber: number, path: string, init?: RequestInit): Promise<Response> {
  const id = env.PRESENCE.idFromName(`presence-${shardNumber}`);
  const stub = env.PRESENCE.get(id);
  return stub.fetch(new Request(`https://presence.internal${path}`, init));
}

export class PresenceShard extends DurableObject<Env> {
  constructor(ctx: ConstructorParameters<typeof DurableObject<Env>>[0], env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS active_visitors (
        visitor_id TEXT PRIMARY KEY,
        last_seen INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS active_visitors_last_seen ON active_visitors(last_seen);
    `);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/heartbeat' && request.method === 'POST') {
      let visitorId = '';
      try {
        const body = await request.json() as { visitorId?: unknown };
        visitorId = typeof body.visitorId === 'string' ? body.visitorId : '';
      } catch {
        return json({ error: 'JSON inválido' }, 400);
      }

      if (!SESSION_ID_PATTERN.test(visitorId)) return json({ error: 'ID de sessão inválido' }, 400);
      const now = Date.now();
      this.ctx.storage.sql.exec(
        'INSERT INTO active_visitors (visitor_id, last_seen) VALUES (?, ?) ON CONFLICT(visitor_id) DO UPDATE SET last_seen = excluded.last_seen',
        visitorId,
        now,
      );
      this.prune(now);
      return json({ ok: true });
    }

    if (url.pathname === '/count' && request.method === 'GET') {
      const now = Date.now();
      this.prune(now);
      const row = this.ctx.storage.sql.exec<{ online: number }>(
        'SELECT COUNT(*) AS online FROM active_visitors WHERE last_seen >= ?',
        now - ONLINE_WINDOW_MS,
      ).toArray()[0];
      return json({ online: Number(row?.online || 0), windowSeconds: ONLINE_WINDOW_MS / 1000 });
    }

    return json({ error: 'Not found' }, 404);
  }

  private prune(now: number): void {
    this.ctx.storage.sql.exec('DELETE FROM active_visitors WHERE last_seen < ?', now - ONLINE_WINDOW_MS);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    if (!isAllowedOrigin(origin, env)) return json({ error: 'Origin não autorizado' }, 403);

    const headers = corsHeaders(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    const url = new URL(request.url);
    if (url.pathname === '/api/presence/heartbeat') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers);

      let visitorId = '';
      try {
        const body = await request.json() as { visitorId?: unknown };
        visitorId = typeof body.visitorId === 'string' ? body.visitorId : '';
      } catch {
        return json({ error: 'JSON inválido' }, 400, headers);
      }
      if (!SESSION_ID_PATTERN.test(visitorId)) return json({ error: 'ID de sessão inválido' }, 400, headers);

      const shardNumber = hash(visitorId) % SHARDS;
      const response = await requestShard(env, shardNumber, '/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId }),
      });
      return json({ ok: response.ok }, response.status, headers);
    }

    if (url.pathname === '/api/presence' && request.method === 'GET') {
      const counts = await Promise.all(Array.from({ length: SHARDS }, async (_, shard) => {
        const response = await requestShard(env, shard, '/count');
        if (!response.ok) throw new Error(`Presence shard ${shard} returned ${response.status}`);
        const result = await response.json() as { online?: number };
        return Number(result.online || 0);
      }));
      return json({ online: counts.reduce((sum, count) => sum + count, 0), windowSeconds: ONLINE_WINDOW_MS / 1000 }, 200, headers);
    }

    return json({ error: 'Not found' }, 404, headers);
  },
};