import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CandidateResult, ElectionResult } from '../types/tse';
import { UFS, type UFInfo } from '../data/ufs';
import { formatNumber, formatPercent } from '../utils/format';
import { NEUTRAL_BORDER, NEUTRAL_FILL, softFill, withAlpha } from '../theme';
import brUfsJson from '../data/br-ufs.json';

const brUfs = brUfsJson as unknown as GeoJSON.FeatureCollection;

export type MapMode = 'vencedor' | 'margem' | 'volume';

interface BrazilMapProps {
  resultadosPorUF: Map<string, ElectionResult>;
  onSelectUF: (uf: UFInfo | null) => void;
  selectedUF: string | null;
  mode?: MapMode;
}

function liderDe(r: ElectionResult | undefined): CandidateResult | null {
  if (!r || r.votosValidos === 0 || r.candidatos.length === 0) return null;
  return r.candidatos[0];
}

function fillFor(r: ElectionResult | undefined, mode: MapMode): string {
  const lider = liderDe(r);
  if (!lider) return NEUTRAL_FILL;
  const outro = r!.candidatos[1];
  const margem = outro ? Math.abs(lider.percentual - outro.percentual) : 100;
  if (mode === 'volume') {
    const escala = Math.min(1, Math.log10(Math.max(r!.votosValidos, 10)) / 7.6);
    return softFill(lider.cor, 0.25 + escala * 0.6);
  }
  if (mode === 'margem') return softFill(lider.cor, 0.18 + Math.min(margem / 32, 1) * 0.68);
  return softFill(lider.cor, 0.42 + Math.min(margem / 45, 1) * 0.36);
}

function borderFor(r: ElectionResult | undefined): string {
  const lider = liderDe(r);
  return lider ? withAlpha(lider.cor, 0.55) : NEUTRAL_BORDER;
}

function tooltip(r: ElectionResult | undefined, nome: string, sigla: string): string {
  let h = `<div class="map-tip"><div class="map-tip-head">${nome}<span>${sigla}</span></div>`;
  if (r && r.votosValidos > 0) {
    h += `<div class="map-tip-sub">${formatPercent(r.percentualSecoes)} das urnas · ${formatNumber(r.votosValidos)} votos válidos</div>`;
    for (const c of r.candidatos.slice(0, 2)) {
      h += `<div class="map-tip-row"><span class="dot" style="background:${c.cor}"></span><span class="nm">${c.nomeUrna}</span><b>${formatPercent(c.percentual)}</b></div>`;
      h += `<div class="map-tip-row"><span class="nm" style="margin-left:15px;color:#9db8ad">${formatNumber(c.votos)} votos</span></div>`;
    }
  } else {
    h += `<div class="map-tip-sub">Aguardando boletins das seções…</div>`;
  }
  h += `<div class="map-tip-cta">Clique para focar ${sigla}</div></div>`;
  return h;
}

export default function BrazilMap({ resultadosPorUF, onSelectUF, selectedUF, mode = 'vencedor' }: BrazilMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const stateRef = useRef({ resultadosPorUF, onSelectUF, selectedUF, mode });
  stateRef.current = { resultadosPorUF, onSelectUF, selectedUF, mode };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true, attributionControl: true, scrollWheelZoom: false,
      zoomSnap: 0.25, minZoom: 3, maxZoom: 8,
    });
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('malha IBGE · dados TSE');
    mapRef.current = map;

    const layer = L.geoJSON(brUfs, {
      style: (feature) => {
        const sigla = String(feature?.properties?.sigla || '').toUpperCase();
        return {
          fillColor: fillFor(stateRef.current.resultadosPorUF.get(sigla), stateRef.current.mode),
          weight: 1, color: borderFor(stateRef.current.resultadosPorUF.get(sigla)), fillOpacity: 1,
        };
      },
      onEachFeature: (feature, lyr) => {
        const path = lyr as L.Path & { on: (e: string, f: (ev: L.LeafletMouseEvent) => void) => void };
        const sigla = String(feature.properties?.sigla || '').toUpperCase();
        const nome = String(feature.properties?.nome || sigla);

        path.on('mouseover', () => {
          const sel = stateRef.current.selectedUF === sigla;
          path.setStyle({ weight: sel ? 2.6 : 1.8, color: sel ? '#15251f' : '#54635a', fillOpacity: 1 });
          (path as unknown as { bringToFront?: () => void }).bringToFront?.();
          path.bindTooltip(tooltip(stateRef.current.resultadosPorUF.get(sigla), nome, sigla), {
            sticky: true, direction: 'top', className: 'uf-tooltip', opacity: 1,
          }).openTooltip();
        });
        path.on('mouseout', () => {
          const r = stateRef.current.resultadosPorUF.get(sigla);
          const sel = stateRef.current.selectedUF === sigla;
          path.setStyle({ weight: sel ? 2.6 : 1, color: sel ? '#15251f' : borderFor(r) });
          path.unbindTooltip();
        });
        path.on('click', () => {
          const uf = UFS.find(u => u.sigla === sigla) || null;
          stateRef.current.onSelectUF(stateRef.current.selectedUF === sigla ? null : uf);
        });
      },
    }).addTo(map);

    layerRef.current = layer;
    map.fitBounds(layer.getBounds(), { padding: [14, 14] });

    for (const uf of UFS) {
      L.marker([uf.lat, uf.lng], {
        interactive: false, keyboard: false,
        icon: L.divIcon({ className: 'uf-label', html: `<span>${uf.sigla}</span>`, iconSize: [30, 14], iconAnchor: [15, 7] }),
      }).addTo(map);
    }

    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.eachLayer(l => {
      const f = (l as unknown as { feature?: GeoJSON.Feature }).feature;
      const sigla = String(f?.properties?.sigla || '').toUpperCase();
      const r = resultadosPorUF.get(sigla);
      const sel = selectedUF === sigla;
      (l as L.Path).setStyle({
        fillColor: fillFor(r, mode),
        weight: sel ? 2.6 : 1,
        color: sel ? '#15251f' : borderFor(r),
      });
    });
  }, [resultadosPorUF, selectedUF, mode]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    if (selectedUF) {
      const uf = UFS.find(u => u.sigla === selectedUF);
      if (uf) { map.flyTo([uf.lat, uf.lng], 5.5, { duration: 0.75 }); return; }
    }
    map.flyToBounds(layer.getBounds(), { padding: [14, 14], duration: 0.75 });
  }, [selectedUF]);

  return <div ref={containerRef} className="map-shell relative h-[470px] w-full overflow-hidden rounded-[14px] lg:h-[540px]" />;
}

/** Faixa de legenda proporcional usada no rodapé do painel do mapa. */
export function MapLegend({ candidatos, decisivos }: { candidatos: CandidateResult[]; decisivos: UFInfo[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {candidatos.slice(0, 2).map(c => (
        <span key={c.numero} className="flex items-center gap-1.5 text-[10.5px] font-semibold text-inksoft">
          <span className="h-2 w-2 rounded-[3px]" style={{ background: withAlpha(c.cor, 0.75) }} />
          {c.nomeUrna} <span className="mono text-[9px] font-normal text-[#9aa59d]">nº {c.numero}</span>
        </span>
      ))}
      <span className="flex items-center gap-1.5 text-[10.5px] text-inksoft">
        <span className="h-2 w-2 rounded-[3px] border border-[#d6d0bf] bg-[#e9e4d6]" /> sem dados
      </span>
      <span className="mono ml-auto text-[9px] uppercase tracking-[0.1em] text-[#8a958d]">
        {decisivos.length} UFs na disputa direta · clique para focar
      </span>
    </div>
  );
}
