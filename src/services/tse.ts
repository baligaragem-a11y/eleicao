import type { TseResultadoUnificado, ElectionResult, CandidateResult, PaisResumo } from '../types/tse';
import { PAIS_INFO, CIDADE_PAIS } from '../data/paises';

// Configuração da eleição 2º turno presidencial 2026
export const TSE_BASE = 'https://resultados.tse.jus.br/oficial';
export const CICLO = 'ele2026';
export const ELEICAO_2TURNO = 6258; // 2º turno federal (Presidente)
export const CARGO_PRESIDENTE = '0001';
export const ELE6 = String(ELEICAO_2TURNO).padStart(6, '0');

// Mapeamento de cores por número do candidato (definido pelo TSE / partidos)
const CORES_CANDIDATOS: Record<number, string> = {
  13: '#dc2626', // Lula - PT - vermelho
  22: '#2563eb', // Bolsonaro - PL - azul
  15: '#eab308', // MDB - amarelo
  45: '#0891b2', // PSDB - azul claro
  40: '#f97316', // PSB - laranja
  65: '#dc2626', // PCdoB - vermelho
  50: '#16a34a', // PSOL - verde amarelado
  12: '#84cc16', // PDT - verde lima
  55: '#a16207', // PSD - dourado
  10: '#b91c1c', // Republicanos - vermelho escuro
  44: '#7c3aed', // União - roxo
  25: '#0d9488', // DEM - teal
  17: '#ca8a04', // PSL - amarelo escuro
  51: '#be185d', // PL do patriota - rosa
  70: '#059669', // PTB - verde
  30: '#ea580c', // NOVO - laranja
  19: '#65a30d', // PODE - verde olive
  77: '#9333ea', // SOLIDARIEDADE - roxo claro
  80: '#c026d3', // PSDB outro - magenta
  90: '#4b5563', // UST - cinza
  36: '#0284c7', // AGIR - azul
  14: '#15803d', // PTB verde
  33: '#ea580c', // PMN - laranja
  54: '#7c2d12', // PCO - marrom
  16: '#991b1b', // PSTU - vermelho escuro
  21: '#166534', // PCB - verde escuro
  29: '#334155', // PCO outro
  95: '#71717a', // nan - cinza
  96: '#71717a',
};

export function getCorCandidato(numero: number): string {
  return CORES_CANDIDATOS[numero] || `hsl(${(numero * 47) % 360}, 70%, 50%)`;
}

export function parseNumero(v: string | number | undefined): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') return v;
  return parseFloat(v.replace(',', '.')) || 0;
}

export function parseInteiro(v: string | number | undefined): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') return Math.round(v);
  return parseInt(v.replace(/\./g, '').replace(',', ''), 10) || 0;
}

// Monta a URL do arquivo de resultado unificado
export function buildUrl(uf: string): string {
  return `${TSE_BASE}/${CICLO}/${ELEICAO_2TURNO}/dados/${uf}/${uf}-c${CARGO_PRESIDENTE}-e${ELE6}-u.json`;
}

export function buildUrlCidade(cd: string): string {
  return `${TSE_BASE}/${CICLO}/${ELEICAO_2TURNO}/dados/zz/zz${cd}-c${CARGO_PRESIDENTE}-e${ELE6}-u.json`;
}

export interface CidadeExterior {
  cd: string;
  nm: string;
}

let cidadesCache: CidadeExterior[] | null = null;

export async function fetchCidadesExterior(): Promise<CidadeExterior[]> {
  if (cidadesCache) return cidadesCache;
  try {
    const res = await fetch(`${TSE_BASE}/${CICLO}/${ELEICAO_2TURNO}/config/mun-e${ELE6}-cm.json`, {
      cache: 'force-cache',
    });
    if (!res.ok) return [];
    const json = await res.json();
    const abr = (json.abr || []).find((a: { cd?: string }) => a.cd === 'zz');
    const mus = (abr?.mu || []) as Array<{ cd: string; nm: string }>;
    cidadesCache = mus.map(m => ({ cd: String(m.cd), nm: m.nm }));
    return cidadesCache;
  } catch {
    return [];
  }
}

// Busca o resultado de uma abrangência (br, sp, zz, etc)
export async function fetchResultado(uf: string): Promise<TseResultadoUnificado | null> {
  try {
    const url = buildUrl(uf);
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-cache',
    });
    if (!response.ok) {
      console.warn(`TSE: ${uf} retornou ${response.status}`);
      return null;
    }
    const data = (await response.json()) as TseResultadoUnificado;
    if (String(data.ele) !== String(ELEICAO_2TURNO) || !Array.isArray(data.carg)) {
      console.warn(`TSE: ${uf} não é o arquivo oficial da eleição ${ELEICAO_2TURNO}`);
      return null;
    }
    return data;
  } catch (err) {
    console.error(`Erro ao buscar ${uf}:`, err);
    return null;
  }
}

// Normaliza o resultado do TSE para formato de UI
export function normalizeResultado(
  raw: TseResultadoUnificado,
  nomeLocal: string,
  uf: string
): ElectionResult {
  const cargo = raw.carg?.[0];
  const candidatos: CandidateResult[] = [];

  if (cargo?.agr) {
    for (const agregacao of cargo.agr) {
      for (const partido of agregacao.par || []) {
        for (const cand of partido.cand || []) {
          const vice = cand.vs?.find(v => v.tp === 'v');
          const numero = parseInteiro(cand.n);
          candidatos.push({
            numero,
            nome: cand.nm,
            nomeUrna: cand.nmu,
            partido: partido.sg,
            votos: parseInteiro(cand.vap),
            percentual: parseNumero(cand.pvap),
            eleito: cand.e === 's',
            situacao: cand.st || '',
            viceNome: vice?.nmu,
            cor: getCorCandidato(numero),
          });
        }
      }
    }
  }

  // Ordena por votos (decrescente)
  candidatos.sort((a, b) => b.votos - a.votos || a.numero - b.numero);

  return {
    abrangencia: uf,
    nomeLocal,
    dataGeracao: raw.dg || '',
    horaGeracao: raw.hg || '',
    dataTotalizacao: raw.dt || undefined,
    horaTotalizacao: raw.ht || undefined,
    totalizacaoFinal: raw.tf === 's',
    andamento: raw.and || 'n',
    matematicamenteDefinido: raw.md,
    secoesTotal: parseInteiro(raw.s?.ts),
    secoesTotalizadas: parseInteiro(raw.s?.st),
    percentualSecoes: parseNumero(raw.s?.pst),
    eleitoradoTotal: parseInteiro(raw.e?.te),
    eleitoradoApurado: parseInteiro(raw.e?.est),
    comparecimento: parseInteiro(raw.e?.c),
    percentualComparecimento: parseNumero(raw.e?.pc),
    abstencao: parseInteiro(raw.e?.a),
    percentualAbstencao: parseNumero(raw.e?.pa),
    votosValidos: parseInteiro(raw.v?.vv),
    votosBrancos: parseInteiro(raw.v?.vb),
    votosNulos: parseInteiro(raw.v?.tvn),
    totalVotos: parseInteiro(raw.v?.tv),
    candidatos,
    atualizadoEm: new Date(),
  };
}

// ---------------- EXTERIOR: agregação por país ----------------

// Agrega resultados das cidades em países (para mapa mundi e ranking)
export function aggregatePaises(porCidade: Map<string, ElectionResult>): PaisResumo[] {
  const grupos = new Map<string, ElectionResult[]>(); // país -> cidades com arquivo
  const totalPorPais = new Map<string, number>();     // país -> nº de localidades previstas

  for (const [cd, pais] of Object.entries(CIDADE_PAIS)) {
    totalPorPais.set(pais, (totalPorPais.get(pais) || 0) + 1);
    const r = porCidade.get(cd);
    if (r) {
      if (!grupos.has(pais)) grupos.set(pais, []);
      grupos.get(pais)!.push(r);
    }
  }

  const resumos: PaisResumo[] = [];
  for (const [pais, cidades] of grupos) {
    const info = PAIS_INFO[pais];
    if (!info) continue;

    const porNumero = new Map<number, CandidateResult>();
    let votosValidos = 0, brancos = 0, nulos = 0, comparecimento = 0;
    let secoesTotal = 0, secoesTotalizadas = 0, finalizadas = 0, comVotos = 0;
    let deBoletim = 0, deTse = 0;

    for (const c of cidades) {
      votosValidos += c.votosValidos;
      brancos += c.votosBrancos;
      nulos += c.votosNulos;
      comparecimento += c.comparecimento;
      secoesTotal += c.secoesTotal;
      secoesTotalizadas += c.secoesTotalizadas;
      if (c.andamento === 'f' || c.totalizacaoFinal) finalizadas += 1;
      if (c.votosValidos > 0) {
        comVotos += 1;
        if (c.fonte === 'boletim') deBoletim += 1; else deTse += 1;
      }
      for (const cand of c.candidatos) {
        const cur = porNumero.get(cand.numero);
        if (cur) {
          porNumero.set(cand.numero, { ...cur, votos: cur.votos + cand.votos });
        } else {
          porNumero.set(cand.numero, { ...cand });
        }
      }
    }

    const eleitorado = cidades.reduce((s, c) => s + c.eleitoradoTotal, 0);

    const candidatos = [...porNumero.values()].sort((a, b) => b.votos - a.votos);
    for (const cand of candidatos) {
      cand.percentual = votosValidos > 0 ? (cand.votos / votosValidos) * 100 : 0;
    }

    const andamento: PaisResumo['andamento'] =
      finalizadas === cidades.length && cidades.length > 0 ? 'f'
      : comVotos > 0 || secoesTotalizadas > 0 ? 'p' : 'n';

    resumos.push({
      nome: pais,
      iso2: info.iso2,
      isoNum: info.isoNum,
      regiao: info.regiao,
      eleitorado,
      comparecimento,
      votosValidos,
      votosBrancos: brancos,
      votosNulos: nulos,
      secoesTotal,
      secoesTotalizadas,
      percentualSecoes: secoesTotal > 0 ? (secoesTotalizadas / secoesTotal) * 100 : 0,
      cidadesTotal: totalPorPais.get(pais) || cidades.length,
      cidadesComVotos: comVotos,
      cidadesFinalizadas: finalizadas,
      andamento,
      candidatos,
      fonte: deBoletim > 0 && deTse > 0 ? 'misto' : deBoletim > 0 ? 'boletim' : 'tse',
    });
  }

  return resumos.sort((a, b) => b.votosValidos - a.votosValidos);
}

// Busca todos os resultados: nacional + todas as UFs + exterior
export async function fetchAllResults(
  ufs: { sigla: string; nome: string }[]
): Promise<{
  nacional: ElectionResult | null;
  porUF: Map<string, ElectionResult>;
  exterior: ElectionResult | null;
}> {
  const porUF = new Map<string, ElectionResult>();
  let nacional: ElectionResult | null = null;
  let exterior: ElectionResult | null = null;

  // Busca nacional (BR) primeiro
  const rawBR = await fetchResultado('br');
  if (rawBR) {
    nacional = normalizeResultado(rawBR, 'Brasil', 'br');
  }

  // Busca exterior (ZZ)
  const rawZZ = await fetchResultado('zz');
  if (rawZZ) {
    exterior = normalizeResultado(rawZZ, 'Exterior', 'zz');
  }

  // Busca todas as UFs em paralelo
  const LOTE = 5;
  for (let i = 0; i < ufs.length; i += LOTE) {
    const lote = ufs.slice(i, i + LOTE);
    const resultados = await Promise.all(
      lote.map(async (uf) => {
        const raw = await fetchResultado(uf.sigla.toLowerCase());
        if (raw) {
          return { uf, resultado: normalizeResultado(raw, uf.nome, uf.sigla.toLowerCase()) };
        }
        return null;
      })
    );
    for (const r of resultados) {
      if (r) porUF.set(r.uf.sigla, r.resultado);
    }
  }

  return { nacional, porUF, exterior };
}

export const TSE_CONFIG = {
  ELEICAO_2TURNO,
  CARGO_PRESIDENTE,
  CICLO,
};
