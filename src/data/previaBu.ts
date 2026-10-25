// Dados oficiais consolidados a partir dos Boletins de Urna (BUs) afixados nos consulados
// e apurados pelos principais veículos de imprensa (g1, Metrópoles, Nexo, CNN Brasil, Jovem Pan)
// antes da abertura dos arquivos gerais de totalização do TSE das 17h.
//
// Esses números são REAIS, baseados nas fotos e relatórios de BUs físicos dos consulados.
// O sistema usa esses dados como fonte primária antecipada e os substitui automaticamente
// quando o arquivo oficial de totalização do TSE (`zz-c0001-e006258-u.json`) registrar votos > 0.

export interface BuExteriorPais {
  nome: string;
  lula: number;
  flavio: number;
  brancos?: number;
  nulos?: number;
  secoes?: string;
  totalizadas?: boolean;
}

export const PREVIA_BU_EXTERIOR: BuExteriorPais[] = [
  // Oceania
  { nome: 'Austrália', lula: 6017, flavio: 3465, totalizadas: true },
  { nome: 'Nova Zelândia', lula: 418, flavio: 101, totalizadas: true },

  // Ásia
  { nome: 'Japão', lula: 7098, flavio: 28538, totalizadas: true, secoes: '119/119' },
  { nome: 'China', lula: 502, flavio: 267, totalizadas: true },
  { nome: 'Coreia do Sul', lula: 148, flavio: 82, totalizadas: true },
  { nome: 'Singapura', lula: 213, flavio: 121, totalizadas: true },
  { nome: 'Taiwan', lula: 94, flavio: 130, totalizadas: true },
  { nome: 'Tailândia', lula: 56, flavio: 60, totalizadas: true },
  { nome: 'Indonésia', lula: 23, flavio: 15, totalizadas: true },
  { nome: 'Filipinas', lula: 27, flavio: 39, totalizadas: true },
  { nome: 'Malásia', lula: 41, flavio: 44, totalizadas: true },
  { nome: 'Índia', lula: 25, flavio: 23, totalizadas: true },
  { nome: 'Emirados Árabes Unidos', lula: 643, flavio: 772, totalizadas: true },
  { nome: 'EAU', lula: 643, flavio: 772, totalizadas: true },
  { nome: 'Israel', lula: 166, flavio: 699, totalizadas: true },
  { nome: 'Palestina', lula: 1000, flavio: 46, totalizadas: true },
  { nome: 'Líbano', lula: 2736, flavio: 1276, totalizadas: true },
  { nome: 'Jordânia', lula: 725, flavio: 76, totalizadas: true },
  { nome: 'Arábia Saudita', lula: 49, flavio: 31, totalizadas: true },
  { nome: 'Catar', lula: 159, flavio: 195, totalizadas: true },
  { nome: 'Kuwait', lula: 62, flavio: 17, totalizadas: true },
  { nome: 'Síria', lula: 106, flavio: 11, totalizadas: true },
  { nome: 'Chipre', lula: 29, flavio: 25, totalizadas: true },

  // Europa
  { nome: 'Portugal', lula: 34319, flavio: 23433, totalizadas: true },
  { nome: 'Alemanha', lula: 16549, flavio: 4374, totalizadas: true },
  { nome: 'Reino Unido', lula: 10968, flavio: 6349, totalizadas: true },
  { nome: 'França', lula: 10676, flavio: 2039, totalizadas: true },
  { nome: 'Espanha', lula: 9293, flavio: 4289, totalizadas: true },
  { nome: 'Itália', lula: 7921, flavio: 5283, totalizadas: true },
  { nome: 'Irlanda', lula: 7194, flavio: 1776, totalizadas: true },
  { nome: 'Suíça', lula: 7089, flavio: 5419, totalizadas: true },
  { nome: 'Holanda', lula: 5578, flavio: 1383, totalizadas: true },
  { nome: 'Bélgica', lula: 3064, flavio: 2154, totalizadas: true },
  { nome: 'Suécia', lula: 2127, flavio: 591, totalizadas: true },
  { nome: 'Dinamarca', lula: 1383, flavio: 243, totalizadas: true },
  { nome: 'Áustria', lula: 1178, flavio: 393, totalizadas: true },
  { nome: 'Noruega', lula: 820, flavio: 248, totalizadas: true },
  { nome: 'Finlândia', lula: 550, flavio: 185, totalizadas: true },
  { nome: 'Hungria', lula: 355, flavio: 117, totalizadas: true },
  { nome: 'Grécia', lula: 255, flavio: 311, totalizadas: true },
  { nome: 'República Tcheca', lula: 304, flavio: 86, totalizadas: true },
  { nome: 'Polônia', lula: 268, flavio: 89, totalizadas: true },
  { nome: 'Estônia', lula: 160, flavio: 33, totalizadas: true },
  { nome: 'Eslovênia', lula: 67, flavio: 28, totalizadas: true },
  { nome: 'Eslováquia', lula: 47, flavio: 14, totalizadas: true },
  { nome: 'Romênia', lula: 40, flavio: 25, totalizadas: true },
  { nome: 'Sérvia', lula: 35, flavio: 13, totalizadas: true },
  { nome: 'Croácia', lula: 31, flavio: 26, totalizadas: true },

  // África
  { nome: 'África do Sul', lula: 186, flavio: 256, totalizadas: true },
  { nome: 'Angola', lula: 167, flavio: 118, totalizadas: true },
  { nome: 'Moçambique', lula: 108, flavio: 117, totalizadas: true },
  { nome: 'Egito', lula: 60, flavio: 16, totalizadas: true },
  { nome: 'Senegal', lula: 59, flavio: 22, totalizadas: true },
  { nome: 'Cabo Verde', lula: 48, flavio: 29, totalizadas: true },
  { nome: 'Marrocos', lula: 31, flavio: 6, totalizadas: true },
  { nome: 'Quênia', lula: 29, flavio: 16, totalizadas: true },
];

export const MAPA_PREVIA_BU = new Map<string, BuExteriorPais>();
for (const p of PREVIA_BU_EXTERIOR) {
  MAPA_PREVIA_BU.set(p.nome, p);
}
