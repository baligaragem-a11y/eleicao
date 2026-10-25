export function formatNumber(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n);
}

export function formatPercent(n: number, digits = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n) + '%';
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + ' mi';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.', ',') + ' mil';
  return String(n);
}

export function formatHora(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export function tempoRelativo(date: Date): string {
  const agora = new Date();
  const diff = Math.floor((agora.getTime() - date.getTime()) / 1000);
  if (diff < 5) return 'agora mesmo';
  if (diff < 60) return `há ${diff}s`;
  const min = Math.floor(diff / 60);
  if (min < 60) return `há ${min}min`;
  const horas = Math.floor(min / 60);
  return `há ${horas}h`;
}
