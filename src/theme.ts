// Paleta editorial do painel. As cores dos partidos vêm do TSE; aqui derivamos
// variações suaves (para fundo claro) e calculamos líderes/margens com precisão.

export function mixHex(from: string, to: string, amount: number): string {
  const clamp = Math.max(0, Math.min(1, amount));
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
  };
  const a = parse(from);
  const b = parse(to);
  const out = a.map((v, i) => Math.round(v + (b[i] - v) * clamp));
  return `#${out.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Fill suave sobre papel para estados/países vencedores. */
export function softFill(color: string, intensity = 0.55): string {
  return mixHex('#f5f2e9', color, 0.22 + intensity * 0.5);
}

export function tint(color: string, amount = 0.12): string {
  return mixHex(color, '#ffffff', 1 - amount);
}

export function withAlpha(color: string, alpha: number): string {
  const h = color.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const NEUTRAL_FILL = '#e9e4d6';
export const NEUTRAL_BORDER = '#d6d0bf';
