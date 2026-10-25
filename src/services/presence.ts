// =====================================================================
// Contador de pessoas online — soma entre todos os dispositivos.
//
// Fontes, em ordem de prioridade:
//  1. endpoint próprio (Worker em workers/presence), se configurado na meta
//     "site-presence-endpoint";
//  2. canal de presença em tempo real num broker MQTT público, via WebSocket,
//     sem servidor nem cadastro: cada aba publica uma mensagem *retida* num
//     tópico exclusivo e registra um "testamento" (LWT) que a apaga quando a
//     conexão cai. Quem entra recebe todas as mensagens retidas na hora, logo
//     vê o total atual. Só circulam IDs aleatórios — nenhum IP ou dado pessoal;
//  3. contagem local (abas deste navegador), quando nada acima responde.
//
// Várias abas do mesmo navegador compartilham um visitorId e contam como 1.
// =====================================================================

export type PresenceSource = 'endpoint' | 'broker' | 'local';
export type PresenceStatus = 'connecting' | 'live' | 'degraded';

export interface PresenceSnapshot {
  online: number;
  source: PresenceSource;
  status: PresenceStatus;
  broker: string | null;
}

export interface BrokerConfig { url: string; username?: string; password?: string }

// Ordem = prioridade. O primeiro usa a porta 443 (passa em quase toda rede) e
// responde rápido; os demais são reservas caso ele fique fora do ar.
export const PUBLIC_BROKERS: BrokerConfig[] = [
  { url: 'wss://public.cloud.shiftr.io', username: 'public', password: 'public' },
  { url: 'wss://broker.emqx.io:8084/mqtt' },
  { url: 'wss://broker.hivemq.com:8884/mqtt' },
];

const DEFAULT_ROOM = 'votoglobal/2t2026/presenca/v1';
const VISITOR_ID_KEY = 'voto-global:presence-id:v1';
const TAB_ID_KEY = 'voto-global:tab-id';
const TAB_PREFIX = 'voto-global:tab:v1:';
const LOCAL_HEARTBEAT_MS = 5000;
const LOCAL_WINDOW_MS = 15000;
const ENDPOINT_POLL_MS = 15000;

const enc = new TextEncoder();
const dec = new TextDecoder();

// ------------------------------------------------------------------ ids
export function randomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

let memoryVisitorId = '';
let memoryTabId = '';

export function getVisitorId(): string {
  try {
    const saved = localStorage.getItem(VISITOR_ID_KEY);
    if (saved) return saved;
    const id = randomId();
    localStorage.setItem(VISITOR_ID_KEY, id);
    return id;
  } catch {
    if (!memoryVisitorId) memoryVisitorId = randomId();
    return memoryVisitorId;
  }
}

export function getTabId(): string {
  if (memoryTabId) return memoryTabId;
  try {
    const saved = sessionStorage.getItem(TAB_ID_KEY);
    if (saved) { memoryTabId = saved; return saved; }
    memoryTabId = randomId().replace(/-/g, '').slice(0, 20);
    sessionStorage.setItem(TAB_ID_KEY, memoryTabId);
  } catch {
    memoryTabId = randomId().replace(/-/g, '').slice(0, 20);
  }
  return memoryTabId;
}

// ------------------------------------------------------------------ contagem local (fallback)
export function heartbeatLocal(tabId: string): number {
  const now = Date.now();
  try {
    localStorage.setItem(`${TAB_PREFIX}${tabId}`, String(now));
    let count = 0;
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(TAB_PREFIX)) continue;
      const seen = Number(localStorage.getItem(key));
      if (!Number.isFinite(seen) || now - seen > LOCAL_WINDOW_MS) { localStorage.removeItem(key); continue; }
      count += 1;
    }
    return Math.max(count, 1);
  } catch {
    return 1;
  }
}

export function clearLocalTab(tabId: string): void {
  try { localStorage.removeItem(`${TAB_PREFIX}${tabId}`); } catch { /* sem storage */ }
}

// ------------------------------------------------------------------ MQTT 3.1.1 mínimo (QoS 0)
function mqttString(value: string): number[] {
  const bytes = enc.encode(value);
  if (bytes.length > 65535) throw new Error('string MQTT longa demais');
  return [bytes.length >> 8, bytes.length & 0xff, ...bytes];
}

function remainingLength(length: number): number[] {
  const out: number[] = [];
  let n = length;
  do {
    let digit = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) digit |= 0x80;
    out.push(digit);
  } while (n > 0);
  return out;
}

function packet(type: number, flags: number, body: number[]): Uint8Array {
  return Uint8Array.from([(type << 4) | flags, ...remainingLength(body.length), ...body]);
}

function connectPacket(clientId: string, keepaliveSeconds: number, willTopic: string, auth?: { username?: string; password?: string }): Uint8Array {
  // flags: clean session (0x02) + will flag (0x04) + will retain (0x20); will QoS 0.
  // O "testamento" é uma mensagem vazia e retida => apaga a presença da aba quando a conexão cair.
  let flags = 0x26;
  const tail: number[] = [];
  if (auth?.username) {
    flags |= 0x80;
    tail.push(...mqttString(auth.username));
    if (auth.password !== undefined) { flags |= 0x40; tail.push(...mqttString(auth.password)); }
  }
  const body = [
    ...mqttString('MQTT'), 0x04, flags,
    keepaliveSeconds >> 8, keepaliveSeconds & 0xff,
    ...mqttString(clientId),
    ...mqttString(willTopic), 0x00, 0x00,
    ...tail,
  ];
  return packet(1, 0, body);
}

function publishPacket(topic: string, payload: string, retain: boolean): Uint8Array {
  return packet(3, retain ? 0x01 : 0x00, [...mqttString(topic), ...enc.encode(payload)]);
}

function subscribePacket(packetId: number, filter: string): Uint8Array {
  return packet(8, 0x02, [packetId >> 8, packetId & 0xff, ...mqttString(filter), 0x00]);
}

const PINGREQ = Uint8Array.from([0xc0, 0x00]);

interface MqttPacket { type: number; flags: number; body: Uint8Array }

function parsePackets(buffer: Uint8Array): { packets: MqttPacket[]; rest: Uint8Array } {
  const packets: MqttPacket[] = [];
  let i = 0;
  while (i < buffer.length) {
    const type = buffer[i] >> 4;
    const flags = buffer[i] & 0x0f;
    let multiplier = 1;
    let length = 0;
    let j = i + 1;
    let byte: number;
    do {
      if (j >= buffer.length) return { packets, rest: buffer.subarray(i) };
      byte = buffer[j++];
      length += (byte & 0x7f) * multiplier;
      multiplier *= 128;
      if (multiplier > 128 ** 4) throw new Error('pacote MQTT inválido');
    } while (byte & 0x80);
    if (j + length > buffer.length) return { packets, rest: buffer.subarray(i) };
    packets.push({ type, flags, body: buffer.subarray(j, j + length) });
    i = j + length;
  }
  return { packets, rest: new Uint8Array(0) };
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// ------------------------------------------------------------------ canal de presença
export interface ChannelState {
  online: number;
  live: boolean;
  broker: string | null;
  failures: number;
}

export interface ChannelOptions {
  room: string;
  visitorId: string;
  tabId: string;
  brokers?: BrokerConfig[];
  keepaliveSeconds?: number;
  onUpdate: (state: ChannelState) => void;
  WebSocketImpl?: typeof WebSocket;
}

type Timer = ReturnType<typeof setTimeout>;

export class PresenceChannel {
  private ws: WebSocket | null = null;
  private readonly tabs = new Map<string, Set<string>>();
  private buffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  private attempt = 0;
  private failures = 0;
  private live = false;
  private stopped = false;
  private activeBroker: string | null = null;
  private lastRx = 0;
  private pingTimer: Timer | null = null;
  private reconnectTimer: Timer | null = null;
  private openTimer: Timer | null = null;
  private readonly brokers: BrokerConfig[];
  private readonly keepalive: number;
  private readonly clientId: string;

  constructor(private readonly opts: ChannelOptions) {
    this.brokers = opts.brokers && opts.brokers.length ? opts.brokers : PUBLIC_BROKERS;
    this.keepalive = opts.keepaliveSeconds ?? 60;
    this.clientId = `vg-${opts.tabId}`.slice(0, 23);
  }

  get topic(): string { return `${this.opts.room}/p/${this.opts.visitorId}/${this.opts.tabId}`; }
  get filter(): string { return `${this.opts.room}/p/+/+`; }
  get state(): ChannelState {
    return { online: this.countVisitors(), live: this.live, broker: this.live ? this.activeBroker : null, failures: this.failures };
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    const ws = this.ws;
    this.ws = null;
    if (ws && ws.readyState === 1) {
      // apaga a própria mensagem retida; o LWT cobre o caso de a mensagem não chegar
      try { ws.send(publishPacket(this.topic, '', true)); } catch { /* conexão já fechada */ }
      try { ws.close(); } catch { /* ignora */ }
    } else if (ws) {
      try { ws.close(); } catch { /* ignora */ }
    }
    this.live = false;
    this.tabs.clear();
  }

  /** Confirma presença ao voltar para a aba (pode ter ficado suspensa). */
  nudge(): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1) return;
    if (Date.now() - this.lastRx > this.keepalive * 1500) { ws.close(); return; }
    try { ws.send(PINGREQ); } catch { /* ignora */ }
  }

  private countVisitors(): number {
    const visitors = new Set(this.tabs.keys());
    if (this.live) visitors.add(this.opts.visitorId);
    return Math.max(visitors.size, this.live ? 1 : 0);
  }

  private emit(): void {
    this.opts.onUpdate(this.state);
  }

  private clearTimers(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.openTimer) clearTimeout(this.openTimer);
    this.pingTimer = null;
    this.reconnectTimer = null;
    this.openTimer = null;
  }

  private connect(): void {
    if (this.stopped) return;
    const WS = this.opts.WebSocketImpl ?? (typeof WebSocket !== 'undefined' ? WebSocket : null);
    if (!WS) { this.failures = 99; this.emit(); return; }

    // 1ª tentativa no broker principal; depois alterna a cada falha (todos começam pelo mesmo).
    const broker = this.brokers[this.attempt % this.brokers.length];
    const url = broker.url;
    this.activeBroker = url;
    this.buffer = new Uint8Array(0);
    let ws: WebSocket;
    try {
      ws = new WS(url, ['mqtt']);
    } catch {
      this.handleClose();
      return;
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    this.openTimer = setTimeout(() => {
      if (!this.live) { try { ws.close(); } catch { /* ignora */ } }
    }, 20000);

    ws.onopen = () => {
      this.lastRx = Date.now();
      try { ws.send(connectPacket(this.clientId, this.keepalive, this.topic, broker)); } catch { ws.close(); }
    };
    ws.onmessage = (event: MessageEvent) => {
      const data = event.data;
      if (data instanceof ArrayBuffer) this.onData(ws, new Uint8Array(data));
    };
    ws.onerror = () => { /* onclose vem em seguida */ };
    ws.onclose = () => { if (this.ws === ws) this.handleClose(); };
  }

  private onData(ws: WebSocket, chunk: Uint8Array): void {
    this.lastRx = Date.now();
    this.buffer = concat(this.buffer, chunk);
    let parsed: { packets: MqttPacket[]; rest: Uint8Array };
    try {
      parsed = parsePackets(this.buffer);
    } catch {
      ws.close();
      return;
    }
    this.buffer = parsed.rest;

    for (const pkt of parsed.packets) {
      if (pkt.type === 2) {                         // CONNACK
        if (pkt.body[1] !== 0) { ws.close(); return; }
        ws.send(subscribePacket(1, this.filter));
      } else if (pkt.type === 9) {                  // SUBACK
        if (pkt.body[2] === 0x80) { ws.close(); return; }
        ws.send(publishPacket(this.topic, '1', true));
        this.live = true;
        this.failures = 0;
        this.attempt = 0;
        if (this.openTimer) { clearTimeout(this.openTimer); this.openTimer = null; }
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
          if (ws.readyState !== 1) return;
          if (Date.now() - this.lastRx > this.keepalive * 1500) { ws.close(); return; }
          try { ws.send(PINGREQ); } catch { ws.close(); }
        }, Math.max(5000, (this.keepalive * 1000) / 2));
        this.emit();
      } else if (pkt.type === 3) {                  // PUBLISH
        this.onPublish(pkt);
      }
      // 13 = PINGRESP e demais: só atualizam lastRx
    }
  }

  private onPublish(pkt: MqttPacket): void {
    const qos = (pkt.flags >> 1) & 0x03;
    const body = pkt.body;
    if (body.length < 2) return;
    const topicLength = (body[0] << 8) | body[1];
    const topic = dec.decode(body.subarray(2, 2 + topicLength));
    let offset = 2 + topicLength;
    if (qos > 0) offset += 2;
    const payload = body.subarray(offset);

    const parts = topic.split('/');
    const tab = parts.pop();
    const visitor = parts.pop();
    if (!tab || !visitor || parts.join('/') !== `${this.opts.room}/p`) return;

    if (payload.length === 0) {
      const set = this.tabs.get(visitor);
      if (set) { set.delete(tab); if (set.size === 0) this.tabs.delete(visitor); }
    } else {
      let set = this.tabs.get(visitor);
      if (!set) { set = new Set(); this.tabs.set(visitor, set); }
      set.add(tab);
    }
    if (this.live) this.emit();
  }

  private handleClose(): void {
    this.clearTimers();
    this.ws = null;
    this.live = false;
    this.tabs.clear();
    if (this.stopped) return;
    this.failures += 1;
    this.attempt += 1;
    this.emit();
    const delay = Math.min(30000, 1000 * 2 ** Math.min(this.attempt - 1, 5)) + Math.random() * 500;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}

// ------------------------------------------------------------------ orquestração (navegador)
function readMeta(name: string): string {
  if (typeof document === 'undefined') return '';
  return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content.trim() || '';
}

function readOnlineCount(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const value = record.online ?? record.activeUsers ?? record.visitorsOnline ?? record.count;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

export function startPresence(onChange: (snapshot: PresenceSnapshot) => void): () => void {
  const visitorId = getVisitorId();
  const tabId = getTabId();
  const room = (readMeta('site-presence-room') || DEFAULT_ROOM).replace(/^\/+|\/+$/g, '');
  const endpoint = readMeta('site-presence-endpoint');
  const endpointOk = /^https?:\/\//i.test(endpoint);

  let local = heartbeatLocal(tabId);
  let endpointOnline: number | null = null;
  let endpointFailures = 0;
  let channel: PresenceChannel | null = null;
  let channelState: ChannelState = { online: 0, live: false, broker: null, failures: 0 };
  let stopped = false;

  const emit = () => {
    if (stopped) return;
    if (endpointOk && endpointOnline !== null) {
      onChange({ online: Math.max(endpointOnline, 1), source: 'endpoint', status: 'live', broker: null });
      return;
    }
    if (channelState.live) {
      onChange({ online: Math.max(channelState.online, 1), source: 'broker', status: 'live', broker: channelState.broker });
      return;
    }
    const degraded = channel ? channelState.failures >= 3 : endpointFailures >= 2;
    onChange({ online: local, source: 'local', status: degraded ? 'degraded' : 'connecting', broker: null });
  };

  const ensureChannel = () => {
    if (channel) return;
    channel = new PresenceChannel({
      room, visitorId, tabId,
      onUpdate: state => { channelState = state; emit(); },
    });
    channel.start();
  };

  // 1) endpoint próprio (opcional)
  let endpointTimer: Timer | null = null;
  const pollEndpoint = async () => {
    const base = endpoint.replace(/\/+$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const heartbeat = await fetch(`${base}/heartbeat`, {
        method: 'POST', cache: 'no-store', credentials: 'omit', signal: controller.signal,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId }),
      });
      if (!heartbeat.ok) throw new Error(`heartbeat HTTP ${heartbeat.status}`);
      const response = await fetch(base, { cache: 'no-store', credentials: 'omit', signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const count = readOnlineCount(await response.json());
      if (count === null) throw new Error('resposta de presença inválida');
      endpointOnline = count;
      endpointFailures = 0;
    } catch {
      endpointOnline = null;
      endpointFailures += 1;
      ensureChannel(); // cai para o canal público enquanto o endpoint não responde
    } finally {
      clearTimeout(timeout);
      emit();
    }
  };

  if (endpointOk) {
    void pollEndpoint();
    endpointTimer = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState === 'visible') void pollEndpoint(); }, ENDPOINT_POLL_MS);
  } else {
    ensureChannel();
  }

  // 3) contagem local (sempre ativa, barata)
  const localTimer = setInterval(() => { local = heartbeatLocal(tabId); emit(); }, LOCAL_HEARTBEAT_MS);
  const onStorage = (event: StorageEvent) => {
    if (event.key && event.key.startsWith(TAB_PREFIX)) { local = heartbeatLocal(tabId); emit(); }
  };
  const onVisibility = () => { if (document.visibilityState === 'visible') channel?.nudge(); };
  const onLeave = () => { clearLocalTab(tabId); channel?.stop(); };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
    window.addEventListener('pagehide', onLeave);
    document.addEventListener('visibilitychange', onVisibility);
  }

  emit();

  return () => {
    stopped = true;
    clearInterval(localTimer);
    if (endpointTimer) clearInterval(endpointTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pagehide', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    }
    onLeave();
  };
}
