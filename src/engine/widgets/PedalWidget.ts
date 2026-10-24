import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class PedalWidget implements BaseWidget {
  public id: string = 'throttle';
  public type = 'throttle' as const;
  public name: string = 'Barra de Acelerador / Pedal';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 260, y: 310, width: 60, height: 110 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot } = context;
    const { x, y, width, height } = this.bounds;

    const throttle = snapshot.throttlePct;
    const isAvailable = snapshot.throttleAvailable && throttle !== null;

    ctx.save();

    // Fondo del panel
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 8);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.85)';
    ctx.fill();
    ctx.strokeStyle = CockpitColors.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Etiqueta
    ctx.font = 'bold 9px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.textAlign = 'center';
    ctx.fillText('PEDAL', x + width / 2, y + 14);

    // Barra vertical
    const barPadding = 12;
    const barX = x + barPadding;
    const barW = width - barPadding * 2;
    const barY = y + 22;
    const barH = height - 42;

    // Fondo de la barra
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fillStyle = CockpitColors.cardBg;
    ctx.fill();

    if (isAvailable && throttle !== null) {
      const clampedPct = Math.max(0, Math.min(100, throttle));
      const fillH = (clampedPct / 100) * barH;
      const fillY = barY + barH - fillH;

      ctx.beginPath();
      ctx.roundRect(barX, fillY, barW, fillH, 4);
      const gradient = ctx.createLinearGradient(0, barY + barH, 0, barY);
      gradient.addColorStop(0, CockpitColors.neonGreen);
      gradient.addColorStop(1, CockpitColors.neonCyan);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Porcentaje numérico
      ctx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = CockpitColors.textPrimary;
      ctx.fillText(`${Math.round(clampedPct)}%`, x + width / 2, y + height - 8);
    } else {
      ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.fillText('N/D', x + width / 2, y + height - 8);
    }

    ctx.restore();
  }
}
