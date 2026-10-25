import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PaisResumo } from '../types/tse';
import { formatNumber, formatPercent } from '../utils/format';
import { NEUTRAL_BORDER, NEUTRAL_FILL, softFill, withAlpha } from '../theme';
import { flagEmoji } from './ExteriorPanel';
import worldJson from '../data/world110m.json';

const world = worldJson as unknown as GeoJSON.FeatureCollection;
const WORLD_BOUNDS: L.LatLngBoundsExpression = [[-54, -165], [70, 175]];

// Coordenadas de centro visual para microestados (ausentes na escala 1:110m)
// e países com territórios dispersos (evita que ilhas puxem o marcador para o oceano).
const CENTRO_PAIS: Record<number, [number, number]> = {
  28: [17.06, -61.80],   // Antígua e Barbuda
  48: [26.07, 50.56],    // Bahrein
  52: [13.19, -59.54],   // Barbados
  124: [54.5, -98.0],    // Canadá
  132: [15.12, -23.60],  // Cabo Verde
  208: [56.0, 10.0],     // Dinamarca
  250: [46.6, 2.3],      // França metropolitana
  254: [4.0, -53.0],     // Guiana Francesa
  528: [52.2, 5.3],      // Países Baixos
  578: [61.2, 8.8],      // Noruega
  620: [39.6, -8.1],     // Portugal
  643: [57.5, 55.0],     // Rússia
  662: [13.91, -60.98],  // Santa Lúcia
  678: [0.24, 6.61],     // São Tomé e Príncipe
  702: [1.35, 103.82],   // Singapura
  724: [40.2, -3.7],     // Espanha
  826: [53.5, -1.8],     // Reino Unido
  840: [38.5, -97.0],    // Estados Unidos
};

function ringArea(ring: number[][]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(a / 2);
}

function getCountryCenter(isoNum: number): [number, number] | null {
  if (CENTRO_PAIS[isoNum]) return CENTRO_PAIS[isoNum];
  const feat = (world.features as GeoJSON.Feature[]).find(f => Number(f.id) === isoNum);
  if (!feat || !feat.geometry) return null;

  const geom = feat.geometry;
  let mainRing: number[][] | null = null;
  if (geom.type === 'Polygon') {
    mainRing = geom.coordinates[0];
  } else if (geom.type === 'MultiPolygon') {
    let bestArea = -1;
    for (const poly of geom.coordinates) {
      const a = ringArea(poly[0]);
      if (a > bestArea) {
        bestArea = a;
        mainRing = poly[0];
      }
    }
  }
  if (!mainRing || mainRing.length === 0) return null;

  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of mainRing) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [(minLat + maxLat) / 2, (minLon + maxLon) / 2];
}

interface Props {
  paises: PaisResumo[];
  selectedPais: string | null;
  onSelectPais: (pais: string | null) => void;
}

function fillFor(p: PaisResumo | undefined): string {
  if (!p || p.votosValidos === 0 || p.candidatos.length === 0) return NEUTRAL_FILL;
  const l = p.candidatos[0];
  const margem = p.candidatos[1] ? Math.abs(l.percentual - p.candidatos[1].percentual) : 100;
  return softFill(l.cor, 0.4 + Math.min(margem / 45, 1) * 0.38);
}

function tipHtml(p: PaisResumo): string {
  let h = `<div class="map-tip"><div class="map-tip-head"><span class="map-tip-flag">${flagEmoji(p.iso2)}</span>${p.nome}<span>${p.regiao}</span></div>`;
  if (p.votosValidos > 0) {
    const fonte = p.fonte === 'tse' ? 'totalização TSE' : 'boletins de urna (prévia)';
    h += `<div class="map-tip-sub">${formatPercent(p.percentualSecoes)} das urnas · ${formatNumber(p.votosValidos)} válidos · ${p.cidadesComVotos}/${p.cidadesTotal} localidades<br/>fonte: ${fonte}</div>`;
    for (const c of p.candidatos.slice(0, 2)) {
      h += `<div class="map-tip-row"><span class="dot" style="background:${c.cor}"></span><span class="nm">${c.nomeUrna}</span><b>${formatPercent(c.percentual)}</b></div>`;
      h += `<div class="map-tip-row"><span class="nm" style="margin-left:15px;color:#9db8ad">${formatNumber(c.votos)} votos</span></div>`;
    }
  } else {
    h += `<div class="map-tip-sub">Aguardando boletins (${p.cidadesTotal} localidades consulares)</div>`;
  }
  h += `<div class="map-tip-cta">Clique para detalhar ${p.nome}</div></div>`;
  return h;
}

export default function WorldMap({ paises, selectedPais, onSelectPais }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const marksRef = useRef<L.LayerGroup | null>(null);
  const ref = useRef({ paises, selectedPais, onSelectPais });
  ref.current = { paises, selectedPais, onSelectPais };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [18, 10], zoom: 1.75, minZoom: 1.5, maxZoom: 6,
      zoomControl: true, attributionControl: true, scrollWheelZoom: false,
      zoomSnap: 0.25, maxBounds: [[-85, -195], [85, 195]], maxBoundsViscosity: 0.9,
    });
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('Natural Earth · dados TSE');
    marksRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const layer = L.geoJSON(world, {
      style: f => {
        const p = ref.current.paises.find(x => x.isoNum === Number(f?.id));
        return { fillColor: fillFor(p), weight: 0.6, opacity: 1, color: p ? withAlpha(p.candidatos[0]?.cor || '#54635a', 0.4) : NEUTRAL_BORDER, fillOpacity: 1 };
      },
      onEachFeature: (f, lyr) => {
        const path = lyr as L.Path & { on: (e: string, fn: () => void) => void };
        const id = Number(f.id);
        path.on('mouseover', () => {
          const p = ref.current.paises.find(x => x.isoNum === id);
          if (!p) return;
          path.setStyle({ weight: 1.6, color: '#15251f' });
          (path as unknown as { bringToFront?: () => void }).bringToFront?.();
          path.bindTooltip(tipHtml(p), { sticky: true, direction: 'top', className: 'uf-tooltip', opacity: 1 }).openTooltip();
        });
        path.on('mouseout', () => {
          const p = ref.current.paises.find(x => x.isoNum === id);
          const sel = p && ref.current.selectedPais === p.nome;
          path.setStyle({ weight: sel ? 2.2 : 0.6, color: sel ? '#15251f' : (p ? withAlpha(p.candidatos[0]?.cor || '#54635a', 0.4) : NEUTRAL_BORDER) });
          path.unbindTooltip();
        });
        path.on('click', () => {
          const p = ref.current.paises.find(x => x.isoNum === id);
          if (p) ref.current.onSelectPais(ref.current.selectedPais === p.nome ? null : p.nome);
        });
      },
    }).addTo(map);

    layerRef.current = layer;
    map.fitBounds(WORLD_BOUNDS, { padding: [10, 10] });

    return () => { map.remove(); mapRef.current = null; layerRef.current = null; marksRef.current = null; };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.eachLayer(l => {
      const f = (l as unknown as { feature?: GeoJSON.Feature }).feature;
      const p = paises.find(x => x.isoNum === Number(f?.id));
      const sel = p && selectedPais === p.nome;
      (l as L.Path).setStyle({
        fillColor: fillFor(p),
        weight: sel ? 2.2 : 0.6,
        color: sel ? '#15251f' : (p ? withAlpha(p.candidatos[0]?.cor || '#54635a', 0.4) : NEUTRAL_BORDER),
      });
    });

    if (marksRef.current) {
      marksRef.current.clearLayers();
      const max = Math.max(...paises.map(p => p.votosValidos), 1);
      for (const p of paises) {
        if (p.votosValidos <= 0) continue;
        const c = getCountryCenter(p.isoNum);
        if (!c) continue;
        L.circleMarker(c, {
          radius: 3 + Math.sqrt(p.votosValidos / max) * 9,
          fillColor: p.candidatos[0]?.cor || '#0b6650',
          fillOpacity: 0.85, color: '#fbf9f4', weight: 1.4,
        })
          .bindTooltip(tipHtml(p), { direction: 'top', className: 'uf-tooltip', opacity: 1 })
          .on('click', () => onSelectPais(selectedPais === p.nome ? null : p.nome))
          .addTo(marksRef.current);
      }
    }
  }, [paises, selectedPais, onSelectPais]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (selectedPais) {
      const p = paises.find(x => x.nome === selectedPais);
      const c = p ? getCountryCenter(p.isoNum) : null;
      if (c) {
        map.flyTo(c, 3.5, { duration: 0.8 });
        return;
      }
    }
    map.flyToBounds(WORLD_BOUNDS, { padding: [10, 10], duration: 0.8 });
  }, [selectedPais, paises]);

  return <div ref={containerRef} className="map-shell relative h-[380px] w-full overflow-hidden rounded-[14px] lg:h-[460px]" />;
}
