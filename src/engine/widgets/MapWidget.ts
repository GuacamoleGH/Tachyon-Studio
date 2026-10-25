import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class MapWidget implements BaseWidget {
  public id: string = 'map';
  public type = 'map' as const;
  public name: string = 'Mapa con Trazada GPS';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  // Caché de la caja delimitadora de coordenadas de la sesión
  private boundsCache: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null = null;

  constructor(bounds: WidgetBounds = { x: 330, y: 150, width: 200, height: 150 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot, allPoints } = context;
    const { x, y, width, height } = this.bounds;
    const scale = Math.min(width / 180, height / 135);
    const cornerRadius = Math.max(3, Math.round(8 * scale));
    const titleFontSize = Math.max(8, Math.round(10 * scale));

    ctx.save();

    // Fondo del panel
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, cornerRadius);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.85)';
    ctx.fill();
    ctx.strokeStyle = CockpitColors.border;
    ctx.lineWidth = Math.max(1, Math.round(1.5 * scale));
    ctx.stroke();

    // Etiqueta
    ctx.font = `bold ${titleFontSize}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'left';
    ctx.fillText('TRAZADA GPS', x + Math.round(10 * scale), y + Math.round(15 * scale));

    if (!allPoints || allPoints.length === 0) {
      const emptyFontSize = Math.max(9, Math.round(11 * scale));
      ctx.font = `bold ${emptyFontSize}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.textAlign = 'center';
      ctx.fillText('Sin datos GPS', x + width / 2, y + height / 2);
      ctx.restore();
      return;
    }

    // Calcular o usar caché de bounding box
    if (!this.boundsCache) {
      let minLat = Infinity,
        maxLat = -Infinity,
        minLon = Infinity,
        maxLon = -Infinity;

      for (let i = 0; i < allPoints.length; i++) {
        const p = allPoints[i];
        if (p.latitude != null && p.longitude != null) {
          if (p.latitude < minLat) minLat = p.latitude;
          if (p.latitude > maxLat) maxLat = p.latitude;
          if (p.longitude < minLon) minLon = p.longitude;
          if (p.longitude > maxLon) maxLon = p.longitude;
        }
      }

      if (isFinite(minLat)) {
        this.boundsCache = { minLat, maxLat, minLon, maxLon };
      }
    }

    if (!this.boundsCache) {
      ctx.restore();
      return;
    }

    const { minLat, maxLat, minLon, maxLon } = this.boundsCache;
    const padding = 18;
    const mapW = width - padding * 2;
    const mapH = height - padding * 2 - 10;
    const mapX = x + padding;
    const mapY = y + padding + 6;

    const latSpan = Math.max(0.0001, maxLat - minLat);
    const lonSpan = Math.max(0.0001, maxLon - minLon);

    // Función de proyección local a coordenadas canvas
    const project = (lat: number, lon: number): { px: number; py: number } => {
      const px = mapX + ((lon - minLon) / lonSpan) * mapW;
      const py = mapY + (1 - (lat - minLat) / latSpan) * mapH;
      return { px, py };
    };

    // 1. Dibujar polilínea de la trazada completa
    ctx.beginPath();
    let started = false;

    for (let i = 0; i < allPoints.length; i++) {
      const p = allPoints[i];
      if (p.latitude != null && p.longitude != null) {
        const { px, py } = project(p.latitude, p.longitude);
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
    }

    ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
    ctx.lineWidth = Math.max(1.5, Math.round(2.5 * scale));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 2. Dibujar posición actual del coche
    if (snapshot.gpsAvailable && snapshot.latitude != null && snapshot.longitude != null) {
      const { px, py } = project(snapshot.latitude, snapshot.longitude);

      // Halo exterior
      ctx.beginPath();
      ctx.arc(px, py, Math.max(4, Math.round(6 * scale)), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 230, 118, 0.35)';
      ctx.fill();

      // Punto central
      ctx.beginPath();
      ctx.arc(px, py, Math.max(2, Math.round(3.5 * scale)), 0, Math.PI * 2);
      ctx.fillStyle = CockpitColors.neonGreen;
      ctx.fill();

      // Flecha de rumbo si está disponible
      if (snapshot.bearingAvailable && snapshot.bearingDeg != null) {
        const rad = ((snapshot.bearingDeg - 90) * Math.PI) / 180;
        const arrowLen = Math.max(5, Math.round(9 * scale));
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(rad) * arrowLen, py + Math.sin(rad) * arrowLen);
        ctx.strokeStyle = CockpitColors.neonGreen;
        ctx.lineWidth = Math.max(1.5, Math.round(2 * scale));
        ctx.stroke();
      }
    } else {
      // Estado de corte GPS
      ctx.font = `bold ${Math.max(8, Math.round(9 * scale))}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = CockpitColors.neonRed;
      ctx.textAlign = 'right';
      ctx.fillText('SIN GPS', x + width - Math.round(10 * scale), y + Math.round(15 * scale));
    }

    ctx.restore();
  }
}
