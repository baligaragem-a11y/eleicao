import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ElectionResult, FonteDados } from './types/tse';
import { aggregatePaises, fetchAllResults } from './services/tse';
import {
  cidadesMescladas, escolherFonte, exteriorPorBoletins, refreshExterior,
  type ExteriorSnapshot,
} from './services/exterior';
import { UFS, type UFInfo } from './data/ufs';
import { formatNumber, formatPercent } from './utils/format';
import BrazilMap, { MapLegend, type MapMode } from './components/BrazilMap';
import WorldMap from './components/WorldMap';
import RaceBar from './components/RaceBar';
import UFTable from './components/UFTable';
import ExteriorPanel from './components/ExteriorPanel';
import EvolutionChart, { type HistoryPoint } from './components/EvolutionChart';
import DataSourcePanel from './components/DataSourcePanel';
import { Header, Hero, ReadingPanel, StatsStrip, type Lector } from './components/Shell';
import { ArrowDown, Globe2, Layers } from 'lucide-react';

const REFRESH_INTERVAL = 15000;   // Brasil + 27 UFs + exterior agregado (totalização)
const EXTERIOR_INTERVAL = 60000;  // índice de boletins do exterior + cidades totalizadas
const MODES: Array<{ id: MapMode; label: string }> = [
  { id: 'vencedor', label: 'Vencedor' },
  { id: 'margem', label: 'Margem' },
  { id: 'volume', label: 'Votos apurados' },
];

export default function App() {
  const [nacional, setNacional] = useState<ElectionResult | null>(null);
  const [resultadosPorUF, setResultadosPorUF] = useState<Map<string, ElectionResult>>(new Map());
  const [exteriorOficial, setExteriorOficial] = useState<ElectionResult | null>(null);
  const [extSnap, setExtSnap] = useState<ExteriorSnapshot | null>(null);
  const [extErro, setExtErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [selectedUF, setSelectedUF] = useState<UFInfo | null>(null);
  const [selectedPais, setSelectedPais] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000);
  const [mode, setMode] = useState<MapMode>('vencedor');
  const [historico, setHistorico] = useState<HistoryPoint[]>([]);
  const historicoKey = useRef('');

  // ---------------- leitura da totalização oficial (Brasil, UFs, exterior agregado)
  const loadNucleo = useCallback(async (inicial = false) => {
    if (inicial) setLoading(true);
    const t0 = performance.now();
    try {
      const r = await fetchAllResults(UFS.map(u => ({ sigla: u.sigla, nome: u.nome })));
      setLatencyMs(performance.now() - t0);
      setNacional(r.nacional);
      setResultadosPorUF(r.porUF);
      setExteriorOficial(r.exterior);
      setLastUpdate(new Date());
      setError(r.nacional ? null : 'O TSE ainda não publicou os arquivos deste pleito.');
    } catch (e) {
      console.error(e);
      setError('Falha ao consultar o TSE — nova tentativa no próximo ciclo.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ---------------- boletins de urna do exterior (já computados antes das 17h)
  const loadExterior = useCallback(async () => {
    try {
      const snap = await refreshExterior(parcial => setExtSnap(parcial));
      setExtSnap(snap);
      setExtErro(null);
    } catch (e) {
      console.error(e);
      setExtErro('Não foi possível ler os boletins do exterior agora — nova tentativa em 60s.');
    }
  }, []);

  useEffect(() => { loadNucleo(true); }, [loadNucleo]);
  useEffect(() => { loadExterior(); }, [loadExterior]);

  useEffect(() => {
    if (!autoRefresh) return;
    const ciclo = setInterval(() => { loadNucleo(); setCountdown(REFRESH_INTERVAL / 1000); }, REFRESH_INTERVAL);
    const relogio = setInterval(() => setCountdown(c => (c > 1 ? c - 1 : REFRESH_INTERVAL / 1000)), 1000);
    const exteriorCiclo = setInterval(loadExterior, EXTERIOR_INTERVAL);
    return () => { clearInterval(ciclo); clearInterval(relogio); clearInterval(exteriorCiclo); };
  }, [autoRefresh, loadNucleo, loadExterior]);

  // ---------------- combinação das fontes (sempre a mais completa, sempre identificada)
  const base = useMemo(
    () => (nacional?.candidatos.length ? nacional.candidatos : exteriorOficial?.candidatos || []),
    [nacional, exteriorOficial],
  );
  const cidades = useMemo(
    () => (extSnap ? cidadesMescladas(extSnap, base) : new Map<string, ElectionResult>()),
    [extSnap, base],
  );
  const paises = useMemo(() => aggregatePaises(cidades), [cidades]);
  const exteriorBU = useMemo(
    () => (extSnap && extSnap.secoesLidas > 0 ? exteriorPorBoletins(extSnap, base, exteriorOficial) : null),
    [extSnap, base, exteriorOficial],
  );
  const exterior = useMemo(() => escolherFonte(exteriorOficial, exteriorBU), [exteriorOficial, exteriorBU]);

  const nacionalComVotos = !!nacional && nacional.votosValidos > 0;
  const placarEhExterior = !nacionalComVotos && !!exterior && exterior.votosValidos > 0;
  const placar = placarEhExterior ? exterior : nacional;
  const fontePlacar: FonteDados = placar?.fonte === 'boletim' ? 'boletim' : 'tse';
  const boletins = extSnap
    ? { lidos: extSnap.secoesLidas, publicados: extSnap.secoesComBU, total: extSnap.secoesTotal }
    : null;

  // Histórico: um ponto a cada mudança real do placar exibido (ordem fixa por número)
  const assinatura = placar
    ? `${fontePlacar}|${placarEhExterior ? 'zz' : 'br'}|${placar.votosValidos}|${placar.secoesTotalizadas}`
    : '';
  useEffect(() => {
    if (!placar || placar.votosValidos === 0 || placar.candidatos.length < 2) return;
    const [a, b] = [...placar.candidatos.slice(0, 2)].sort((x, y) => x.numero - y.numero);
    const key = `${fontePlacar}-${placarEhExterior ? 'zz' : 'br'}-${a.numero}-${b.numero}`;
    if (historicoKey.current !== key) { historicoKey.current = key; setHistorico([]); }
    setHistorico(prev => [...prev.slice(-179), {
      hora: new Date().toTimeString().slice(0, 8),
      apurado: placar.percentualSecoes,
      pctA: a.percentual,
      pctB: b.percentual,
    }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura]);

  const leitura = useMemo<Lector[]>(() => {
    const [n1, n2] = [...(nacional?.candidatos || []).slice(0, 2)].sort((x, y) => x.numero - y.numero);
    return [...resultadosPorUF.values()]
      .filter(r => r.votosValidos > 0)
      .map(r => ({
        sigla: r.abrangencia.toUpperCase(),
        nome: r.nomeLocal,
        pctA: r.candidatos.find(c => c.numero === n1?.numero)?.percentual ?? 0,
        pctB: r.candidatos.find(c => c.numero === n2?.numero)?.percentual ?? 0,
        valido: r.votosValidos,
      }))
      .sort((a, b) => b.valido - a.valido)
      .slice(0, 6);
  }, [resultadosPorUF, nacional]);

  const decisivos = useMemo<Lector[]>(() => [...leitura]
    .filter(r => r.pctA > 0 && r.pctB > 0)
    .sort((a, b) => Math.abs(a.pctA - a.pctB) - Math.abs(b.pctA - b.pctB))
    .slice(0, 5), [leitura]);

  const ufsComVotos = useMemo(
    () => UFS.filter(u => (resultadosPorUF.get(u.sigla)?.votosValidos || 0) > 0),
    [resultadosPorUF],
  );

  const navegar = useCallback((id: string) => {
    if (id === 'topo') window.scrollTo({ top: 0, behavior: 'smooth' });
    else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const resultadoAtual = selectedUF ? resultadosPorUF.get(selectedUF.sigla) || null : placar;
  const nomeLocal = selectedUF
    ? `${selectedUF.nome} (${selectedUF.sigla})`
    : placarEhExterior ? 'Votos já computados no exterior' : 'Brasil';
  const fonteDisputa: FonteDados = selectedUF ? 'tse' : fontePlacar;
  const candidatosOrdenados = [...(placar?.candidatos || base).slice(0, 2)].sort((x, y) => x.numero - y.numero);
  const paisesComVotos = paises.filter(p => p.votosValidos > 0).length;

  return (
    <div id="topo" className="min-h-screen pb-16">
      <Header
        live={!loading}
        lastUpdate={lastUpdate}
        paused={!autoRefresh}
        onTogglePause={() => setAutoRefresh(v => !v)}
        onRefresh={() => { loadNucleo(); loadExterior(); }}
        onSources={() => navegar('fontes')}
        onNavigate={navegar}
      />

      <main>
        <Hero
          placar={placar}
          fonte={fontePlacar}
          exterior={exterior}
          paises={paises}
          lastUpdate={lastUpdate}
          ufsRespondendo={ufsComVotos.length}
          boletins={boletins}
          onExplore={() => navegar('mapa')}
          onTable={() => navegar('estados')}
          onSources={() => navegar('fontes')}
          onExterior={() => navegar('mundo')}
        />

        <StatsStrip
          nacional={nacional}
          placar={placar}
          fonte={fontePlacar}
          porUfComVotos={ufsComVotos.length}
          decisivos={decisivos}
          exterior={exterior}
          paises={paises}
          boletins={boletins}
        />

        {/* ===== Disputa: uma barra por candidato ===== */}
        <section id="disputa" className="mx-auto mt-6 max-w-[1400px] scroll-mt-24 px-4 sm:px-8">
          <RaceBar
            resultado={resultadoAtual}
            local={nomeLocal}
            loading={loading && !resultadoAtual}
            fonte={fonteDisputa}
            boletinsLidos={boletins?.lidos || 0}
          />
        </section>

        {/* ===== Mapa do Brasil ===== */}
        <section id="mapa" className="mx-auto mt-6 max-w-[1400px] scroll-mt-24 px-4 sm:px-8">
          <div className="panel overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hair px-5 py-4">
              <div>
                <div className="eyebrow flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded bg-deep text-[9px] text-[#9fd9c0]">★</span>
                  01 · Vencedor por unidade federativa
                </div>
                <h2 className="display mt-1.5 text-[clamp(28px,3.4vw,42px)] leading-none text-ink">O mapa da decisão</h2>
                <p className="mt-2 max-w-[540px] text-[12px] leading-relaxed text-inksoft">
                  Cor = candidato à frente no estado; saturação = margem. Cada UF usa o número da totalização
                  oficial do TSE. {selectedUF ? `Filtrado em ${selectedUF.nome}.` : 'Clique num estado para focar.'}
                </p>
              </div>
              <div className="flex flex-col items-start gap-2.5 sm:items-end">
                <div className="flex gap-1.5">
                  {MODES.map(m => (
                    <button key={m.id} onClick={() => setMode(m.id)} className={`chip ${mode === m.id ? 'chip-on' : ''}`}>{m.label}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {selectedUF && (
                    <button onClick={() => setSelectedUF(null)} className="mono text-[9px] uppercase tracking-[0.1em] text-[#8a958d] underline decoration-hair underline-offset-2 hover:text-green">
                      limpar foco
                    </button>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-hair bg-panel px-2.5 py-1">
                    <span className="live-dot" style={autoRefresh ? undefined : { animation: 'none', background: '#c26024' }} />
                    <span className="mono text-[9px] uppercase tracking-[0.13em] text-[#3f7d68]">
                      {autoRefresh ? `próxima em ${countdown}s` : 'auto pausado'}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {!nacionalComVotos && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair bg-amber/[0.07] px-5 py-3">
                <p className="text-[12px] text-inksoft">
                  <strong className="text-ink">Os estados ainda não têm votos divulgados:</strong> a totalização do TSE no Brasil
                  começa às 17h (Brasília). {exterior && exterior.votosValidos > 0
                    ? `Já há ${formatNumber(exterior.votosValidos)} votos válidos computados no exterior, em ${paisesComVotos} países.`
                    : ''}
                </p>
                {exterior && exterior.votosValidos > 0 && (
                  <button onClick={() => navegar('mundo')} className="btn btn-dark !py-1.5 !text-[11px]">
                    Ver o exterior <ArrowDown className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_330px] lg:p-5">
              <div>
                <BrazilMap
                  resultadosPorUF={resultadosPorUF}
                  onSelectUF={setSelectedUF}
                  selectedUF={selectedUF?.sigla || null}
                  mode={mode}
                />
                <div className="mt-3.5">
                  <MapLegend candidatos={candidatosOrdenados} decisivos={ufsComVotos} />
                </div>
              </div>
              <ReadingPanel nacional={nacional} leitura={leitura} decisivos={decisivos} onOpenTable={() => navegar('estados')} />
            </div>
          </div>
        </section>

        {/* ===== Tabela de estados ===== */}
        <div className="mx-auto mt-6 max-w-[1400px] px-4 sm:px-8">
          <UFTable
            resultadosPorUF={resultadosPorUF}
            exterior={exterior}
            nacional={nacional}
            onSelectUF={setSelectedUF}
            selectedUF={selectedUF?.sigla || null}
          />
        </div>

        {/* ===== Mundo ===== */}
        <section id="mundo" className="mx-auto mt-6 max-w-[1400px] scroll-mt-24 px-4 sm:px-8">
          <div className="panel overflow-hidden">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hair px-5 py-4">
              <div>
                <div className="eyebrow flex items-center gap-1.5"><Globe2 className="h-3 w-3" />Mapa mundi · {paisesComVotos} de {paises.length} países com votos</div>
                <h2 className="display mt-1.5 text-[clamp(24px,2.8vw,34px)] leading-none text-ink">O voto brasileiro no mundo</h2>
                <p className="mt-2 max-w-[560px] text-[12px] leading-relaxed text-inksoft">
                  {exterior?.fonte === 'boletim'
                    ? `Soma dos boletins de urna já publicados pelo TSE: ${formatNumber(boletins?.lidos || 0)} de ${formatNumber(boletins?.total || 0)} urnas do exterior. A totalização oficial substitui esta prévia assim que for divulgada.`
                    : 'Totalização oficial do TSE por localidade consular, somada por país.'}
                </p>
              </div>
              <span className="mono text-[9px] uppercase tracking-[0.1em] text-[#8a958d]">
                círculos = volume de votos no país · clique para focar
              </span>
            </div>
            <div className="p-4">
              <WorldMap paises={paises} selectedPais={selectedPais} onSelectPais={setSelectedPais} />
              <div className="mono mt-3 flex flex-wrap items-center justify-between gap-2 text-[8.5px] uppercase tracking-[0.09em] text-[#8a958d]">
                <span className="flex items-center gap-3">
                  {candidatosOrdenados.map(c => (
                    <span key={c.numero} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-[3px]" style={{ background: c.cor }} />{c.nomeUrna}
                    </span>
                  ))}
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-[3px] border border-[#d6d0bf] bg-[#e9e4d6]" />sem votos ainda</span>
                </span>
                <span>fonte: boletins de urna e totalização por localidade (UF ZZ) · TSE</span>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto mt-6 max-w-[1400px] px-4 sm:px-8">
          <ExteriorPanel
            exterior={exterior}
            paises={paises}
            selectedPais={selectedPais}
            onSelectPais={setSelectedPais}
            brasilComecou={nacionalComVotos}
            boletins={extSnap}
            erro={extErro}
          />
        </div>

        {/* ===== Comparativo + fontes ===== */}
        <section id="fontes" className="mx-auto mt-6 max-w-[1400px] scroll-mt-24 space-y-5 px-4 sm:px-8">
          <EvolutionChart
            historico={historico}
            nomeA={candidatosOrdenados[0]?.nomeUrna || 'Candidato 1'}
            nomeB={candidatosOrdenados[1]?.nomeUrna || 'Candidato 2'}
            corA={candidatosOrdenados[0]?.cor || '#c0392b'}
            corB={candidatosOrdenados[1]?.cor || '#2f6fb5'}
            fonte={fontePlacar}
          />

          <DataSourcePanel
            nacional={nacional}
            lastUpdate={lastUpdate}
            latencyMs={latencyMs}
            ufsRespondendo={ufsComVotos.length}
            cidadesExterior={extSnap ? extSnap.cidades.filter(c => c.secoesLidas > 0 || c.oficialSecoes > 0).length : 0}
            error={error}
            boletins={extSnap}
          />

          <div className="grid gap-px overflow-hidden rounded-[18px] border border-hair bg-hair lg:grid-cols-3">
            {[
              { t: 'Duas fontes oficiais, nunca misturadas', d: `Totalização do TSE (arquivos EA20) para Brasil, UFs e exterior; e, antes dela, a soma dos boletins de urna que o TSE publica por seção. Cada número indica de qual fonte veio. ${formatPercent(nacional?.percentualSecoes || 0, 1)} das urnas do Brasil totalizadas agora.` },
              { t: 'Cada boletim é conferido', d: 'O boletim (arquivo binário assinado da urna) é decodificado no navegador; cidade, seção e eleição 6258 precisam conferir, e votos + brancos + nulos precisam somar o comparecimento — senão a seção é descartada e sinalizada.' },
              { t: 'Por que o exterior aparece cedo', d: 'Cada país fecha no horário local. Oceania e Ásia encerram de madrugada (Brasília) e seus boletins são publicados na hora; a totalização oficial de tudo começa às 17h.' },
            ].map((c, i) => (
              <div key={c.t} className="bg-panel p-5">
                <p className="mono text-[8px] uppercase tracking-[0.14em] text-[#8a958d]">{String(i + 1).padStart(2, '0')} · metodologia</p>
                <h3 className="display mt-2 text-[21px] leading-tight text-ink">{c.t}</h3>
                <p className="mt-2 text-[11.5px] leading-relaxed text-inksoft">{c.d}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-hair bg-[#f6f3ea] px-5 py-4">
            <p className="mono flex items-center gap-2 text-[9.5px] uppercase tracking-[0.09em] text-[#8a958d]">
              <Layers className="h-3.5 w-3.5 text-green" />
              {formatNumber(placar?.votosValidos || 0)} votos válidos {fontePlacar === 'boletim' ? 'nos boletins' : 'totalizados'} · {ufsComVotos.length}/27 UFs · {paisesComVotos} países
            </p>
            <a href="https://resultados.tse.jus.br" target="_blank" rel="noreferrer" className="btn btn-ghost !py-1.5 !text-[11px]">
              Abrir resultado oficial do TSE
            </a>
          </div>
        </section>
      </main>

      <footer className="mt-12 border-t border-hair bg-panel">
        <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-8 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-[10px] bg-deep text-[#9fd9c1]">
                <Globe2 className="h-4 w-4" strokeWidth={1.6} />
                <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-amber text-[7px] text-white">★</span>
              </span>
              <span className="display text-[21px] leading-none text-ink">Voto Global</span>
            </div>
            <p className="mt-3 max-w-[380px] text-[11.5px] leading-relaxed text-inksoft">
              Painel independente de leitura da apuração presidencial. Candidatos, números e percentuais são os
              publicados pelo TSE — este site não produz estimativas nem boca de urna.
            </p>
          </div>
          <div>
            <p className="eyebrow">Navegação</p>
            <ul className="mt-2.5 space-y-1.5 text-[12px] text-inksoft">
              {[['panorama', 'Panorama'], ['disputa', 'Disputa presidencial'], ['mapa', 'Mapa por estado'], ['estados', 'Tabela de estados'], ['mundo', 'Mapa mundi'], ['exterior', 'Voto no exterior'], ['fontes', 'Fontes e método']].map(([id, label]) => (
                <li key={id}><button onClick={() => navegar(id)} className="transition-colors hover:text-green">{label}</button></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Fontes</p>
            <ul className="mono mt-2.5 space-y-1.5 text-[10.5px] text-inksoft">
              <li>Eleição 6258 · 2º turno federal</li>
              <li>Cargo 0001 · Presidente</li>
              <li>EA20 (totalização) · boletins de urna (pleito 3221)</li>
              <li>Malhas: IBGE e Natural Earth</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-hair">
          <div className="mono mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-4 py-3 text-[8.5px] uppercase tracking-[0.09em] text-[#8a958d] sm:px-8">
            <span>© 2026 Voto Global · painel independente, sem vínculo institucional com o TSE</span>
            <span>sem nome, e-mail ou IP armazenado pelo contador · sessão anônima expira em 75s</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
