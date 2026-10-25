import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { formatNumber } from '../utils/format';
import { startPresence, type PresenceSnapshot } from '../services/presence';

const INITIAL: PresenceSnapshot = { online: 1, source: 'local', status: 'connecting', broker: null };

export default function LiveViewersBadge() {
  const [snap, setSnap] = useState<PresenceSnapshot>(INITIAL);

  useEffect(() => startPresence(setSnap), []);

  const live = snap.status === 'live';
  const n = snap.online;

  const label = live
    ? `${formatNumber(n)} ${n === 1 ? 'pessoa' : 'pessoas'} no site agora`
    : snap.status === 'connecting'
      ? `conectando contador · ${formatNumber(n)} aqui`
      : `${formatNumber(n)} ${n === 1 ? 'aba' : 'abas'} neste navegador`;

  const title = live
    ? snap.source === 'endpoint'
      ? 'Pessoas com a página aberta agora, somadas entre todos os dispositivos (serviço de presença próprio). Várias abas do mesmo navegador contam como uma pessoa. Sem IP nem dados pessoais.'
      : `Pessoas com a página aberta agora, somadas entre todos os dispositivos via canal de presença em tempo real (${snap.broker?.replace(/^wss:\/\//, '').split(':')[0] || 'broker público'}). Várias abas do mesmo navegador contam como uma pessoa. Só circulam identificadores aleatórios — nenhum IP ou dado pessoal.`
    : snap.status === 'connecting'
      ? 'Conectando ao canal de presença para somar as pessoas de todos os dispositivos…'
      : 'Não foi possível conectar ao canal de presença (rede bloqueando WebSocket?). Mostrando apenas as abas deste navegador.';

  const dotClass = live ? 'bg-green' : snap.status === 'degraded' ? 'bg-amber' : 'bg-[#7aa58f]';
  const textClass = live ? 'text-green' : snap.status === 'degraded' ? 'text-amber' : 'text-[#5f7a6c]';

  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-hair bg-panel/80 px-2 py-[3px]"
      title={title}
      aria-live="polite"
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-60" />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotClass}`} />
      </span>
      <Users className={`h-2.5 w-2.5 shrink-0 ${textClass}`} />
      <span className={`mono truncate text-[8px] uppercase tracking-[0.08em] ${textClass}`}>{label}</span>
      {snap.status === 'degraded' && (
        <span className="mono hidden text-[7px] uppercase tracking-[0.08em] text-[#9aa59d] sm:inline">· contador global indisponível</span>
      )}
    </span>
  );
}
