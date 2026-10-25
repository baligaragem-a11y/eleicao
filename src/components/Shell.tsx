import { useEffect, useState } from 'react';
import type { CandidateResult, ElectionResult, FonteDados, PaisResumo } from '../types/tse';
import { formatNumber, formatPercent, formatHora, tempoRelativo } from '../utils/format';
import { withAlpha } from '../theme';
import LiveViewersBadge from './LiveViewersBadge';
import {
  Globe2, Pause, Play, RefreshCw, ArrowRight, ArrowUpRight, Percent, Flag,
  Building2, Clock3, ShieldCheck,
} from 'lucide-react';

export interface Lector {
  sigla: string;
  nome: string;
  pctA: number;
  pctB: number;
  valido: number;
}

function initials(nome: string): string {
  return nome.split(/\s+/).filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function SplitBar({ a, b, height = 8, dark = false }: { a: number; b: number; height?: number; dark?: boolean }) {
  const total = Math.max(a + b, 0.0001);
  return (
    <div className="relative w-full overflow-hidden rounded-full" style={{ height, background: dark ? 'rgba(255,255,255,.14)' : '#e7e2d4' }}>
      <div className="h-full transition-[width] duration-700 ease-out" style={{ width: `${(a / total) * 100}%`, background: dark ? '#f0655f' : '#c0392b' }} />
      <div className="h-full transition-[width] duration-700 ease-out" style={{ width: `${(b / total) * 100}%`, background: dark ? '#7fb2f0' : '#2f6fb5' }} />
      <span className="absolute top-1/2 h-[150%] w-px -translate-x-1/2 -translate-y-1/2" style={{ left: '50%', background: dark ? 'rgba(255,255,255,.4)' : 'rgba(21,37,31,.28)' }} />
    </div>
  );
}

function Sparkline({ values, color = '#0b6650', w = 140, h = 42 }: { values: number[]; color?: string; w?: number; h?: number }) {
  if (values.length < 2) return <div style={{ width: w, height: h }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 2) + 1, h - 4 - ((v - min) / span) * (h - 10)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} aria-hidden>
      <path d={`${d} L${w - 1},${h} L1,${h} Z`} fill={withAlpha(color, 0.1)} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.2" fill={color} />
    </svg>
  );
}

export function Header({
  live, lastUpdate, paused, onTogglePause, onRefresh, onSources, onNavigate,
}: {
  live: boolean;
  lastUpdate: Date | null;
  paused: boolean;
  onTogglePause: () => void;
  onRefresh: () => void;
  onSources: () => void;
  onNavigate: (id: string) => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick(v => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-hair bg-paper/92 backdrop-blur-xl">
      <div className="mx-auto grid min-h-[76px] max-w-[1400px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2 sm:px-8 lg:grid-cols-[minmax(180px,1fr)_auto_minmax(0,1fr)]">
        <div className="min-w-0">
          <button onClick={() => onNavigate('topo')} className="flex items-center gap-2.5 text-left">
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-deep text-[#9fd9c1]">
              <Globe2 className="h-4.5 w-4.5" strokeWidth={1.6} />
              <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-amber text-[7px] text-white">★</span>
            </span>
            <span className="min-w-0">
              <span className="display block text-[21px] leading-[0.9] text-ink">Voto Global</span>
              <span className="mono mt-0.5 block text-[8px] uppercase tracking-[0.17em] text-[#7d8a82]">Brasil 2026 · tempo real</span>
            </span>
          </button>
          <div className="ml-[42px] mt-1">
            <LiveViewersBadge />
          </div>
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {[['panorama', 'Panorama'], ['estados', 'Estados'], ['exterior', 'Exterior']].map(([id, label], i) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="group relative rounded-full px-3.5 py-2 text-[13px] font-semibold text-inksoft transition-colors hover:text-ink"
            >
              <span className="mono mr-1.5 text-[9px] text-[#9aa59d]">0{i + 1}</span>
              {label}
              <span className="absolute inset-x-3 bottom-1 h-[2px] scale-x-0 rounded-full bg-green transition-transform duration-200 group-hover:scale-x-100" />
            </button>
          ))}
        </nav>

        <div className="flex min-w-0 flex-nowrap items-center justify-end gap-1.5 sm:gap-2">
          {lastUpdate && (
            <span className="hidden items-center gap-1.5 rounded-full border border-hair bg-panel px-2.5 py-1.5 xl:inline-flex">
              <Clock3 className="h-3 w-3 text-[#7d8a82]" />
              <span className="mono text-[9.5px] text-[#55635b]">
                atualizado {formatHora(lastUpdate)} · {tempoRelativo(new Date(lastUpdate.getTime()))}
              </span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hair bg-panel px-2.5 py-1.5">
            <span className="live-dot" style={paused ? { animation: 'none', background: '#c26024' } : undefined} />
            <span className="mono text-[9px] uppercase tracking-[0.13em] text-[#3f7d68]">{paused ? 'pausado' : live ? 'ao vivo' : 'conectando'}</span>
          </span>
          <div className="flex items-center gap-0.5 border-l border-hair pl-1.5">
            <button onClick={onTogglePause} title={paused ? 'Retomar atualização' : 'Pausar atualização'}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#55635b] transition-colors hover:bg-white hover:text-ink">
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
            <button onClick={onRefresh} title="Atualizar agora"
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#55635b] transition-colors hover:bg-white hover:text-ink">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          <button onClick={onSources} className="btn btn-ghost !py-1.5 !text-[11.5px]">
            Fontes <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function Hero({
  placar, fonte, exterior, paises, lastUpdate, ufsRespondendo, boletins, onExplore, onSources, onTable, onExterior,
}: {
  placar: ElectionResult | null;
  fonte: FonteDados;
  exterior: ElectionResult | null;
  paises: PaisResumo[];
  lastUpdate: Date | null;
  ufsRespondendo: number;
  boletins: { lidos: number; publicados: number; total: number } | null;
  onExplore: () => void;
  onSources: () => void;
  onTable: () => void;
  onExterior: () => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(v => v + 1), 1000); return () => clearInterval(t); }, []);
  const previa = fonte === 'boletim';
  const cands = [...(placar?.candidatos || []).slice(0, 2)].sort((a, b) => a.numero - b.numero);
  const validos = placar?.votosValidos || 0;
  const comVotos = paises.filter(p => p.votosValidos > 0).length;
  const margem = cands.length >= 2 ? Math.abs(cands[0].percentual - cands[1].percentual) : 0;

  return (
    <section id="panorama" className="relative overflow-hidden border-b border-hair">
      <div className="mx-auto grid max-w-[1400px] items-center gap-10 px-4 py-12 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-14">
        <div className="rise-in">
          <div className="eyebrow flex items-center gap-2">
            <span className="rounded-full bg-amber/12 px-2 py-[3px] text-amber">2º turno</span>
            <span>· apuração contínua · dados oficiais tse</span>
          </div>
          <h1 className="display mt-4 text-[clamp(42px,6.2vw,74px)] leading-[0.95] text-ink">
            A escolha do Brasil,<br />
            <em className="italic text-green">estado por estado.</em>
          </h1>
          <p className="mt-5 max-w-[480px] text-[14px] leading-relaxed text-inksoft">
            Acompanhe a apuração do segundo turno presidencial direto dos arquivos públicos do TSE — as 27 unidades
            federativas e as 186 localidades consulares, com cada voto já computado identificado pela fonte.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            {previa
              ? <button onClick={onExterior} className="btn btn-dark">Ver votos já computados <ArrowRight className="h-3.5 w-3.5" /></button>
              : <button onClick={onExplore} className="btn btn-dark">Explorar o mapa <ArrowRight className="h-3.5 w-3.5" /></button>}
            <button onClick={onTable} className="btn btn-ghost">Tabela de estados <ArrowRight className="h-3.5 w-3.5" /></button>
            <button onClick={onSources} className="btn btn-ghost">Fontes e metodologia <ArrowUpRight className="h-3.5 w-3.5" /></button>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hair pt-5 text-[12px] text-inksoft">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-green" /><strong className="font-mono text-ink">{ufsRespondendo}/27</strong> UFs com votos</span>
            <span className="flex items-center gap-1.5"><Flag className="h-3.5 w-3.5 text-green" /><strong className="font-mono text-ink">{comVotos}</strong> países com votos</span>
            <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-green" /><strong className="font-mono text-ink">{formatNumber(exterior?.secoesTotalizadas || 0)}</strong> urnas do exterior computadas</span>
            {lastUpdate && <span className="mono ml-auto text-[10px] text-[#8a958d]">última leitura {tempoRelativo(new Date(lastUpdate.getTime()))}</span>}
          </div>
        </div>

        {/* Placar — cartão escuro */}
        <div className="rise-in overflow-hidden rounded-[20px] bg-deep p-5 text-[#eef3ef] shadow-[0_30px_60px_-40px_rgba(13,43,35,.85)] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="eyebrow !text-[#7fb8a2]">{previa ? 'Votos já computados · exterior' : 'Placar nacional · votos válidos'}</div>
              <div className="display mt-1 text-[30px] leading-none tnum">
                {formatNumber(validos)} <span className="text-[17px] text-[#9db8ad]">votos válidos</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1">
                <span className="live-dot" />
                <span className="mono text-[9px] uppercase tracking-[0.13em] text-[#bfe4d4]">ao vivo</span>
              </span>
              {placar && (
                <span className="mono text-right text-[9px] text-[#7f9c92]">
                  {previa && boletins
                    ? `${formatNumber(boletins.lidos)}/${formatNumber(boletins.total)} urnas do exterior`
                    : `${formatPercent(placar.percentualSecoes)} das urnas`}
                </span>
              )}
            </div>
          </div>

          {previa && (
            <div className="mt-4 rounded-lg border border-[#e2a36f]/30 bg-[#c26024]/15 px-3 py-2.5 text-[11.5px] leading-relaxed text-[#f3d9c4]">
              <strong className="text-white">Prévia por boletim de urna.</strong> A totalização nacional do TSE começa às 17h (Brasília).
              Até lá, este placar soma os {formatNumber(boletins?.lidos || 0)} boletins já publicados pelo TSE no exterior,
              cada um conferido seção a seção.
            </div>
          )}

          <div className="mt-4 space-y-3">
            {cands.map(c => {
              const outro = cands.find(x => x.numero !== c.numero);
              const diff = outro ? c.votos - outro.votos : 0;
              return (
                <div key={c.numero} className="rounded-xl border border-white/10 bg-white/[0.045] p-3.5 transition-colors hover:bg-white/[0.07]">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{ background: withAlpha(c.cor, 0.22), color: '#f4f1ea', border: `1px solid ${withAlpha(c.cor, 0.5)}` }}>
                      {initials(c.nomeUrna)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold">{c.nomeUrna}</p>
                      <p className="mono truncate text-[9.5px] uppercase tracking-[0.09em] text-[#8fb4a5]">{c.partido} · nº {c.numero}</p>
                    </div>
                    <div className="text-right">
                      <div className="mono text-[25px] font-medium leading-none tnum">{formatPercent(c.percentual)}</div>
                      <div className="mono mt-1 text-[9.5px] text-[#9db8ad] tnum">{formatNumber(c.votos)} votos</div>
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <div className="bar !bg-white/10" style={{ height: 7 }}>
                      <i style={{ width: `${Math.min(c.percentual, 100)}%`, background: c.cor }} />
                    </div>
                    <div className="mono mt-1 flex justify-between text-[8.5px] text-[#7f9c92]">
                      <span>barra proporcional aos votos válidos</span>
                      <span>{diff >= 0 ? `+${formatNumber(diff)}` : `−${formatNumber(Math.abs(diff))}`} vs rival</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {cands.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center">
                <p className="mono text-[10px] uppercase tracking-[0.1em] text-[#8fb4a5]">Conectando ao TSE…</p>
              </div>
            )}
          </div>

          {cands.length >= 2 && validos > 0 && (
            <>
              <div className="mt-4"><SplitBar a={cands[0].percentual} b={cands[1].percentual} dark /></div>
              <div className="mono mt-1.5 flex items-center justify-between text-[9px] uppercase tracking-[0.1em] text-[#8fb4a5]">
                <span>barra dividida (referência)</span><span>50%</span>
              </div>
            </>
          )}

          {placar && (
            <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-4">
              {(previa
                ? [
                  ['urnas lidas', `${formatNumber(boletins?.lidos || 0)}/${formatNumber(boletins?.total || 0)}`],
                  ['votos válidos', formatNumber(validos)],
                  ['margem', formatPercent(margem, 2)],
                  ['países', String(comVotos)],
                ]
                : [
                  ['apurado', formatPercent(placar.percentualSecoes, 1)],
                  ['votos válidos', formatNumber(validos)],
                  ['margem', formatPercent(margem, 2)],
                  ['exterior', formatNumber(exterior?.votosValidos || 0)],
                ]).map(([k, v]) => (
                <div key={k} className="bg-[#0f3229] px-3 py-2.5">
                  <div className="text-[8px] uppercase tracking-[0.14em] text-[#7f9c92]">{k}</div>
                  <div className="mono mt-1 text-[12px] tnum">{v}</div>
                </div>
              ))}
            </div>
          )}
          <p className="mono mt-3 text-[8.5px] uppercase tracking-[0.1em] text-[#7f9c92]">
            fonte: {previa ? 'boletins de urna publicados pelo TSE (pleito 3221)' : 'totalização TSE · arquivo EA20'}
          </p>
        </div>
      </div>
    </section>
  );
}

export function StatsStrip({
  nacional, placar, fonte, porUfComVotos, decisivos, exterior, paises, boletins,
}: {
  nacional: ElectionResult | null;
  placar: ElectionResult | null;
  fonte: FonteDados;
  porUfComVotos: number;
  decisivos: Lector[];
  exterior: ElectionResult | null;
  paises: PaisResumo[];
  boletins: { lidos: number; publicados: number; total: number } | null;
}) {
  const [nA, nB] = [...(placar?.candidatos || []).slice(0, 2)].sort((a, b) => a.numero - b.numero);
  const apurado = nacional?.percentualSecoes || 0;
  const validos = placar?.votosValidos || 0;
  const totalVotos = placar?.totalVotos || 0;
  const extValidos = exterior?.votosValidos || 0;
  const paisesComVotos = paises.filter(p => p.votosValidos > 0).length;
  const pctBU = boletins && boletins.total > 0 ? (boletins.lidos / boletins.total) * 100 : 0;

  return (
    <section className="mx-auto max-w-[1400px] px-4 sm:px-8">
      <div className="panel -mt-6 overflow-hidden rounded-[18px] rise-in">
        <div className="hair-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <div className="hair-cell p-5">
            <div className="eyebrow flex items-center justify-between"><span>Urnas totalizadas · Brasil</span><span className="mono text-[8px]">01</span></div>
            <div className="display mt-2 text-[38px] leading-none tnum">{apurado.toFixed(1).replace('.', ',')}<span className="text-[18px]">%</span></div>
            <p className="mt-2 text-[11px] text-inksoft tnum">
              {formatNumber(nacional?.secoesTotalizadas || 0)} de {formatNumber(nacional?.secoesTotal || 0)} seções
              {apurado === 0 && ' · divulgação a partir das 17h'}
            </p>
            <div className="bar mt-2.5"><i style={{ width: `${apurado}%`, background: 'var(--color-green)' }} /></div>
            {boletins && boletins.lidos > 0 && (
              <p className="mono mt-2 text-[9.5px] text-amber tnum">+ {formatNumber(boletins.lidos)} urnas do exterior com boletim lido</p>
            )}
          </div>

          <div className="hair-cell p-5">
            <div className="eyebrow flex items-center justify-between"><span>Votos já computados</span><span className="mono text-[8px]">02</span></div>
            <div className="display mt-2 text-[38px] leading-none tnum">{formatNumber(validos)}</div>
            <p className="mono mt-2 text-[10px] text-inksoft">
              {fonte === 'boletim'
                ? 'votos válidos nos boletins do exterior'
                : `${totalVotos > 0 ? `${formatPercent((validos / totalVotos) * 100, 1)} do total · ` : ''}${formatNumber(placar?.votosBrancos || 0)} brancos · ${formatNumber(placar?.votosNulos || 0)} nulos`}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className={`mono text-[9px] ${fonte === 'boletim' ? 'text-amber' : 'text-[#3f7d68]'}`}>
                fonte: {fonte === 'boletim' ? 'boletins de urna · prévia' : 'TSE · EA20'}
              </span>
              <Sparkline values={decisivos.map(d => d.pctA)} w={90} h={26} />
            </div>
          </div>

          <div className="hair-cell p-5">
            <div className="eyebrow flex items-center justify-between"><span>Votos no exterior</span><span className="mono text-[8px]">03</span></div>
            <div className="display mt-2 text-[38px] leading-none tnum">{formatNumber(extValidos)}</div>
            <p className="mt-2 text-[11px] text-inksoft tnum">
              {paisesComVotos} países com votos · {formatPercent(exterior?.percentualSecoes || 0, 1)} das urnas
              {exterior?.fonte === 'boletim' && <span className="mono ml-1 text-[9px] text-amber">(boletins)</span>}
            </p>
            <div className="bar mt-2.5"><i style={{ width: `${exterior?.fonte === 'boletim' ? pctBU : exterior?.percentualSecoes || 0}%`, background: 'var(--color-amber)' }} /></div>
          </div>

          <div className="hair-cell p-5">
            <div className="eyebrow flex items-center justify-between"><span>Estados com votos</span><span className="mono text-[8px]">04</span></div>
            <div className="display mt-2 text-[38px] leading-none tnum">
              {porUfComVotos}<span className="text-[18px] text-[#8a958d]">/27</span>
            </div>
            {nA && nB && validos > 0 ? (
              <div className="mono mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: nA.cor }} />{nA.nomeUrna} {formatPercent(nA.percentual, 1)}</span>
                <Percent className="h-2.5 w-2.5 text-[#b3ac9a]" />
                <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: nB.cor }} />{nB.nomeUrna} {formatPercent(nB.percentual, 1)}</span>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-inksoft">Totalização dos estados a partir das 17h.</p>
            )}
            <div className="mt-2.5 flex gap-[3px]">
              {Array.from({ length: 27 }).map((_, i) => (
                <span key={i} className="h-1.5 flex-1 rounded-[2px]"
                  style={{ background: i < porUfComVotos ? 'var(--color-green)' : '#e2ddce' }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ReadingPanel({
  nacional, leitura, decisivos, onOpenTable,
}: {
  nacional: ElectionResult | null;
  leitura: Lector[];
  decisivos: Lector[];
  onOpenTable: () => void;
}) {
  const totalLeitura = leitura.reduce((s, r) => s + r.valido, 0);

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[18px] bg-deep p-5 text-[#eef3ef]">
        <div className="eyebrow !text-[#7fb8a2] flex items-center justify-between">
          <span>Leitura imediata</span>
          <span className="mono text-[8px]">6 maiores · {formatPercent(nacional?.percentualSecoes || 0, 1)} apurado</span>
        </div>
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-[#c7d6cf]">
          Os seis maiores colégios eleitorais somam {formatNumber(totalLeitura)} votos válidos apurados.
          A largura de cada bloco é proporcional ao peso do estado.
        </p>
        <div className="mt-4 flex h-9 overflow-hidden rounded-lg">
          {leitura.map(r => (
            <div key={r.sigla} className="relative flex items-center justify-center border-r border-[#0d2b23]/40 transition-all duration-700"
              style={{ width: `${totalLeitura ? (r.valido / totalLeitura) * 100 : 0}%`, background: r.pctA >= r.pctB ? '#b8463f' : '#3c6fa8' }}
              title={`${r.nome}: ${formatPercent(r.pctA)} × ${formatPercent(r.pctB)}`}>
              <span className="mono text-[9.5px] font-semibold text-white/90">{r.sigla}</span>
            </div>
          ))}
        </div>
        <div className="mono mt-2 flex justify-between text-[8.5px] uppercase tracking-[0.1em] text-[#8fb4a5]">
          <span>cor = candidato à frente</span>
          <button onClick={onOpenTable} className="underline decoration-white/25 underline-offset-2 transition-colors hover:text-white">
            ver tabela completa →
          </button>
        </div>
      </section>

      <section className="panel p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow">Estados decisivos</div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-inksoft">Diferença apertada entre os dois primeiros colocados.</p>
          </div>
          <span className="mono text-[8px] text-[#8a958d]">{decisivos.length}UF</span>
        </div>
        <ul className="mt-3 space-y-1">
          {decisivos.map((r, i) => (
            <li key={r.sigla}>
              <button className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white">
                <span className="mono w-4 text-[9px] text-[#9aa59d]">{String(i + 1).padStart(2, '0')}</span>
                <span className="w-8 text-[11.5px] font-bold text-ink">{r.sigla}</span>
                <div className="flex flex-1">
                  <div className="h-1.5 rounded-l-full" style={{ width: `${r.pctA * 1.3}%`, background: '#c0392b' }} />
                  <div className="h-1.5 rounded-r-full" style={{ width: `${r.pctB * 1.3}%`, background: '#2f6fb5' }} />
                </div>
                <span className="mono text-[10.5px] font-medium tabular-nums text-inksoft">
                  {r.pctA > r.pctB ? '+' : '−'}{formatPercent(Math.abs(r.pctA - r.pctB), 1)}
                </span>
                <ArrowUpRight className="h-3 w-3 text-[#c3bda9] opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </li>
          ))}
          {decisivos.length === 0 && (
            <li className="mono py-6 text-center text-[10px] uppercase tracking-[0.1em] text-[#8a958d]">
              aguardando votos para calcular margens
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

export function CandLegend({ candidatos }: { candidatos: CandidateResult[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {candidatos.slice(0, 2).map(c => (
        <span key={c.numero} className="flex items-center gap-1.5 text-[11px] font-semibold text-inksoft">
          <span className="h-2 w-2 rounded-full" style={{ background: c.cor }} />
          {c.nomeUrna} <span className="mono text-[9px] text-[#9aa59d]">nº {c.numero}</span>
        </span>
      ))}
    </div>
  );
}
