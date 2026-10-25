import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { Activity } from 'lucide-react';

export interface HistoryPoint {
  hora: string;
  apurado: number;
  pctA: number;
  pctB: number;
}

interface Props {
  historico: HistoryPoint[];
  nomeA: string;
  nomeB: string;
  corA: string;
  corB: string;
  fonte?: 'tse' | 'boletim';
}

export default function EvolutionChart({ historico, nomeA, nomeB, corA, corB, fonte = 'tse' }: Props) {
  return (
    <section className="panel overflow-hidden p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow flex items-center gap-1.5"><Activity className="h-3 w-3 text-green" />Comparativo</div>
          <h2 className="display mt-1.5 text-[clamp(22px,2.4vw,30px)] leading-none text-ink">Evolução da apuração</h2>
          <p className="mt-2 max-w-[520px] text-[11.5px] leading-relaxed text-inksoft">
            Percentual sobre os votos válidos registrado a cada ciclo de leitura nesta sessão. A linha tracejada marca
            a maioria absoluta (50% + 1).
          </p>
        </div>
        <div className="flex items-center gap-4">
          {[{ n: nomeA, c: corA }, { n: nomeB, c: corB }].map(x => (
            <span key={x.n} className="flex items-center gap-1.5 text-[11px] font-semibold text-inksoft">
              <span className="h-2 w-2 rounded-full" style={{ background: x.c }} />{x.n}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 h-56">
        {historico.length < 2 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-hair bg-[#f6f3ea] text-center">
            <Activity className="h-5 w-5 text-[#c3bda9]" />
            <p className="mono text-[10px] uppercase tracking-[0.1em] text-[#8a958d]">
              o gráfico começa a desenhar na segunda leitura com votos
            </p>
            <p className="max-w-[380px] text-[11px] text-inksoft">
              Enquanto a apuração não começa, cada ciclo retorna o mesmo boletim — e não há variação a plotar.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historico} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="evA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={corA} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={corA} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="evB" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={corB} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={corB} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e3ded0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hora" tick={{ fill: '#8a958d', fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={{ stroke: '#e3ded0' }} minTickGap={40} />
              <YAxis domain={[Math.max(0, Math.floor(Math.min(...historico.flatMap(h => [h.pctA, h.pctB])) - 3)), Math.min(100, Math.ceil(Math.max(...historico.flatMap(h => [h.pctA, h.pctB])) + 3))]}
                tick={{ fill: '#8a958d', fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: '#0d2b23', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, fontSize: 12, fontFamily: 'IBM Plex Mono' }}
                labelStyle={{ color: '#9fd9c0' }}
                itemStyle={{ color: '#eef3ef' }}
                formatter={(v, name) => [`${Number(v ?? 0).toFixed(2).replace('.', ',')}%`, name === 'pctA' ? nomeA : nomeB]}
              />
              <ReferenceLine y={50} stroke="#c26024" strokeDasharray="6 4" />
              <Area type="monotone" dataKey="pctA" stroke={corA} strokeWidth={2.4} fill="url(#evA)" dot={false} isAnimationActive={false} />
              <Area type="monotone" dataKey="pctB" stroke={corB} strokeWidth={2.4} fill="url(#evB)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="mono mt-2 text-[8.5px] uppercase tracking-[0.09em] text-[#8a958d]">
        {historico.length} leituras nesta sessão · {fonte === 'boletim' ? 'boletins de urna do exterior (prévia)' : 'totalização TSE (EA20)'} · nenhum número é projetado ou simulado
      </p>
    </section>
  );
}
