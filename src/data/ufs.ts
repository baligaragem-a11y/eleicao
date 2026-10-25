export interface UFInfo {
  sigla: string;
  nome: string;
  regiao: string;
  codigoIbge: number;
  // Coordenadas aproximadas do centro do estado (para labels no mapa)
  lat: number;
  lng: number;
}

export const UFS: UFInfo[] = [
  { sigla: 'AC', nome: 'Acre', regiao: 'Norte', codigoIbge: 12, lat: -9.0, lng: -70.5 },
  { sigla: 'AL', nome: 'Alagoas', regiao: 'Nordeste', codigoIbge: 27, lat: -9.5, lng: -36.5 },
  { sigla: 'AM', nome: 'Amazonas', regiao: 'Norte', codigoIbge: 13, lat: -4.0, lng: -62.0 },
  { sigla: 'AP', nome: 'Amapá', regiao: 'Norte', codigoIbge: 16, lat: 1.5, lng: -51.5 },
  { sigla: 'BA', nome: 'Bahia', regiao: 'Nordeste', codigoIbge: 29, lat: -12.5, lng: -41.5 },
  { sigla: 'CE', nome: 'Ceará', regiao: 'Nordeste', codigoIbge: 23, lat: -5.0, lng: -39.5 },
  { sigla: 'DF', nome: 'Distrito Federal', regiao: 'Centro-Oeste', codigoIbge: 53, lat: -15.8, lng: -47.8 },
  { sigla: 'ES', nome: 'Espírito Santo', regiao: 'Sudeste', codigoIbge: 32, lat: -20.0, lng: -40.8 },
  { sigla: 'GO', nome: 'Goiás', regiao: 'Centro-Oeste', codigoIbge: 52, lat: -15.5, lng: -49.5 },
  { sigla: 'MA', nome: 'Maranhão', regiao: 'Nordeste', codigoIbge: 21, lat: -5.5, lng: -45.5 },
  { sigla: 'MG', nome: 'Minas Gerais', regiao: 'Sudeste', codigoIbge: 31, lat: -18.5, lng: -44.5 },
  { sigla: 'MS', nome: 'Mato Grosso do Sul', regiao: 'Centro-Oeste', codigoIbge: 50, lat: -20.5, lng: -54.5 },
  { sigla: 'MT', nome: 'Mato Grosso', regiao: 'Centro-Oeste', codigoIbge: 51, lat: -12.5, lng: -56.0 },
  { sigla: 'PA', nome: 'Pará', regiao: 'Norte', codigoIbge: 15, lat: -4.5, lng: -53.0 },
  { sigla: 'PB', nome: 'Paraíba', regiao: 'Nordeste', codigoIbge: 25, lat: -7.2, lng: -36.5 },
  { sigla: 'PE', nome: 'Pernambuco', regiao: 'Nordeste', codigoIbge: 26, lat: -8.5, lng: -37.5 },
  { sigla: 'PI', nome: 'Piauí', regiao: 'Nordeste', codigoIbge: 22, lat: -7.0, lng: -42.5 },
  { sigla: 'PR', nome: 'Paraná', regiao: 'Sul', codigoIbge: 41, lat: -24.5, lng: -51.5 },
  { sigla: 'RJ', nome: 'Rio de Janeiro', regiao: 'Sudeste', codigoIbge: 33, lat: -22.2, lng: -42.5 },
  { sigla: 'RN', nome: 'Rio Grande do Norte', regiao: 'Nordeste', codigoIbge: 24, lat: -5.8, lng: -36.0 },
  { sigla: 'RO', nome: 'Rondônia', regiao: 'Norte', codigoIbge: 11, lat: -10.5, lng: -63.5 },
  { sigla: 'RR', nome: 'Roraima', regiao: 'Norte', codigoIbge: 14, lat: 2.0, lng: -61.5 },
  { sigla: 'RS', nome: 'Rio Grande do Sul', regiao: 'Sul', codigoIbge: 43, lat: -30.0, lng: -53.5 },
  { sigla: 'SC', nome: 'Santa Catarina', regiao: 'Sul', codigoIbge: 42, lat: -27.5, lng: -50.5 },
  { sigla: 'SE', nome: 'Sergipe', regiao: 'Nordeste', codigoIbge: 28, lat: -10.5, lng: -37.0 },
  { sigla: 'SP', nome: 'São Paulo', regiao: 'Sudeste', codigoIbge: 35, lat: -22.5, lng: -47.5 },
  { sigla: 'TO', nome: 'Tocantins', regiao: 'Norte', codigoIbge: 17, lat: -10.0, lng: -48.5 },
];

export const REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];

export const REGIAO_CORES: Record<string, string> = {
  'Norte': '#16a34a',
  'Nordeste': '#ea580c',
  'Centro-Oeste': '#ca8a04',
  'Sudeste': '#2563eb',
  'Sul': '#7c3aed',
};

export function getUFInfo(sigla: string): UFInfo | undefined {
  return UFS.find(u => u.sigla === sigla.toUpperCase());
}

export function getUFSiglaByNome(nome: string): string | undefined {
  const uf = UFS.find(u => u.nome.toLowerCase() === nome.toLowerCase());
  return uf?.sigla;
}
