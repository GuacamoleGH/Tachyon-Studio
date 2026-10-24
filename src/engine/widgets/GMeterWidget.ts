import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class GMeterWidget implements BaseWidget {
  public id: string = 'g_meter';
  public type = 'g_meter' as const;
  public name: string = 'G-Meter (Círculo de Kamm)';
  public bounds: WidgetBounds;
  public visible: boolean = true;
  public maxScaleG: number = 1.5;
  public preferredLongSource: 'IMU' | 'GPS' = 'IMU';

  constructor(bounds: WidgetBounds = { x: 740, y: 310, width: 140, height: 140 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot } = context;
    const { x, y, width, height } = this.bounds;

    const latG = snapshot.lateralG;
    const longG =
      this.preferredLongSource === 'GPS' && snapshot.derivedGpsLongGAvailable
        ? snapshot.derivedGpsLongG
        : snapshot.longitudinalG;

    const isAvailable =
      snapshot.lateralGAvailable &&
      latG !== null &&
      longG !== null &&
      (this.preferredLongSource === 'GPS' ? snapshot.derivedGpsLongGAvailable : snapshot.longitudinalGAvailable);

    const cx = x + width / 2;
    const cy = y + height / 2;
    const maxRadius = Math.min(width, height) / 2 - 14;

    ctx.save();

    // Fondo del panel
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 8);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.85)';
    ctx.fill();
    ctx.strokeStyle = CockpitColors.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Ejes de coordenadas
    ctx.beginPath();
    ctx.moveTo(cx - maxRadius, cy);
    ctx.lineTo(cx + maxRadius, cy);
    ctx.moveTo(cx, cy - maxRadius);
    ctx.lineTo(cx, cy + maxRadius);
    ctx.strokeStyle = 'rgba(44, 57, 71, 0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Círculos de escala 0.5G y 1.0G
    const r05 = (0.5 / this.maxScaleG) * maxRadius;
    const r10 = (1.0 / this.maxScaleG) * maxRadius;

    ctx.beginPath();
    ctx.arc(cx, cy, r05, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(44, 57, 71, 0.6)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r10, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(61, 79, 99, 0.8)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
    ctx.strokeStyle = CockpitColors.border;
    ctx.stroke();

    // Bolita de fuerza G
    if (isAvailable && latG !== null && longG !== null) {
      const latNorm = Math.max(-1, Math.min(1, latG / this.maxScaleG));
      const longNorm = Math.max(-1, Math.min(1, longG / this.maxScaleG));

      const dotX = cx + latNorm * maxRadius;
      const dotY = cy - longNorm * maxRadius; // Arriba = aceleración positiva

      ctx.beginPath();
      ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
      ctx.fillStyle = CockpitColors.neonCyan;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // Textos numéricos
      ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = CockpitColors.neonCyan;
      ctx.textAlign = 'left';
      ctx.fillText(`Lat: ${latG >= 0 ? '+' : ''}${latG.toFixed(2)}G`, x + 8, y + 16);

      ctx.fillStyle = CockpitColors.neonGreen;
      ctx.fillText(`Lon: ${longG >= 0 ? '+' : ''}${longG.toFixed(2)}G`, x + 8, y + 28);
    } else {
      // Estado N/D
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.fill();

      ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.textAlign = 'center';
      ctx.fillText('N/D', cx, cy + 18);
    }

    ctx.restore();
  }
}
