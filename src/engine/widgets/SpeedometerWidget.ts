import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class SpeedometerWidget implements BaseWidget {
  public id: string = 'speedometer';
  public type = 'speedometer' as const;
  public name: string = 'Velocímetro Digital';
  public bounds: WidgetBounds;
  public visible: boolean = true;
  public preferredSource: 'GPS' | 'OBD' = 'GPS';

  constructor(bounds: WidgetBounds = { x: 30, y: 310, width: 220, height: 110 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot, unitSystem } = context;
    const { x, y, width, height } = this.bounds;

    let rawSpeedKmh: number | null = null;
    let isAvailable = false;
    let sourceLabel = 'GPS SPEED';

    if (this.preferredSource === 'OBD' && snapshot.signals.obd_speed_kmh?.isAvailable) {
      rawSpeedKmh = snapshot.signals.obd_speed_kmh.value;
      isAvailable = true;
      sourceLabel = 'OBD SPEED';
    } else if (snapshot.speedAvailable && snapshot.speedKmh !== null) {
      rawSpeedKmh = snapshot.speedKmh;
      isAvailable = true;
      sourceLabel = 'GPS SPEED';
    }

    const isImperial = unitSystem === 'imperial';
    const displaySpeed = rawSpeedKmh !== null ? (isImperial ? rawSpeedKmh * 0.621371 : rawSpeedKmh) : null;
    const unitLabel = isImperial ? 'MPH' : 'KM/H';

    ctx.save();

    // Fondo del panel
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 8);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.85)';
    ctx.fill();
    ctx.strokeStyle = CockpitColors.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Número grande
    ctx.font = 'black 48px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const numX = x + 16;
    const numY = y + height - 36;

    if (isAvailable && displaySpeed !== null) {
      ctx.fillStyle = CockpitColors.neonGreen;
      ctx.fillText(displaySpeed.toFixed(1), numX, numY);
    } else {
      ctx.fillStyle = CockpitColors.textMuted;
      ctx.fillText('N/D', numX, numY);
    }

    // Unidad
    ctx.font = 'bold 13px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = CockpitColors.textSecondary;
    ctx.fillText(unitLabel, x + width - 52, y + 42);

    // Etiqueta de fuente (GPS SPEED / OBD SPEED)
    ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace';
    ctx.fillStyle = isAvailable ? CockpitColors.neonCyan : CockpitColors.textMuted;
    ctx.fillText(sourceLabel, numX, y + height - 14);

    ctx.restore();
  }
}
