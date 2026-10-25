import { useMemo, useState } from 'react';
import type { CandidateResult, ElectionResult } from '../types/tse';
import { UFS, type UFInfo, REGIOES, REGIAO_CORES } from '../data/ufs';
import { formatNumber, formatPercent } from '../utils/format';
import { withAlpha } from '../theme';
import { AlertTriangle, ArrowUpDown, CheckCircle2, Download, Globe, Search, Trophy } from 'lucide-react';

interface UFTableProps {
  resultadosPorUF: Map<string, ElectionResult>;
  exterior: ElectionResult | null;
  nacional: ElectionResult | null;
  onSelectUF: (uf: UFInfo | null) => void;
  selectedUF: string | null;
}

interface Row {
  sigla: string; nome: string; regiao: string;
  porNumero: Map<number, CandidateResult>;
  lider: CandidateResult | null;
  validos: number; margem: number; apurado: number;
  comparecimento: number; eleitorado: number; secoes: string;
  somaNominal: number;
  votosConferem: boolean;
}

type SortKey = 'nome' | 'validos' | 'apurado' | 'margem' | 'comparecimento' | 'eleitorado' | 'lider';

const COL_TITLES: Record<SortKey, string> = {
  nome: 'Unidade federativa', validos: 'Votos válidos', apurado: 'Apurado', margem: 'Margem',
  comparecimento: 'Comparec.', eleitorado: 'Eleitorado', lider: 'Líder',
};

export default function UFTable({ resultadosPorUF, exterior, nacional, onSelectUF, selectedUF }: UFTableProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('eleitorado');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [regiao, setRegiao] = useState('all');
  const [soComVotos, setSoComVotos] = useState(false);

  const cols = useMemo(() => {
    const top2 = (nacional?.candidatos || []).slice(0, 2);
    return top2.length >= 2 ? [...top2].sort((a, b) => a.numero - b.numero) : [];
  }, [nacional]);

  const rows = useMemo<Row[]>(() => UFS.map(uf => {
    const r = resultadosPorUF.get(uf.sigla);
    const porNumero = new Map<number, CandidateResult>();
    for (const c of r?.candidatos || []) porNumero.set(c.numero, c);
    const lider = r?.candidatos[0] || null;
    const seg = r?.candidatos[1] || null;
    const somaNominal = (r?.candidatos || []).reduce((sum, candidate) => sum + candidate.votos, 0);
    return {
      sigla: uf.sigla, nome: uf.nome, regiao: uf.regiao, porNumero, lider,
      validos: r?.votosValidos || 0,
      margem: lider && seg ? Math.abs(lider.percentual - seg.percentual) : 0,
      apurado: r?.percentualSecoes || 0,
      comparecimento: r?.percentualComparecimento || 0,
      eleitorado: r?.eleitoradoTotal || 0,
      secoes: `${r?.secoesTotalizadas || 0}/${r?.secoesTotal || 0}`,
      somaNominal,
      votosConferem: !!r && r.votosValidos > 0 && somaNominal === r.votosValidos,
    };
  }), [resultadosPorUF]);

  const maxPct = useMemo(() => {
    let m = 0;
    for (const r of rows) for (const c of r.porNumero.values()) m = Math.max(m, c.percentual);
    return m || 100;
  }, [rows]);

  const visiveis = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter(r => {
      if (q && !(r.nome.toLowerCase().includes(q) || r.sigla.toLowerCase().includes(q) || r.regiao.toLowerCase().includes(q))) return false;
      if (regiao !== 'all' && r.regiao !== regiao) return false;
      if (soComVotos && r.validos === 0) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      let c = 0;
      switch (sortKey) {
        case 'nome': c = a.nome.localeCompare(b.nome); break;
        case 'validos': c = a.validos - b.validos; break;
        case 'apurado': c = a.apurado - b.apurado; break;
        case 'margem': c = a.margem - b.margem; break;
        case 'comparecimento': c = a.comparecimento - b.comparecimento; break;
        case 'eleitorado': c = a.eleitorado - b.eleitorado; break;
        case 'lider': c = (a.lider?.numero || 0) - (b.lider?.numero || 0); break;
      }
      return sortDir === 'asc' ? c : -c;
    });
  }, [rows, search, regiao, soComVotos, sortKey, sortDir]);

  function sort(k: SortKey) {
    if (k === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'nome' ? 'asc' : 'desc'); }
  }

  function csv() {
    const head = ['UF', 'Estado', 'Região', ...cols.flatMap(c => [`${c.numero} ${c.nomeUrna} (votos)`, `${c.numero} %`]),
      'Votos válidos', 'Margem (p.p.)', 'Líder', 'Seções totalizadas', 'Seções totais', 'Eleitorado', '% comparecimento'];
    const body = visiveis.map(r => [
      r.sigla, r.nome, r.regiao,
      ...cols.flatMap(c => {
        const cand = r.porNumero.get(c.numero);
        return [String(cand?.votos ?? 0), (cand?.percentual ?? 0).toFixed(2).replace('.', ',')];
      }),
      String(r.validos), r.margem.toFixed(2).replace('.', ','), r.lider?.nomeUrna ?? '',
      ...r.secoes.split('/'), String(r.eleitorado), r.comparecimento.toFixed(2).replace('.', ','),
    ]);
    if (exterior) {
      body.push(['ZZ', 'Exterior', 'Exterior',
        ...cols.flatMap(c => {
          const cand = exterior.candidatos.find(x => x.numero === c.numero);
          return [String(cand?.votos ?? 0), (cand?.percentual ?? 0).toFixed(2).replace('.', ',')];
        }),
        String(exterior.votosValidos), '—', exterior.candidatos[0]?.nomeUrna ?? '',
        String(exterior.secoesTotalizadas), String(exterior.secoesTotal), String(exterior.eleitoradoTotal),
        exterior.percentualComparecimento.toFixed(2).replace('.', ',')]);
    }
    const url = URL.createObjectURL(new Blob(['\ufeff' + [head, ...body].map(l => l.join(';')).join('\n')], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'voto-global-ufs.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const comVotos = rows.filter(r => r.validos > 0).length;

  const Th = ({ k, align = 'left', children }: { k?: SortKey; align?: 'left' | 'right' | 'center'; children?: React.ReactNode }) => (
    <th className={`px-3 py-2.5 ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}>
      {k ? (
        <button onClick={() => sort(k)} className={`mono inline-flex items-center gap-1 text-[8.5px] uppercase tracking-[0.12em] transition-colors ${sortKey === k ? 'text-ink' : 'text-[#8a958d] hover:text-inksoft'}`}>
          {COL_TITLES[k]}<ArrowUpDown className={`h-2.5 w-2.5 ${sortKey === k ? '' : 'opacity-30'} ${sortKey === k && sortDir === 'asc' ? 'rotate-180' : ''}`} />
        </button>
      ) : children}
    </th>
  );

  const Cel = ({ cand, destaque }: { cand?: CandidateResult; destaque: boolean }) => {
    if (!cand || cand.votos === 0) return <span className="mono text-[10px] text-[#c3bda9]">—</span>;
    return (
      <div className="min-w-[104px]">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`mono text-[12.5px] font-medium tabular-nums ${destaque ? '' : 'text-inksoft'}`} style={destaque ? { color: cand.cor } : undefined}>
            {formatPercent(cand.percentual)}
          </span>
          {destaque && <Trophy className="h-2.5 w-2.5" style={{ color: withAlpha(cand.cor, 0.8) }} />}
        </div>
        <div className="mt-1 h-[5px] overflow-hidden rounded-full" style={{ background: '#e9e4d6' }}>
          <div className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max((cand.percentual / maxPct) * 100, 2)}%`, background: cand.cor }} />
        </div>
        <p className="mono mt-0.5 text-[9px] tabular-nums text-[#9aa59d]">{formatNumber(cand.votos)}</p>
      </div>
    );
  };

  return (
    <section id="estados" className="panel scroll-mt-24 overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hair px-5 py-4">
        <div>
          <div className="eyebrow">02 · Votação nominal por unidade federativa</div>
          <h2 className="display mt-1.5 text-[clamp(26px,3vw,38px)] leading-none text-ink">Tabela de estados</h2>
          <p className="mt-2 max-w-[560px] text-[12px] leading-relaxed text-inksoft">
            Uma coluna por candidato, com votos nominais e percentual sobre os votos válidos de cada estado.
            Ordene por qualquer coluna, filtre por região ou exporte o CSV.
          </p>
          <p className="mono mt-2 flex items-center gap-1 text-[9px] uppercase tracking-[0.08em] text-green">
            <CheckCircle2 className="h-3 w-3" /> Conferência: soma dos votos dos candidatos × votos válidos do TSE
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono text-[9px] uppercase tracking-[0.1em] text-[#8a958d]">{comVotos}/27 com votos</span>
          <button onClick={() => setSoComVotos(v => !v)} className={`chip ${soComVotos ? 'chip-on' : ''}`}>só com votos</button>
          <button onClick={csv} className="btn btn-ghost !py-1.5 !text-[11px]"><Download className="h-3 w-3" /> CSV</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-hair bg-[#f6f3ea] px-5 py-3">
        <div className="relative min-w-[190px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#9aa59d]" />
          <input
            value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar estado, sigla ou região"
            className="h-8 w-full rounded-full border border-hair bg-panel pl-8 pr-3 text-[11.5px] text-ink outline-none transition-colors placeholder:text-[#a8a291] focus:border-green"
          />
        </div>
        <button onClick={() => setRegiao('all')} className={`chip ${regiao === 'all' ? 'chip-on' : ''}`}>Todas</button>
        {REGIOES.map(r => (
          <button key={r} onClick={() => setRegiao(regiao === r ? 'all' : r)} className={`chip ${regiao === r ? 'chip-on' : ''}`}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: REGIAO_CORES[r] }} />{r}
          </button>
        ))}
        <span className="mono ml-auto text-[9px] uppercase tracking-[0.1em] text-[#8a958d]">{visiveis.length} linhas</span>
      </div>

      <div className="scroll-thin max-h-[560px] overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[#f6f3ea]/95 backdrop-blur">
            <tr className="border-b border-hair">
              <Th k="nome" />
              {cols.map(c => (
                <th key={c.numero} className="px-3 py-2.5">
                  <span className="flex items-center gap-1.5">
                    <span className="mono flex h-4 min-w-[26px] items-center justify-center rounded px-1 text-[8.5px] font-semibold text-white" style={{ background: c.cor }}>{c.numero}</span>
                    <span className="mono text-[8.5px] uppercase tracking-[0.12em] text-inksoft">{c.nomeUrna}</span>
                  </span>
                </th>
              ))}
              <Th k="validos" align="right" />
              <Th k="margem" align="right" />
              <Th k="lider" align="center" />
              <Th k="apurado" align="right" />
              <Th k="eleitorado" align="right" />
              <Th k="comparecimento" align="right" />
            </tr>
          </thead>
          <tbody>
            {visiveis.map(r => {
              const sel = selectedUF === r.sigla;
              return (
                <tr key={r.sigla}
                  onClick={() => onSelectUF(sel ? null : UFS.find(u => u.sigla === r.sigla) ?? null)}
                  className={`cursor-pointer border-b border-hair/70 transition-colors last:border-0 ${sel ? 'bg-green/[0.07]' : 'hover:bg-white'}`}>
                  <td className="relative px-3 py-2">
                    {r.lider && r.validos > 0 && <span className="absolute left-0 top-0 h-full w-[3px]" style={{ background: r.lider.cor }} />}
                    <div className="flex items-center gap-2 pl-1.5">
                      <span className="flex h-[18px] w-[26px] flex-shrink-0 items-center justify-center rounded-[3px] border border-hair bg-[#f2efe6] mono text-[8.5px] font-medium text-inksoft">{r.sigla}</span>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold leading-tight text-ink">{r.nome}</p>
                        <p className="mono text-[8px] uppercase tracking-[0.08em] text-[#9aa59d]">{r.regiao}</p>
                      </div>
                    </div>
                  </td>
                  {cols.map(c => (
                    <td key={c.numero} className="px-3 py-2"><Cel cand={r.porNumero.get(c.numero)} destaque={r.lider?.numero === c.numero} /></td>
                  ))}
                  <td
                    className="px-3 py-2 text-right mono text-[11px] tabular-nums text-ink"
                    title={r.validos > 0
                      ? r.votosConferem
                        ? `Conferido: ${formatNumber(r.somaNominal)} votos nominais = ${formatNumber(r.validos)} votos válidos publicados pelo TSE.`
                        : `Atenção: candidatos somam ${formatNumber(r.somaNominal)}, mas o TSE publica ${formatNumber(r.validos)} votos válidos.`
                      : 'Aguardando votos publicados pelo TSE.'}
                  >
                    {r.validos ? (
                      <span className="inline-flex items-center justify-end gap-1">
                        {formatNumber(r.validos)}
                        {r.votosConferem
                          ? <CheckCircle2 aria-label="Soma dos votos conferida" className="h-3 w-3 text-green" />
                          : <AlertTriangle aria-label="Diferença na soma dos votos" className="h-3 w-3 text-amber" />}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right mono text-[10px] tabular-nums">
                    {r.margem > 0
                      ? <span className={r.margem < 3 ? 'text-amber' : r.margem > 25 ? 'text-green' : 'text-inksoft'}>{formatPercent(r.margem)}</span>
                      : <span className="text-[#c3bda9]">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.lider && r.validos > 0
                      ? <span className="mono inline-flex items-center rounded px-1.5 py-[2px] text-[8.5px] font-semibold" style={{ background: withAlpha(r.lider.cor, 0.12), color: r.lider.cor }}>{r.lider.numero}</span>
                      : <span className="text-[#c3bda9]">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="h-1.5 w-14 overflow-hidden rounded-full" style={{ background: '#e9e4d6' }}>
                        <div className="h-full rounded-full bg-green transition-[width] duration-700" style={{ width: `${Math.min(r.apurado, 100)}%` }} />
                      </div>
                      <span className="mono w-11 text-right text-[9.5px] tabular-nums text-inksoft">{formatPercent(r.apurado, 1)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right mono text-[10px] tabular-nums text-inksoft">{r.eleitorado ? formatNumber(r.eleitorado) : '—'}</td>
                  <td className="px-3 py-2 text-right mono text-[10px] tabular-nums text-inksoft">{r.comparecimento ? formatPercent(r.comparecimento, 1) : '—'}</td>
                </tr>
              );
            })}
            {visiveis.length === 0 && (
              <tr><td colSpan={cols.length + 7} className="px-4 py-10 text-center text-[12px] text-inksoft">Nenhum estado encontrado com esses filtros.</td></tr>
            )}
          </tbody>

          <tfoot>
            {exterior && (
              <tr className="border-t border-hair bg-[#f6f3ea] transition-colors hover:bg-white" onClick={() => onSelectUF(null)}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-green" />
                    <div>
                      <p className="text-[12px] font-semibold text-ink">Exterior</p>
                      <p className="mono text-[8px] uppercase tracking-[0.08em] text-[#9aa59d]">
                        ZZ · {exterior.fonte === 'boletim'
                          ? <span className="rounded bg-amber/15 px-1 text-amber">boletins · {formatNumber(exterior.secoesTotalizadas)} urnas</span>
                          : 'totalizado'}
                      </p>
                    </div>
                  </div>
                </td>
                {cols.map(c => (
                  <td key={c.numero} className="px-3 py-2"><Cel cand={exterior.candidatos.find(x => x.numero === c.numero)} destaque={exterior.candidatos[0]?.numero === c.numero} /></td>
                ))}
                <td className="px-3 py-2 text-right mono text-[11px] tabular-nums text-ink">{formatNumber(exterior.votosValidos)}</td>
                <td className="px-3 py-2 text-right mono text-[10px] tabular-nums text-inksoft">
                  {exterior.candidatos.length >= 2 ? formatPercent(Math.abs(exterior.candidatos[0].percentual - exterior.candidatos[1].percentual)) : '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  {exterior.candidatos[0]?.votos ? (
                    <span className="mono inline-flex items-center rounded px-1.5 py-[2px] text-[8.5px] font-semibold"
                      style={{ background: withAlpha(exterior.candidatos[0].cor, 0.12), color: exterior.candidatos[0].cor }}>
                      {exterior.candidatos[0].numero}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-right mono text-[9.5px] tabular-nums text-inksoft">{formatPercent(exterior.percentualSecoes, 1)}</td>
                <td className="px-3 py-2 text-right mono text-[10px] tabular-nums text-inksoft">{formatNumber(exterior.eleitoradoTotal)}</td>
                <td className="px-3 py-2 text-right mono text-[10px] tabular-nums text-inksoft">{formatPercent(exterior.percentualComparecimento, 1)}</td>
              </tr>
            )}
            {nacional && (
              <tr className="border-t-2 border-[#d8d2c2] bg-[#efeadd]">
                <td className="px-3 py-2.5">
                  <p className="display text-[17px] leading-none text-ink">Total apurado</p>
                  <p className="mono mt-1 text-[8px] uppercase tracking-[0.09em] text-[#8a958d]">
                    {formatNumber(nacional.secoesTotalizadas)}/{formatNumber(nacional.secoesTotal)} seções · {formatPercent(nacional.percentualSecoes, 1)}
                  </p>
                </td>
                {[...nacional.candidatos].slice(0, 2).sort((a, b) => a.numero - b.numero).map(c => (
                  <td key={c.numero} className="px-3 py-2.5">
                    <div className="flex h-7 items-center gap-2 rounded-lg px-2" style={{ background: withAlpha(c.cor, 0.1), border: `1px solid ${withAlpha(c.cor, 0.25)}` }}>
                      <span className="mono text-[14px] font-medium tabular-nums" style={{ color: c.cor }}>{formatPercent(c.percentual)}</span>
                      <span className="mono text-[9px] tabular-nums text-inksoft">{formatNumber(c.votos)}</span>
                    </div>
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right mono text-[12px] font-medium tabular-nums text-ink">{formatNumber(nacional.votosValidos)}</td>
                <td className="px-3 py-2.5 text-right mono text-[10px] tabular-nums text-inksoft">
                  {nacional.candidatos.length >= 2 ? formatPercent(Math.abs(nacional.candidatos[0].percentual - nacional.candidatos[1].percentual)) : '—'}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`mono rounded px-1.5 py-[2px] text-[8px] uppercase ${nacional.totalizacaoFinal ? 'bg-green/15 text-green' : 'bg-[#e2ddce] text-[#8a958d]'}`}>
                    {nacional.totalizacaoFinal ? 'final' : 'parcial'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right mono text-[9.5px] tabular-nums text-green">{formatPercent(nacional.percentualSecoes, 1)}</td>
                <td className="px-3 py-2.5 text-right mono text-[10px] tabular-nums text-ink">{formatNumber(nacional.eleitoradoTotal)}</td>
                <td className="px-3 py-2.5 text-right mono text-[10px] tabular-nums text-ink">{formatPercent(nacional.percentualComparecimento, 1)}</td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      <div className="mono flex flex-wrap items-center justify-between gap-2 border-t border-hair bg-[#f6f3ea] px-5 py-2.5 text-[8.5px] uppercase tracking-[0.09em] text-[#8a958d]">
        <span>clique numa linha para focar o estado no mapa</span>
        <span>votos nominais e % sobre votos válidos · fonte TSE (EA20)</span>
      </div>
    </section>
  );
}
