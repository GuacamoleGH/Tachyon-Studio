import { BaseWidget, WidgetBounds, WidgetRenderContext } from './types';
import { CockpitColors } from '../../core/theme/colors';

export class ShiftLightsWidget implements BaseWidget {
  public id: string = 'shift_lights';
  public type = 'shift_lights' as const;
  public name: string = 'Barra de Luces de Cambio (Shift Lights)';
  public bounds: WidgetBounds;
  public visible: boolean = true;

  constructor(bounds: WidgetBounds = { x: 300, y: 30, width: 340, height: 46 }) {
    this.bounds = bounds;
  }

  public render(context: WidgetRenderContext): void {
    if (!this.visible) return;
    const { ctx, snapshot, profile, timeSec } = context;
    const { x, y, width, height } = this.bounds;

    const shiftCfg = profile.shift_lights;
    if (!shiftCfg.enabled) return;

    const rawRpm = snapshot.rpm;
    const isAvailable = snapshot.rpmAvailable && rawRpm !== null;

    const ledCount = shiftCfg.led_count || 10;
    const startRpm = shiftCfg.start_rpm;
    const allOnRpm = shiftCfg.all_on_rpm;
    const flashRpm = shiftCfg.flash_rpm;
    const flashHz = shiftCfg.flash_hz || 8;

    const isShift = isAvailable && rawRpm! >= flashRpm;
    // Parpadeo estroboscópico determinista dependiente únicamente del tiempo de vídeo
    const flashState = (Math.floor(timeSec * flashHz) % 2 === 0);

    ctx.save();

    // Fondo del panel de shift lights
    ctx.beginPath();
    const borderColor = isShift && flashState ? CockpitColors.neonRed : CockpitColors.border;
    ctx.roundRect(x, y, width, height, 8);
    ctx.fillStyle = 'rgba(19, 24, 30, 0.9)';
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Determinar cuántos LEDs deben encenderse (0 a ledCount)
    let activeLeds = 0;
    if (isAvailable) {
      if (rawRpm! < startRpm) {
        activeLeds = 0;
      } else if (rawRpm! >= allOnRpm) {
        activeLeds = ledCount;
      } else {
        const ratio = (rawRpm! - startRpm) / Math.max(1, allOnRpm - startRpm);
        activeLeds = Math.min(ledCount, Math.max(1, Math.round(ratio * ledCount)));
      }
    }

    // Dibujar los LEDs individuales
    const paddingX = 14;
    const availableW = width - paddingX * 2;
    const gap = 6;
    const ledW = (availableW - (ledCount - 1) * gap) / ledCount;
    const ledH = height - 18;
    const ledY = y + 9;

    for (let i = 0; i < ledCount; i++) {
      let isLedOn = false;

      // Calcular si el LED i está encendido según el patrón
      if (shiftCfg.pattern === 'center_out') {
        const center = (ledCount - 1) / 2;
        const distFromCenter = Math.abs(i - center);
        const maxDist = center;
        const threshold = (activeLeds / ledCount) * maxDist;
        isLedOn = distFromCenter <= threshold;
      } else if (shiftCfg.pattern === 'right_to_left') {
        isLedOn = (ledCount - 1 - i) < activeLeds;
      } else {
        // left_to_right por defecto
        isLedOn = i < activeLeds;
      }

      // Determinar color del LED según rangos
      let color = shiftCfg.off_color || '#1F2937';
      if (isLedOn) {
        if (isShift) {
          color = flashState ? '#FFFFFF' : '#FF1744';
        } else {
          // Buscar color en la lista configurada
          const found = shiftCfg.colors.find((c) => i >= c.fromLed && i <= c.toLed);
          color = found ? found.color : CockpitColors.neonGreen;
        }
      }

      const ledX = x + paddingX + i * (ledW + gap);

      ctx.beginPath();
      ctx.roundRect(ledX, ledY, ledW, ledH, 4);
      ctx.fillStyle = color;
      ctx.fill();

      // Borde sutil del LED
      ctx.strokeStyle = isLedOn ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Cartel "⚡ SHIFT!" parpadeante a la derecha o superpuesto
    if (isShift && flashState) {
      const badgeW = 75;
      const badgeH = 26;
      const badgeX = x + width + 8;
      const badgeY = y + (height - badgeH) / 2;

      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
      ctx.fillStyle = CockpitColors.neonRed;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = 'black 12px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡ SHIFT!', badgeX + badgeW / 2, badgeY + badgeH / 2);
    }

    ctx.restore();
  }
}
