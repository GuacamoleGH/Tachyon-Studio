import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class SpeedGraphWidget implements BaseWidget {
  public id: string = 'speed_graph';
  public type = 'speed_graph' as const;
  public name: string = 'Gráfica de Velocidad / Tiempo';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 540, y: 150, width: 220, height: 150 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, allPoints, timeSec } = context;
    const { x, y, width, height } = this.bounds;

    ctx.save();

    // Fondo del panel
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 8);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.85)';
    ctx.fill();
    ctx.strokeStyle = CockpitColors.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Título
    ctx.font = 'bold 9px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'left';
    ctx.fillText('PERFIL DE VELOCIDAD', x + 10, y + 15);

    if (!allPoints || allPoints.length === 0) {
      ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.textAlign = 'center';
      ctx.fillText('Sin datos', x + width / 2, y + height / 2);
      ctx.restore();
      return;
    }

    const tMin = allPoints[0].time_offset_video_sec;
    const tMax = allPoints[allPoints.length - 1].time_offset_video_sec;
    const tSpan = Math.max(1, tMax - tMin);

    // Calcular velocidad máxima
    let maxSpd = 50;
    for (let i = 0; i < allPoints.length; i++) {
      const spd = allPoints[i].gps_speed_kmh ?? allPoints[i].obd_speed_kmh;
      if (spd != null && spd > maxSpd) maxSpd = spd;
    }
    maxSpd = Math.ceil(maxSpd / 20) * 20;

    const padX = 14;
    const padY = 22;
    const graphW = width - padX * 2;
    const graphH = height - padY - 14;
    const graphX = x + padX;
    const graphY = y + padY;

    // Líneas guía horizontales
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(44, 57, 71, 0.5)';
    ctx.lineWidth = 1;
    for (let s = 0; s <= maxSpd; s += maxSpd / 2) {
      const lineY = graphY + graphH - (s / maxSpd) * graphH;
      ctx.moveTo(graphX, lineY);
      ctx.lineTo(graphX + graphW, lineY);
    }
    ctx.stroke();

    // Curva de velocidad
    ctx.beginPath();
    let started = false;

    for (let i = 0; i < allPoints.length; i++) {
      const p = allPoints[i];
      const spd = p.gps_speed_kmh ?? p.obd_speed_kmh;
      if (spd != null) {
        const px = graphX + ((p.time_offset_video_sec - tMin) / tSpan) * graphW;
        const py = graphY + graphH - (spd / maxSpd) * graphH;
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
    }
    ctx.strokeStyle = CockpitColors.neonGreen;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cursor vertical del tiempo actual
    if (timeSec >= tMin && timeSec <= tMax) {
      const cursorX = graphX + ((timeSec - tMin) / tSpan) * graphW;
      ctx.beginPath();
      ctx.moveTo(cursorX, graphY);
      ctx.lineTo(cursorX, graphY + graphH);
      ctx.strokeStyle = CockpitColors.neonCyan;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Indicador luminoso en la cabecera del cursor
      ctx.beginPath();
      ctx.arc(cursorX, graphY, 3, 0, Math.PI * 2);
      ctx.fillStyle = CockpitColors.neonCyan;
      ctx.fill();
    }

    ctx.restore();
  }
}
