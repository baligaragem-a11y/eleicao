import { useState } from 'react';
import type { ElectionResult } from '../types/tse';
import { URL_SECOES_ZZ, type ExteriorSnapshot } from '../services/exterior';
import { formatHora, tempoRelativo } from '../utils/format';
import {
  AlertTriangle, ChevronDown, ChevronUp, Database, ExternalLink,
  MapPin, Server, ShieldCheck, Timer, Wifi,
} from 'lucide-react';

const URL_BR = 'https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json';

interface Props {
  nacional: ElectionResult | null;
  lastUpdate: Date | null;
  latencyMs: number | null;
  ufsRespondendo: number;
  cidadesExterior: number;
  error: string | null;
  boletins?: ExteriorSnapshot | null;
}

export default function DataSourcePanel({ nacional, lastUpdate, latencyMs, ufsRespondendo, cidadesExterior, error, boletins }: Props) {
  const [open, setOpen] = useState(false);
  const ok = !error && !!nacional;

  return (
    <div className={`panel overflow-hidden ${ok ? '' : ''}`}>
      <button onClick={() => setOpen(o => !o)} className="flex w-full flex-wrap items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white">
        <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] ${ok ? 'bg-green/12 text-green' : 'bg-amber/12 text-amber'}`}>
          {ok ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Procedência dos dados · 04</p>
          <p className="mt-1 text-[13px] font-bold text-ink">
            {ok ? 'Lendo os arquivos públicos do TSE neste navegador' : error || 'Aguardando primeira resposta do TSE'}
          </p>
        </div>
        <span className="mono hidden items-center gap-1.5 text-[9px] uppercase tracking-[0.1em] text-[#8a958d] sm:flex">
          <Wifi className={`h-3 w-3 ${ok ? 'text-green' : 'text-amber'}`} />
          {ufsRespondendo}/27 UFs · {cidadesExterior}/186 cidades{latencyMs !== null ? ` · ${Math.round(latencyMs)} ms` : ''}
          {lastUpdate && <span className="text-[#b3ac9a]">· {tempoRelativo(new Date(lastUpdate.getTime()))}</span>}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-[#8a958d]" /> : <ChevronDown className="h-4 w-4 text-[#8a958d]" />}
      </button>

      {open && (
        <div className="rise-in grid gap-px border-t border-hair bg-hair sm:grid-cols-2 xl:grid-cols-5">
          {[
            { icon: Database, label: 'Arquivo consultado', value: 'br-c0001-e006258-u.json', note: 'EA20 · resultado unificado · Presidente', href: URL_BR },
            { icon: Timer, label: 'Geração no TSE', value: nacional ? `${nacional.dataGeracao} ${nacional.horaGeracao}` : '—', note: 'carimbo do próprio arquivo, horário de Brasília' },
            { icon: MapPin, label: 'Cobertura', value: `${ufsRespondendo}/27 UFs + ZZ + ${cidadesExterior} cidades`, note: 'BR, ZZ e as 186 localidades consulares' },
            { icon: Server, label: 'Transporte', value: lastUpdate ? `HTTPS · ${formatHora(lastUpdate)}` : '—', note: 'sem servidor intermediário; token algum é enviado' },
            {
              icon: Database, label: 'Boletins de urna (exterior)',
              value: boletins ? `${boletins.secoesLidas}/${boletins.secoesComBU} lidos` : '—',
              note: boletins ? `índice TSE ${boletins.geradoTSE} · ${boletins.secoesTotal} urnas · cada BU conferido` : 'lendo o índice de seções…',
              href: URL_SECOES_ZZ,
            },
          ].map(item => (
            <div key={item.label} className="bg-panel p-4">
              <p className="mono flex items-center gap-1.5 text-[8px] uppercase tracking-[0.13em] text-[#8a958d]">
                <item.icon className="h-3 w-3" />{item.label}
              </p>
              {item.href ? (
                <a href={item.href} target="_blank" rel="noreferrer" className="mono mt-1.5 inline-flex items-start gap-1 text-[11.5px] text-green hover:underline">
                  {item.value}<ExternalLink className="mt-0.5 h-2.5 w-2.5" />
                </a>
              ) : (
                <p className="mono mt-1.5 text-[11.5px] tabular-nums text-ink">{item.value}</p>
              )}
              <p className="mt-1 text-[10.5px] leading-relaxed text-[#8a958d]">{item.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
