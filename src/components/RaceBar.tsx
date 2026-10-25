import { useEffect, useRef, useState } from 'react';
import type { CandidateResult, ElectionResult, FonteDados } from '../types/tse';
import { formatNumber, formatPercent } from '../utils/format';
import { softFill, withAlpha } from '../theme';
import { Check, Hourglass, Minus, TrendingDown, TrendingUp, Trophy } from 'lucide-react';

interface RaceBarProps {
  resultado: ElectionResult | null;
  local: string;
  loading?: boolean;
  fonte?: FonteDados;
  boletinsLidos?: number;
}

function Metric({ label, value, tone = 'text-ink' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-hair bg-panel px-2.5 py-2">
      <p className="mono text-[7.5px] uppercase tracking-[0.13em] text-[#8a958d]">{label}</p>
      <p className={`mono mt-1 text-[12px] font-medium tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function CandidateBar({
  cand, validos, totalVotos, lider, votosRival, pctRival, faltaMaioria, final,
}: {
  cand: CandidateResult;
  validos: number;
  totalVotos: number;
  lider: boolean;
  votosRival: number;
  pctRival: number;
  faltaMaioria: number;
  final: boolean;
}) {
  const diferenca = cand.votos - votosRival;
  const deltaPct = cand.percentual - pctRival;
  const [flash, setFlash] = useState(false);
  const prev = useRef(String(cand.votos));
  useEffect(() => {
    if (prev.current !== String(cand.votos)) {
      prev.current = String(cand.votos);
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1100);
      return () => clearTimeout(t);
    }
  }, [cand.votos]);

  const pctTotal = totalVotos > 0 ? (cand.votos / totalVotos) * 100 : 0;
  const eleito = final && lider;

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border p-4 transition-all duration-300 ${
        flash ? 'border-green/45 bg-white' : 'border-hair bg-panel hover:border-[#cfc8b5] hover:bg-white'
      }`}
    >
      <span className="absolute left-0 top-0 h-full w-[3px]" style={{ background: cand.cor }} />
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: withAlpha(cand.cor, 0.16) }}
      />

      <div className="relative flex items-start gap-3.5">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
          style={{ background: softFill(cand.cor, 0.28), color: cand.cor, border: `1px solid ${withAlpha(cand.cor, 0.3)}` }}>
          {cand.numero}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="display text-[24px] leading-none text-ink sm:text-[26px]">{cand.nomeUrna}</h3>
            {eleito && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green/12 px-2 py-[3px] text-[9px] font-bold uppercase tracking-[0.1em] text-green">
                <Trophy className="h-2.5 w-2.5" /> eleito
              </span>
            )}
            {lider && !final && (
              <span className="rounded-full bg-amber/12 px-2 py-[3px] text-[9px] font-bold uppercase tracking-[0.1em] text-amber">
                na frente
              </span>
            )}
          </div>
          <p className="mono mt-1 text-[9.5px] uppercase tracking-[0.1em] text-[#8a958d]">
            {cand.partido}
            {cand.viceNome && <span className="text-[#a8a291]"> · vice {cand.viceNome}</span>}
          </p>

          {/* BARRA INDIVIDUAL DO CANDIDATO */}
          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-1">
                <span className="mono text-[30px] font-medium leading-none tracking-[-0.03em] tabular-nums sm:text-[34px]" style={{ color: cand.cor }}>
                  {cand.percentual.toFixed(2).replace('.', ',')}
                </span>
                <span className="mono text-[14px] text-[#8a958d]">%</span>
                <span className="mono ml-1.5 text-[9px] uppercase tracking-[0.1em] text-[#8a958d]">dos votos válidos</span>
              </div>
              <span className="mono text-[12px] tabular-nums text-inksoft">{formatNumber(cand.votos)} votos</span>
            </div>

            <div className="mt-2 h-7 w-full overflow-hidden rounded-lg border border-hair" style={{ background: '#efeadd' }}>
              <div className="flex h-full items-center justify-between rounded-lg px-2.5 transition-[width] duration-700 ease-out"
                style={{ width: `${Math.max(cand.percentual, 4)}%`, background: `linear-gradient(90deg, ${cand.cor}, ${withAlpha(cand.cor, 0.82)})` }}>
                <span className="mono truncate text-[10px] font-semibold text-white/95">{formatPercent(cand.percentual, 1)}</span>
                {cand.percentual > 26 && <span className="mono text-[9px] text-white/70 tnum">{formatNumber(cand.votos)}</span>}
              </div>
            </div>
            <div className="mono mt-1.5 flex items-center justify-between text-[8.5px] uppercase tracking-[0.08em] text-[#9aa59d]">
              <span>0%</span>
              <span className="text-amber">meta 50% + 1</span>
              <span>{formatNumber(validos)} válidos</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="votos nominais" value={formatNumber(cand.votos)} />
            <Metric label="% do total comparecido" value={formatPercent(pctTotal, 1)} />
            <Metric
              label={deltaPct >= 0 ? 'vantagem' : 'desvantagem'}
              value={`${deltaPct >= 0 ? '+' : '−'}${Math.abs(deltaPct).toFixed(2).replace('.', ',')} p.p.`}
              tone={deltaPct >= 0 ? 'text-green' : 'text-amber'}
            />
            {!final && faltaMaioria > 0
              ? <Metric label="faltam p/ maioria" value={`−${formatNumber(faltaMaioria)}`} tone="text-amber" />
              : <Metric label="situação" value={eleito ? 'eleito' : final ? 'não eleito' : 'em apuração'} tone={eleito ? 'text-green' : 'text-ink'} />}
          </div>

          <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-inksoft">
            {deltaPct > 0 ? (
              <><TrendingUp className="h-3 w-3 text-green" /> à frente do rival por <strong className="mono text-ink">{formatNumber(diferenca)}</strong> votos ({formatPercent(Math.abs(deltaPct))})</>
            ) : deltaPct < 0 ? (
              <><TrendingDown className="h-3 w-3 text-amber" /> atrás do rival por <strong className="mono text-ink">{formatNumber(Math.abs(diferenca))}</strong> votos ({formatPercent(Math.abs(deltaPct))})</>
            ) : (
              <><Minus className="h-3 w-3 text-[#8a958d]" /> empate numérico neste recorte</>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function ThinBar({ label, votos, base, color }: { label: string; votos: number; base: number; color: string }) {
  const pct = base > 0 ? (votos / base) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="mono w-24 flex-shrink-0 text-[9.5px] uppercase tracking-[0.08em] text-[#8a958d]">{label}</span>
      <div className="bar h-2 flex-1"><i style={{ width: `${Math.min(pct, 100)}%`, background: color }} /></div>
      <span className="mono w-36 text-right text-[10px] tabular-nums text-inksoft">
        {formatNumber(votos)} · {formatPercent(pct, 1)}
      </span>
    </div>
  );
}

export default function RaceBar({ resultado, local, loading, fonte = 'tse', boletinsLidos = 0 }: RaceBarProps) {
  const previa = fonte === 'boletim';
  if (loading && !resultado) {
    return (
      <div className="panel space-y-3 p-6">
        <div className="h-5 w-56 animate-pulse rounded bg-[#e9e4d6]" />
        {[0, 1].map(i => <div key={i} className="h-32 animate-pulse rounded-xl bg-[#eee9dc]" />)}
      </div>
    );
  }

  const top2 = (resultado?.candidatos || []).slice(0, 2);
  const cands = [...top2].sort((a, b) => a.numero - b.numero);
  const lider = resultado?.candidatos[0];
  const rival = resultado?.candidatos[1];
  const validos = resultado?.votosValidos || 0;
  const totalVotos = resultado?.totalVotos || 0;
  const final = !!resultado?.totalizacaoFinal;
  const maioria = Math.floor(validos / 2) + 1;

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hair px-5 py-4">
        <div>
          <div className="eyebrow">Disputa presidencial · uma barra por candidato</div>
          <h2 className="display mt-1.5 text-[clamp(26px,3vw,38px)] leading-none text-ink">{local}</h2>
          <p className="mt-2 max-w-[520px] text-[12px] leading-relaxed text-inksoft">
            Cada candidato tem sua própria barra, medida sobre os <strong>votos válidos</strong> ({formatNumber(validos)}),
            com o total nominal ao lado. A barra dividida do placar é apenas referência de leitura.
          </p>
          {previa && (
            <p className="mt-2.5 inline-flex max-w-[620px] items-start gap-2 rounded-lg border border-amber/25 bg-amber/[0.08] px-3 py-2 text-[11.5px] leading-relaxed text-inksoft">
              <span className="mono mt-[1px] rounded bg-amber px-1.5 py-[1px] text-[8.5px] font-semibold uppercase tracking-[0.08em] text-white">prévia</span>
              <span>
                Soma de <strong className="text-ink">{formatNumber(boletinsLidos)} boletins de urna</strong> do exterior já publicados pelo TSE.
                A totalização oficial começa às 17h (Brasília) e substitui esta prévia automaticamente.
              </span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {final ? (
            <span className="chip chip-on !normal-case">totalização final</span>
          ) : validos > 0 ? (
            <span className="chip"><Hourglass className="h-3 w-3" /> {formatPercent(resultado!.percentualSecoes, 1)} das urnas{previa ? ' do exterior' : ''}</span>
          ) : (
            <span className="chip"><Hourglass className="h-3 w-3" /> aguardando 17h</span>
          )}
          <span className="mono text-[9px] uppercase tracking-[0.1em] text-[#8a958d]">
            maioria absoluta: {formatNumber(maioria)}
          </span>
        </div>
      </div>

      {cands.length > 0 ? (
        <div className="space-y-3 p-5">
          {cands.map(c => (
            <CandidateBar
              key={c.numero}
              cand={c}
              validos={validos}
              totalVotos={totalVotos}
              lider={lider?.numero === c.numero}
              votosRival={c.numero === rival?.numero ? (lider?.votos || 0) : (rival?.votos || 0)}
              pctRival={c.numero === rival?.numero ? (lider?.percentual || 0) : (rival?.percentual || 0)}
              faltaMaioria={Math.max(maioria - c.votos, 0)}
              final={final}
            />
          ))}

          <div className="rounded-xl border border-hair bg-[#f6f3ea] px-4 py-3.5">
            <div className="eyebrow mb-2.5">Fora dos votos válidos · % sobre o total comparecido</div>
            <div className="space-y-2">
              <ThinBar label="Brancos" votos={resultado?.votosBrancos || 0} base={totalVotos} color="#a8a291" />
              <ThinBar label="Nulos" votos={resultado?.votosNulos || 0} base={totalVotos} color="#8a958d" />
              <ThinBar label="Abstenção" votos={resultado?.abstencao || 0} base={resultado?.eleitoradoTotal || 0} color="#cfc8b6" />
            </div>
            <div className="mono mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hair pt-2.5 text-[9px] uppercase tracking-[0.09em] text-[#8a958d]">
              <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green" /> urnas {formatNumber(resultado?.secoesTotalizadas || 0)}/{formatNumber(resultado?.secoesTotal || 0)}</span>
              <span>eleitorado {formatNumber(resultado?.eleitoradoTotal || 0)}</span>
              <span>comparecimento {formatPercent(resultado?.percentualComparecimento || 0, 1)}</span>
              <span className={previa ? 'text-amber' : 'text-[#b3ac9a]'}>{previa ? 'fonte: boletins de urna publicados pelo TSE (pleito 3221)' : 'fonte: TSE · resultado unificado (EA20)'}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 text-center">
          <p className="mono text-[10px] uppercase tracking-[0.12em] text-[#8a958d]">nenhum voto computado neste recorte</p>
          <p className="mt-2 text-[13px] text-inksoft">
            A apuração do 2º turno começa às <strong className="text-ink">17h</strong> de 25/10/2026 (Brasília).
            As barras individuais se preenchem sozinhas a cada ciclo de 15s.
          </p>
        </div>
      )}
    </section>
  );
}
