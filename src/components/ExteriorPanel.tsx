import type { ElectionResult, PaisResumo } from '../types/tse';
import type { ExteriorSnapshot } from '../services/exterior';
import { formatNumber, formatPercent } from '../utils/format';
import { withAlpha } from '../theme';
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, Globe, Hourglass, Loader2, MapPin } from 'lucide-react';

export function flagEmoji(iso2: string): string {
  if (!iso2) return '🌐';
  return iso2.toUpperCase().split('').map(c => String.fromCodePoint(127397 + c.charCodeAt(0))).join('');
}

interface Props {
  exterior: ElectionResult | null;
  paises: PaisResumo[];
  selectedPais: string | null;
  onSelectPais: (pais: string | null) => void;
  brasilComecou: boolean;
  boletins?: ExteriorSnapshot | null;
  erro?: string | null;
}

export default function ExteriorPanel({ exterior, paises, selectedPais, onSelectPais, brasilComecou, boletins, erro }: Props) {
  const previa = exterior?.fonte === 'boletim';
  const comVotos = paises.filter(p => p.votosValidos > 0);
  const finalizados = paises.filter(p => p.andamento === 'f').length;
  const selecionado = selectedPais ? paises.find(p => p.nome === selectedPais) || null : null;
  const antesDoBrasil = !brasilComecou && !!exterior && exterior.votosValidos > 0;
  const lista = selecionado && selecionado.votosValidos > 0
    ? [selecionado, ...comVotos.filter(p => p.nome !== selecionado.nome).slice(0, 5)]
    : comVotos.slice(0, 6);

  return (
    <section id="exterior" className="panel scroll-mt-24 overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hair px-5 py-4">
        <div>
          <div className="eyebrow">03 · Voto brasileiro no mundo</div>
          <h2 className="display mt-1.5 text-[clamp(26px,3vw,38px)] leading-none text-ink">Exterior, país por país</h2>
          <p className="mt-2 max-w-[620px] text-[12px] leading-relaxed text-inksoft">
            As urnas fecham no <strong>horário local</strong>. Austrália, Nova Zelândia e Japão totalizam ainda de madrugada
            (Brasília); depois Ásia, África, Europa e Américas. Cada voto já entra no total nacional.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {antesDoBrasil && (
            <span className="chip !normal-case !text-[9px] chip-on"><Clock3 className="h-3 w-3" /> apurado antes do Brasil</span>
          )}
          <span className="mono text-[9px] uppercase tracking-[0.1em] text-[#8a958d]">
            {comVotos.length}/133 países · {formatNumber(exterior?.votosValidos || 0)} votos
          </span>
        </div>
      </div>

      <div className="grid gap-px bg-hair lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="bg-panel p-5">
          <div className="eyebrow flex items-center gap-1.5">
            Placar do exterior (ZZ)
            <span className={`mono rounded px-1.5 py-[1px] text-[8px] font-semibold uppercase tracking-[0.06em] ${previa ? 'bg-amber/15 text-amber' : 'bg-green/12 text-green'}`}>
              {previa ? 'boletins' : 'totalizado'}
            </span>
          </div>
          <div className="display mt-1.5 text-[30px] leading-none tnum">{formatNumber(exterior?.votosValidos || 0)}</div>
          <p className="mono mt-1 text-[9px] uppercase tracking-[0.1em] text-[#8a958d]">
            votos válidos · {formatPercent(exterior?.percentualSecoes || 0, 1)} das seções{previa ? ' com boletim lido' : ''}
          </p>

          {exterior && exterior.votosValidos > 0 ? (
            <div className="mt-4 space-y-2.5">
              {[...exterior.candidatos].slice(0, 2).sort((a, b) => a.numero - b.numero).map(c => (
                <div key={c.numero}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] font-semibold text-ink">{c.nomeUrna}</span>
                    <span className="mono text-[12px] tabular-nums" style={{ color: c.cor }}>{formatPercent(c.percentual)}</span>
                  </div>
                  <div className="bar mt-1" style={{ height: 6 }}>
                    <i style={{ width: `${Math.min(c.percentual, 100)}%`, background: c.cor }} />
                  </div>
                  <p className="mono mt-0.5 text-[8.5px] text-[#9aa59d] tnum">{formatNumber(c.votos)} votos · nº {c.numero}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mono mt-4 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-[#8a958d]">
              <Hourglass className="h-3 w-3" /> {boletins?.emAndamento ? 'lendo boletins publicados…' : 'aguardando boletins consulares'}
            </p>
          )}

          {boletins && (
            <div className="mt-4 rounded-lg border border-hair bg-[#f6f3ea] p-3">
              <p className="mono flex items-center gap-1.5 text-[8.5px] uppercase tracking-[0.1em] text-[#8a958d]">
                {boletins.emAndamento ? <Loader2 className="h-3 w-3 animate-spin text-amber" /> : <FileCheck2 className="h-3 w-3 text-green" />}
                boletins de urna no TSE
              </p>
              <div className="bar mt-2" style={{ height: 6 }}>
                <i style={{ width: `${boletins.secoesTotal ? (boletins.secoesLidas / boletins.secoesTotal) * 100 : 0}%`, background: 'var(--color-amber)' }} />
              </div>
              <p className="mono mt-1.5 text-[9.5px] tabular-nums text-inksoft">
                {formatNumber(boletins.secoesLidas)} lidos · {formatNumber(boletins.secoesComBU)} publicados · {formatNumber(boletins.secoesTotal)} urnas
              </p>
              {(boletins.aguardando > 0 || boletins.falhas > 0) && (
                <p className="mono mt-1 text-[9px] text-[#8a958d]">
                  {boletins.aguardando > 0 && `${boletins.aguardando} aguardando anexo do boletim`}
                  {boletins.aguardando > 0 && boletins.falhas > 0 && ' · '}
                  {boletins.falhas > 0 && `${boletins.falhas} descartados na conferência`}
                </p>
              )}
              {boletins.bloqueadoAte > Date.now() && (
                <p className="mono mt-1 text-[9px] text-amber">TSE pediu pausa nas consultas — retomando em instantes</p>
              )}
            </div>
          )}
          {erro && (
            <p className="mt-3 flex items-start gap-1.5 text-[10.5px] text-amber"><AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />{erro}</p>
          )}

          <div className="mono mt-4 space-y-1.5 border-t border-hair pt-3 text-[9.5px] text-inksoft">
            <p className="flex items-center justify-between"><span>urnas apuradas</span><span className="tabular-nums">{formatNumber(exterior?.secoesTotalizadas || 0)}/{formatNumber(exterior?.secoesTotal || 0)}</span></p>
            <p className="flex items-center justify-between"><span>eleitorado</span><span className="tabular-nums">{formatNumber(exterior?.eleitoradoTotal || 0)}</span></p>
            <p className="flex items-center justify-between"><span>brancos / nulos</span><span className="tabular-nums">{formatNumber(exterior?.votosBrancos || 0)} / {formatNumber(exterior?.votosNulos || 0)}</span></p>
            <p className="flex items-center justify-between"><span>países finalizados</span>
              <span className="flex items-center gap-1 tabular-nums text-green"><CheckCircle2 className="h-3 w-3" />{finalizados}</span></p>
          </div>
        </div>

        <div className="bg-panel p-5">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Maiores colônias eleitorais</div>
            <span className="mono text-[8.5px] uppercase tracking-[0.1em] text-[#8a958d]">% sobre os votos válidos do país</span>
          </div>

          {selecionado && selecionado.votosValidos > 0 && (
            <div className="mt-3 rounded-xl border p-3.5" style={{ borderColor: withAlpha(selecionado.candidatos[0]?.cor || '#0b6650', 0.3), background: '#f6f3ea' }}>
              <div className="flex items-center gap-2">
                <span className="text-[15px] leading-none">{flagEmoji(selecionado.iso2)}</span>
                <div className="min-w-0 flex-1">
                  <p className="display text-[19px] leading-none text-ink">{selecionado.nome}</p>
                  <p className="mono mt-1 text-[8.5px] uppercase tracking-[0.1em] text-[#8a958d]">
                    {selecionado.regiao} · {selecionado.cidadesComVotos}/{selecionado.cidadesTotal} localidades · {formatPercent(selecionado.percentualSecoes, 1)} das urnas · {selecionado.fonte === 'tse' ? 'totalização TSE' : 'boletins de urna'}
                  </p>
                </div>
                <button onClick={() => onSelectPais(null)} className="mono text-[8.5px] uppercase tracking-[0.08em] text-[#8a958d] hover:text-ink">limpar</button>
              </div>
              <div className="mt-3 space-y-2">
                {selecionado.candidatos.slice(0, 2).map(c => (
                  <div key={c.numero} className="flex items-center gap-2.5">
                    <span className="mono flex h-5 min-w-[26px] items-center justify-center rounded px-1 text-[9px] font-semibold text-white" style={{ background: c.cor }}>{c.numero}</span>
                    <div className="bar h-4 flex-1 !rounded-md">
                      <i style={{ width: `${Math.min(c.percentual, 100)}%`, background: c.cor }} />
                    </div>
                    <span className="mono w-[128px] text-right text-[10px] tabular-nums text-inksoft">
                      {formatNumber(c.votos)} · {formatPercent(c.percentual)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ul className="mt-3 divide-y divide-hair">
            {lista.map(p => {
              const tem = p.votosValidos > 0;
              const lid = p.candidatos[0];
              const sel = selectedPais === p.nome;
              return (
                <li key={p.nome}>
                  <button onClick={() => onSelectPais(sel ? null : p.nome)}
                    className={`group flex w-full items-center gap-3 py-2 pl-1 pr-2 text-left transition-colors ${sel ? 'bg-green/[0.06]' : 'hover:bg-white'}`}>
                    <span className="text-[14px] leading-none">{flagEmoji(p.iso2)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[12px] font-semibold text-ink">{p.nome}</span>
                        {p.cidadesTotal > 1 && <span className="mono text-[8px] text-[#9aa59d]">{p.cidadesTotal} locais</span>}
                        {tem && lid && <TrophyIfNeeded tem={p.andamento === 'f'} fonte={p.fonte} />}
                      </div>
                      {tem ? (
                        <div className="mt-1 flex h-1.5 overflow-hidden rounded-full" style={{ background: '#e9e4d6' }}>
                          <div className="h-full transition-[width] duration-700" style={{ width: `${lid.percentual}%`, background: lid.cor }} />
                        </div>
                      ) : (
                        <p className="mono mt-0.5 text-[8.5px] uppercase tracking-[0.08em] text-[#b3ac9a]">aguardando apuração</p>
                      )}
                    </div>
                    {tem && lid ? (
                      <div className="text-right">
                        <p className="mono text-[11.5px] tabular-nums" style={{ color: lid.cor }}>{formatPercent(lid.percentual)}</p>
                        <p className="mono text-[8.5px] tabular-nums text-[#9aa59d]">{formatNumber(p.votosValidos)} votos</p>
                      </div>
                    ) : (
                      <span className="mono text-[8.5px] uppercase tracking-[0.08em] text-[#b3ac9a]">—</span>
                    )}
                    <MapPin className="h-3 w-3 text-[#c3bda9] opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </li>
              );
            })}
            {lista.length === 0 && (
              <li className="mono py-8 text-center text-[10px] uppercase tracking-[0.1em] text-[#8a958d]">
                aguardando as primeiras localidades consulares
              </li>
            )}
          </ul>
          <p className="mono mt-3 border-t border-hair pt-2.5 text-[8.5px] uppercase tracking-[0.09em] text-[#8a958d]">
            {paises.length} países com arquivo publicado · clique para focar no mapa mundi
          </p>
        </div>
      </div>
    </section>
  );
}

function TrophyIfNeeded({ tem, fonte }: { tem: boolean; fonte?: PaisResumo['fonte'] }) {
  if (fonte === 'boletim' || fonte === 'misto') {
    return (
      <span className="rounded-full bg-amber/12 px-1.5 py-[1px] text-[7.5px] font-bold uppercase tracking-[0.1em] text-amber">
        {tem ? 'todos os BUs' : 'BU'}
      </span>
    );
  }
  if (!tem) return null;
  return <span className="rounded-full bg-green/12 px-1.5 py-[1px] text-[7.5px] font-bold uppercase tracking-[0.1em] text-green">final</span>;
}

export function ExteriorLegend({ exterior }: { exterior: ElectionResult | null }) {
  const g = (exterior?.candidatos || []).slice(0, 2);
  return (
    <span className="mono flex items-center gap-3 text-[9px] uppercase tracking-[0.1em] text-[#8a958d]">
      <Globe className="h-3 w-3" />
      {g.map(c => <span key={c.numero}>{c.nomeUrna} {formatPercent(c.percentual, 1)}</span>)}
    </span>
  );
}
