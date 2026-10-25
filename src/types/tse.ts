// Tipos baseados na especificação EA20 do TSE - Arquivo de Resultado Unificado

export interface TseCandidate {
  n: number;        // Número do candidato na urna
  sqcand: number;   // Sequencial do candidato
  nm: string;       // Nome completo
  nmu: string;      // Nome de urna (exibido na urna)
  dvt?: string;     // Destinação
  seq?: number;     // Sequência
  e?: string;       // Eleito: 's' | 'n'
  st?: string;      // Situação: 'Eleito', 'Não eleito', '2º turno'
  vap: number;      // Votos computados
  pvap: string;     // Percentual de votos (string com vírgula)
  pvapn?: string;   // Percentual normalizado
  vs?: TseVice[];   // Vice / suplentes
}

export interface TseVice {
  n: number;
  nm: string;
  nmu: string;
  sqcand: number;
  tp: string; // 'v' vice, 's1' 1º suplente, 's2' 2º suplente
}

export interface TseParty {
  n: number;
  sg: string;
  nm: string;
  nfed?: number;
  tvan?: number;
  tvtn?: number;
  tval?: number;
  tvtl?: number;
  cand: TseCandidate[];
}

export interface TseAggregation {
  cd: string;
  ds: string;
  tvtn?: number;
  tvtl?: number;
  tvan?: number;
  tval?: number;
  par: TseParty[];
}

export interface TseCargo {
  cd: string;
  nmn: string;
  nmm: string;
  nmf: string;
  nv: number;
  qe?: number;
  agr: TseAggregation[];
}

export interface TseSecoes {
  ts: number;   // Total de seções
  st: number;   // Seções totalizadas
  pst: string;  // % secciones totalizadas
  snt: number;  // Seções não totalizadas
  si?: number;  // Seções inquiridas
  sa?: number;  // Seções anuladas
}

export interface TseEleitorado {
  te: number;   // Eleitorado total
  est: number;  // Eleitorado nas seções totalizadas
  c: number;    // Comparecimento
  pc: string;   // % comparecimento
  a: number;    // Abstenção
  pa: string;   // % abstenção
}

export interface TseVotos {
  tv: number;   // Total de votos
  vvc: number;  // Votos a votáveis concorrentes
  van: number;  // Votos anulados
  vansj?: number;
  vv: number;   // Votos válidos
  vnom?: number;
  vl?: number;
  vb: number;   // Votos em branco
  pvb?: string;
  tvn: number;  // Total de votos nulos
  vn: number;   // Votos nulos
  vnt: number;  // Votos nulos técnicos
  pvtn?: string;
  pvntn?: string;
}

export interface TseResultadoUnificado {
  ele: number;       // Código da eleição
  t: string;         // Turno: '1' | '2'
  f: string;         // Fase: 's' simulada | 'o' oficial
  sup: string;       // Suplementar: 's' | 'n'
  tpabr: string;     // Tipo abrangência: 'br' | 'uf' | 'mu' | 'zona'
  cdabr: string;     // Código abrangência
  dg: string;        // Data geração dd/mm/aaaa
  hg: string;        // Hora geração hh:mm:ss
  idg?: string;
  dt?: string;       // Data totalização
  ht?: string;       // Hora totalização
  tf?: string;       // Totalização final: 's' | 'n'
  and?: string;      // Andamento: 'n' não iniciado | 'p' parcial | 'f' finalizado
  md?: string;       // Matematicamente definido: 'e' eleito | 's' segundo turno
  dv?: string;       // Divulgação: 's' | 'n'
  carg: TseCargo[];
  s: TseSecoes;
  e: TseEleitorado;
  v: TseVotos;
}

// Dados normalizados para uso na UI
export interface CandidateResult {
  numero: number;
  nome: string;
  nomeUrna: string;
  partido: string;
  votos: number;
  percentual: number;
  eleito: boolean;
  situacao: string;
  viceNome?: string;
  cor: string;
}

// Resultado agregado de um país (soma das cidades consulares)
export interface PaisResumo {
  nome: string;                 // ex.: 'Austrália'
  iso2: string;                 // 'AU' (bandeira)
  isoNum: number;               // 36 (polygon id no mapa)
  regiao: string;               // 'Oceania'
  eleitorado: number;
  comparecimento: number;
  votosValidos: number;
  votosBrancos: number;
  votosNulos: number;
  secoesTotal: number;
  secoesTotalizadas: number;
  percentualSecoes: number;
  cidadesTotal: number;         // localidades consulares previstas
  cidadesComVotos: number;      // cidades já com votos computados
  cidadesFinalizadas: number;   // arquivos com andamento 'f'
  andamento: 'n' | 'p' | 'f';   // país: não iniciado | parcial | finalizado
  candidatos: CandidateResult[]; // agregado, ordenado por votos
  fonte?: 'tse' | 'boletim' | 'misto'; // de onde vêm os votos exibidos
}

/** 'tse' = totalização oficial (EA20) · 'boletim' = soma dos boletins de urna publicados pelo TSE */
export type FonteDados = 'tse' | 'boletim';

export interface ElectionResult {
  abrangencia: string;       // 'br', 'sp', etc
  nomeLocal: string;
  dataGeracao: string;
  horaGeracao: string;
  dataTotalizacao?: string;
  horaTotalizacao?: string;
  totalizacaoFinal: boolean;
  andamento: string;
  matematicamenteDefinido?: string;
  secoesTotal: number;
  secoesTotalizadas: number;
  percentualSecoes: number;
  eleitoradoTotal: number;
  eleitoradoApurado: number;
  comparecimento: number;
  percentualComparecimento: number;
  abstencao: number;
  percentualAbstencao: number;
  votosValidos: number;
  votosBrancos: number;
  votosNulos: number;
  totalVotos: number;
  candidatos: CandidateResult[];
  atualizadoEm: Date;
  fonte?: FonteDados;          // ausente = totalização oficial
  secoesComBoletim?: number;   // boletins publicados (apenas fonte 'boletim')
}
