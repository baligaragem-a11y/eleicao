import type { ElectionResult, CandidateResult } from '../types/tse';
import { CIDADE_PAIS } from '../data/paises';
import { PREVIA_BU_EXTERIOR } from '../data/previaBu';
import { fetchCidadesExterior, buildUrlCidade, normalizeResultado } from './tse';

export const URL_SECOES_ZZ = 'https://resultados.tse.jus.br/oficial/ele2026/arquivo-urna/3221/config/zz/zz-p003221-cs.json';

export interface ExteriorSnapshot {
  geradoTSE: string;
  secoesTotal: number;
  secoesComBU: number;
  secoesLidas: number;
  aguardando: number;
  falhas: number;
  bloqueadoAte: number;
  emAndamento: boolean;
  porCidade: Map<string, ElectionResult>;
  cidades: Array<{ cd: string; nm: string; secoesLidas: number; oficialSecoes: number }>;
}

// Converte um resultado de BU antecipado para o formato ElectionResult usado nas cidades
function buildResultFromBu(nomeCidade: string, cdCidade: string, bu: { lula: number; flavio: number }): ElectionResult {
  const validos = bu.lula + bu.flavio;
  const cands: CandidateResult[] = [
    {
      numero: 13,
      nome: 'LUIZ INÁCIO LULA DA SILVA',
      nomeUrna: 'LULA',
      partido: 'PT',
      votos: bu.lula,
      percentual: validos > 0 ? (bu.lula / validos) * 100 : 0,
      eleito: false,
      situacao: '',
      cor: '#dc2626',
    },
    {
      numero: 22,
      nome: 'FLAVIO NANTES BOLSONARO',
      nomeUrna: 'FLAVIO BOLSONARO',
      partido: 'PL',
      votos: bu.flavio,
      percentual: validos > 0 ? (bu.flavio / validos) * 100 : 0,
      eleito: false,
      situacao: '',
      cor: '#2563eb',
    },
  ].sort((a, b) => b.votos - a.votos);

  return {
    abrangencia: `zz:${cdCidade}`,
    nomeLocal: nomeCidade,
    dataGeracao: '25/10/2026',
    horaGeracao: '17:00:00',
    totalizacaoFinal: true,
    andamento: 'f',
    secoesTotal: 1,
    secoesTotalizadas: 1,
    percentualSecoes: 100,
    eleitoradoTotal: validos,
    eleitoradoApurado: validos,
    comparecimento: validos,
    percentualComparecimento: 100,
    abstencao: 0,
    percentualAbstencao: 0,
    votosValidos: validos,
    votosBrancos: 0,
    votosNulos: 0,
    totalVotos: validos,
    candidatos: cands,
    atualizadoEm: new Date(),
    fonte: 'boletim',
  };
}

// Consulta em paralelo os arquivos oficiais das 186 cidades consulares do TSE
export async function refreshExterior(
  onProgress?: (snap: ExteriorSnapshot) => void
): Promise<ExteriorSnapshot> {
  const cidades = await fetchCidadesExterior();
  const porCidade = new Map<string, ElectionResult>();

  const LOTE = 24;
  for (let i = 0; i < cidades.length; i += LOTE) {
    const lote = cidades.slice(i, i + LOTE);
    const rs = await Promise.all(
      lote.map(async (cidade: { cd: string; nm: string }) => {
        try {
          const res = await fetch(buildUrlCidade(cidade.cd), { cache: 'no-cache' });
          if (!res.ok) return null;
          const raw = await res.json();
          return { cidade, resultado: normalizeResultado(raw, cidade.nm, `zz:${cidade.cd}`) };
        } catch {
          return null;
        }
      })
    );
    for (const r of rs) {
      if (r) porCidade.set(r.cidade.cd, r.resultado);
    }
  }

  const cidadesResumo = cidades.map(c => ({
    cd: c.cd,
    nm: c.nm,
    secoesLidas: (porCidade.get(c.cd)?.votosValidos || 0) > 0 ? 1 : 0,
    oficialSecoes: porCidade.get(c.cd)?.secoesTotalizadas || 0,
  }));

  const snap: ExteriorSnapshot = {
    geradoTSE: '25/10/2026',
    secoesTotal: 1351,
    secoesComBU: PREVIA_BU_EXTERIOR.length,
    secoesLidas: PREVIA_BU_EXTERIOR.length,
    aguardando: 0,
    falhas: 0,
    bloqueadoAte: 0,
    emAndamento: false,
    porCidade,
    cidades: cidadesResumo,
  };

  if (onProgress) onProgress(snap);
  return snap;
}

// Mescla as cidades oficiais do TSE com os BUs antecipados da imprensa
export function cidadesMescladas(
  snap: ExteriorSnapshot,
  _baseCandidatos: CandidateResult[]
): Map<string, ElectionResult> {
  const merged = new Map(snap.porCidade);

  // Injeta os BUs nos países onde o TSE ainda não totalizou votos
  for (const bu of PREVIA_BU_EXTERIOR) {
    const cdsDoPais = Object.entries(CIDADE_PAIS)
      .filter(([, pais]) => pais === bu.nome)
      .map(([cd]) => cd);

    if (cdsDoPais.length === 0) continue;

    // Se alguma cidade desse país já tem votos do TSE oficial, respeitamos o TSE
    const votosTse = cdsDoPais.reduce((s, cd) => s + (merged.get(cd)?.votosValidos || 0), 0);
    if (votosTse > 0) continue;

    // Caso contrário, adicionamos o resultado do BU na localidade principal
    const cdPrincipal = cdsDoPais[0];
    const nomeCidade = merged.get(cdPrincipal)?.nomeLocal || bu.nome;
    merged.set(cdPrincipal, buildResultFromBu(nomeCidade, cdPrincipal, bu));
  }

  return merged;
}

// Gera o ElectionResult consolidado do exterior a partir dos BUs
export function exteriorPorBoletins(
  _snap: ExteriorSnapshot,
  _baseCandidatos: CandidateResult[],
  oficialZz: ElectionResult | null
): ElectionResult | null {
  let lula = 0;
  let flavio = 0;

  for (const bu of PREVIA_BU_EXTERIOR) {
    lula += bu.lula;
    flavio += bu.flavio;
  }

  const validosTotal = lula + flavio;
  if (validosTotal === 0) return null;

  const cands: CandidateResult[] = [
    {
      numero: 13,
      nome: 'LUIZ INÁCIO LULA DA SILVA',
      nomeUrna: 'LULA',
      partido: 'PT',
      votos: lula,
      percentual: (lula / validosTotal) * 100,
      eleito: false,
      situacao: '',
      cor: '#dc2626',
    },
    {
      numero: 22,
      nome: 'FLAVIO NANTES BOLSONARO',
      nomeUrna: 'FLAVIO BOLSONARO',
      partido: 'PL',
      votos: flavio,
      percentual: (flavio / validosTotal) * 100,
      eleito: false,
      situacao: '',
      cor: '#2563eb',
    },
  ].sort((a, b) => b.votos - a.votos);

  const base = oficialZz || {
    abrangencia: 'zz',
    nomeLocal: 'Exterior',
    dataGeracao: '25/10/2026',
    horaGeracao: '17:00:00',
    totalizacaoFinal: false,
    andamento: 'p',
    secoesTotal: 1351,
    secoesTotalizadas: PREVIA_BU_EXTERIOR.length,
    percentualSecoes: 100,
    eleitoradoTotal: 918876,
    eleitoradoApurado: validosTotal,
    comparecimento: validosTotal,
    percentualComparecimento: 0,
    abstencao: 0,
    percentualAbstencao: 0,
    votosValidos: validosTotal,
    votosBrancos: 0,
    votosNulos: 0,
    totalVotos: validosTotal,
    candidatos: cands,
    atualizadoEm: new Date(),
  };

  return {
    ...base,
    votosValidos: validosTotal,
    totalVotos: validosTotal,
    secoesTotalizadas: PREVIA_BU_EXTERIOR.length,
    percentualSecoes: (PREVIA_BU_EXTERIOR.length / base.secoesTotal) * 100,
    candidatos: cands,
    fonte: 'boletim',
  };
}

// Seleciona a fonte mais avançada (se o TSE oficial já tiver votos > 0, usa oficial)
export function escolherFonte(
  oficialZz: ElectionResult | null,
  buZz: ElectionResult | null
): ElectionResult | null {
  if (oficialZz && oficialZz.votosValidos > 0) return oficialZz;
  if (buZz && buZz.votosValidos > 0) return buZz;
  return oficialZz;
}
