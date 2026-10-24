import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Gauge,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Save,
  Download,
  Upload,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  VehicleProfile,
  PRESET_GASOLINA_ESTANDAR,
  VEHICLE_PRESETS,
  validateVehicleProfile,
  saveProfileToStorage,
  deriveProfileFromAppConfig,
} from '../../core/profile/vehicleProfile';
import { TachometerCircularWidget } from '../../engine/widgets/TachometerWidget';
import { ShiftLightsWidget } from '../../engine/widgets/ShiftLightsWidget';
import { TelemetrySnapshot } from '../../core/telemetry/timeEngine';
import { STANDARD_SIGNALS, StandardSignalKey } from '../../core/model/telemetry';
import { SessionBundle } from '../../core/model/session';

interface VehicleProfileScreenProps {
  session?: SessionBundle | null;
  onProfileUpdated?: (profile: VehicleProfile) => void;
}

export const VehicleProfileScreen: React.FC<VehicleProfileScreenProps> = ({
  session,
  onProfileUpdated,
}) => {
  // Inicializar con el perfil de la sesión si existe, o preset estándar
  const initialProfile = session?.vehicleConfigWithOrigin
    ? deriveProfileFromAppConfig(session.vehicleConfigWithOrigin.config, 'Perfil de la Sesión')
    : PRESET_GASOLINA_ESTANDAR;

  const [profile, setProfile] = useState<VehicleProfile>(initialProfile);
  const [testRpm, setTestRpm] = useState<number>(profile.rpm.idle);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Instancias de widgets para la vista previa
  const tachWidget = useRef(new TachometerCircularWidget({ x: 40, y: 30, width: 280, height: 280 }));
  const shiftWidget = useRef(new ShiftLightsWidget({ x: 350, y: 70, width: 340, height: 50 }));

  const validation = validateVehicleProfile(profile);

  // Generar snapshot simulado para el canvas
  const getSimulatedSnapshot = useCallback(
    (rpm: number): TelemetrySnapshot => {
      const signals = {} as any;
      const allKeys = Object.keys(STANDARD_SIGNALS) as StandardSignalKey[];
      for (const k of allKeys) {
        signals[k] = {
          key: k,
          value: k === 'engine_rpm' ? rpm : 0,
          isAvailable: true,
          status: 'VALID',
          unit: '',
          category: 'OBD',
          label: '',
        };
      }

      return {
        timeSec: performance.now() / 1000,
        signals,
        activeEvents: [],
        speedKmh: 120,
        speedAvailable: true,
        rpm: rpm,
        rpmAvailable: true,
        throttlePct: Math.min(100, (rpm / profile.rpm.scale_max) * 100),
        throttleAvailable: true,
        lateralG: 0.1,
        lateralGAvailable: true,
        longitudinalG: 0.2,
        longitudinalGAvailable: true,
        derivedGpsLongG: null,
        derivedGpsLongGAvailable: false,
        latitude: null,
        longitude: null,
        gpsAvailable: false,
        bearingDeg: 0,
        bearingAvailable: false,
      };
    },
    [profile]
  );

  // Bucle de renderizado continuo de la vista previa del canvas (para parpadeos en tiempo real)
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderLoop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const snapshot = getSimulatedSnapshot(testRpm);
      const renderContext = {
        ctx,
        snapshot,
        profile,
        timeSec: performance.now() / 1000,
      };

      tachWidget.current.render(renderContext);
      shiftWidget.current.render(renderContext);

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [testRpm, profile, getSimulatedSnapshot]);

  const handlePresetSelect = (preset: VehicleProfile) => {
    setProfile(preset);
    setTestRpm(preset.rpm.idle);
    onProfileUpdated?.(preset);
  };

  const handleSaveToStorage = () => {
    saveProfileToStorage(profile);
    setSaveMessage('¡Perfil guardado en el navegador con éxito!');
    setTimeout(() => setSaveMessage(null), 3000);
    onProfileUpdated?.(profile);
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(profile, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vehiculo_${profile.name.toLowerCase().replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed.rpm && parsed.shift_lights) {
            setProfile(parsed);
            setTestRpm(parsed.rpm.idle || 850);
            onProfileUpdated?.(parsed);
          } else {
            alert('El archivo no contiene un perfil de vehículo válido.');
          }
        } catch (err) {
          alert('Error al leer el archivo JSON.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* 1. Cabecera */}
      <div className="bg-[#13181E] border border-[#2C3947] rounded-xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1A222B] border border-[#2C3947] flex items-center justify-center text-[#00E676]">
              <Gauge className="w-4 h-4 stroke-[2.2]" />
            </div>
            <h1 className="text-xl font-bold text-[#F0F4F8]">
              Calibración del Tacómetro y Luces de Cambio
            </h1>
          </div>
          <p className="text-xs text-[#8B9CB0] mt-1">
            Personaliza el rango de revoluciones y las shift lights para que el overlay reproduzca
            exactamente el tablero de tu coche.
          </p>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center gap-2">
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportJson}
          />
          <button
            onClick={() => jsonInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1A222B] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-all cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar JSON</span>
          </button>

          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1A222B] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar JSON</span>
          </button>

          <button
            onClick={handleSaveToStorage}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-[#00E676] hover:bg-[#00c864] text-[#090C0E] transition-all cursor-pointer shadow-[0_0_12px_rgba(0,230,118,0.2)]"
          >
            <Save className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Guardar Perfil</span>
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className="bg-[#00E676]/15 border border-[#00E676]/40 p-3 rounded-lg text-xs text-[#00E676] font-semibold animate-fadeIn">
          {saveMessage}
        </div>
      )}

      {/* 2. Selector de Presets */}
      <div className="bg-[#13181E] border border-[#2C3947] rounded-xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-mono text-[#8B9CB0] uppercase">Presets Rápidos:</span>
        <div className="flex flex-wrap gap-2">
          {VEHICLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetSelect(preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors ${
                profile.id === preset.id
                  ? 'bg-[#00E676]/15 text-[#00E676] border-[#00E676]/40'
                  : 'bg-[#1A222B] text-[#8B9CB0] hover:text-[#F0F4F8] border-[#2C3947]'
              }`}
            >
              <Sparkles className="w-3 h-3 inline mr-1" />
              {preset.name}
            </button>
          ))}
          {session?.vehicleConfigWithOrigin && (
            <button
              onClick={() =>
                handlePresetSelect(
                  deriveProfileFromAppConfig(session.vehicleConfigWithOrigin.config, 'App de Sesión')
                )
              }
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-[#1A222B] text-[#00E5FF] hover:bg-[#2C3947] border border-[#00E5FF]/40 transition-colors"
            >
              <Zap className="w-3 h-3 inline mr-1" />
              Restaurar de session.json
            </button>
          )}
        </div>
      </div>

      {/* 3. Panel de Simulación y Prueba en Vivo */}
      <div className="bg-[#13181E] border border-[#2C3947] rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#00E676]" />
            <h2 className="text-base font-bold text-[#F0F4F8]">
              Vista Previa en Vivo y Simulador de RPM
            </h2>
          </div>
          <span className="text-xs font-mono text-[#00E676] font-bold">
            Simulación activa: {Math.round(testRpm)} RPM
          </span>
        </div>

        {/* Canvas de dibujo interactivo */}
        <div className="bg-[#090C0E] border border-[#2C3947] rounded-xl p-2 flex justify-center items-center overflow-x-auto">
          <canvas ref={canvasRef} width={800} height={340} className="w-full max-w-[800px] h-auto" />
        </div>

        {/* Control deslizante de RPM para pruebas */}
        <div className="space-y-1.5 bg-[#1A222B] p-4 rounded-xl border border-[#2C3947]">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-[#8B9CB0]">Acelerar motor de prueba:</span>
            <span className="text-lg font-black text-[#00E5FF]">{Math.round(testRpm)} RPM</span>
          </div>

          <input
            type="range"
            min={0}
            max={profile.rpm.scale_max + 1000}
            step={50}
            value={testRpm}
            onChange={(e) => setTestRpm(parseFloat(e.target.value))}
            className="w-full accent-[#00E676] cursor-pointer"
          />

          <div className="flex justify-between text-[10px] font-mono text-[#8B9CB0]">
            <span>0 RPM</span>
            <span>Ralentí: {profile.rpm.idle} RPM</span>
            <span className="text-[#FFB300]">Shift: {profile.shift_lights.flash_rpm} RPM</span>
            <span className="text-[#FF1744]">Redline: {profile.rpm.redline_start} RPM</span>
            <span>Escala: {profile.rpm.scale_max} RPM</span>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => setTestRpm(profile.rpm.idle)}
              className="px-2.5 py-1 rounded text-xs font-mono bg-[#090C0E] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-colors"
            >
              Ralentí ({profile.rpm.idle})
            </button>
            <button
              onClick={() => setTestRpm(profile.shift_lights.start_rpm)}
              className="px-2.5 py-1 rounded text-xs font-mono bg-[#090C0E] hover:bg-[#2C3947] text-[#00E676] border border-[#2C3947] transition-colors"
            >
              Inicio Luces ({profile.shift_lights.start_rpm})
            </button>
            <button
              onClick={() => setTestRpm(profile.shift_lights.flash_rpm)}
              className="px-2.5 py-1 rounded text-xs font-mono bg-[#090C0E] hover:bg-[#2C3947] text-[#FFB300] border border-[#2C3947] transition-colors"
            >
              Aviso Shift ({profile.shift_lights.flash_rpm})
            </button>
            <button
              onClick={() => setTestRpm(profile.rpm.redline_start)}
              className="px-2.5 py-1 rounded text-xs font-mono bg-[#090C0E] hover:bg-[#2C3947] text-[#FF1744] border border-[#2C3947] transition-colors"
            >
              Corte Redline ({profile.rpm.redline_start})
            </button>
          </div>
        </div>
      </div>

      {/* 4. Validación de coherencia física */}
      {!validation.isValid ? (
        <div className="bg-[#FF1744]/15 border border-[#FF1744]/40 p-4 rounded-xl text-xs text-[#FF1744] space-y-1 animate-fadeIn">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="w-4 h-4" />
            Incoherencias detectadas en la configuración:
          </div>
          <ul className="list-disc list-inside space-y-0.5 pt-1">
            {validation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="bg-[#00E676]/10 border border-[#00E676]/30 p-3 rounded-xl text-xs text-[#00E676] flex items-center gap-2 animate-fadeIn font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Configuración coherente: idle &lt; start_rpm &le; all_on_rpm &le; flash_rpm &le; scale_max
          y redline_start &le; scale_max.
        </div>
      )}

      {/* 5. Parámetros Editables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Parámetros del Tacómetro */}
        <div className="bg-[#13181E] border border-[#2C3947] rounded-xl p-5 shadow-lg space-y-4">
          <h3 className="text-sm font-bold text-[#F0F4F8] uppercase tracking-wider font-mono border-b border-[#2C3947] pb-2">
            1. Escala del Tacómetro (RPM)
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[#8B9CB0] mb-1 font-mono">Nombre del Perfil:</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#F0F4F8] font-mono focus:border-[#00E676] outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#8B9CB0] mb-1 font-mono">Escala Máxima (scale_max):</label>
                <input
                  type="number"
                  step={100}
                  value={profile.rpm.scale_max}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      rpm: { ...profile.rpm, scale_max: parseInt(e.target.value) || 0 },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#F0F4F8] font-mono focus:border-[#00E676] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#FF1744] mb-1 font-mono">Inicio Zona Roja (redline):</label>
                <input
                  type="number"
                  step={100}
                  value={profile.rpm.redline_start}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      rpm: { ...profile.rpm, redline_start: parseInt(e.target.value) || 0 },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#FF1744] font-mono focus:border-[#FF1744] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#8B9CB0] mb-1 font-mono">Ralentí (idle):</label>
                <input
                  type="number"
                  step={50}
                  value={profile.rpm.idle}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      rpm: { ...profile.rpm, idle: parseInt(e.target.value) || 0 },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#F0F4F8] font-mono focus:border-[#00E676] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#8B9CB0] mb-1 font-mono">Divisor Etiquetas:</label>
                <input
                  type="number"
                  step={100}
                  value={profile.rpm.label_divisor}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      rpm: { ...profile.rpm, label_divisor: parseInt(e.target.value) || 1000 },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#F0F4F8] font-mono focus:border-[#00E676] outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Parámetros de las Luces de Cambio */}
        <div className="bg-[#13181E] border border-[#2C3947] rounded-xl p-5 shadow-lg space-y-4">
          <h3 className="text-sm font-bold text-[#F0F4F8] uppercase tracking-wider font-mono border-b border-[#2C3947] pb-2">
            2. Luces de Cambio (Shift Lights)
          </h3>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#00E676] mb-1 font-mono">Primera Luz (start_rpm):</label>
                <input
                  type="number"
                  step={100}
                  value={profile.shift_lights.start_rpm}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      shift_lights: {
                        ...profile.shift_lights,
                        start_rpm: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#00E676] font-mono focus:border-[#00E676] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#FFB300] mb-1 font-mono">Todas Fijas (all_on_rpm):</label>
                <input
                  type="number"
                  step={100}
                  value={profile.shift_lights.all_on_rpm}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      shift_lights: {
                        ...profile.shift_lights,
                        all_on_rpm: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#FFB300] font-mono focus:border-[#FFB300] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#FF1744] mb-1 font-mono">
                  Aviso Flash SHIFT! (flash_rpm):
                </label>
                <input
                  type="number"
                  step={100}
                  value={profile.shift_lights.flash_rpm}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      shift_lights: {
                        ...profile.shift_lights,
                        flash_rpm: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#FF1744] font-mono focus:border-[#FF1744] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#8B9CB0] mb-1 font-mono">Frecuencia Flash (Hz):</label>
                <input
                  type="number"
                  step={1}
                  min={2}
                  max={20}
                  value={profile.shift_lights.flash_hz}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      shift_lights: {
                        ...profile.shift_lights,
                        flash_hz: parseInt(e.target.value) || 8,
                      },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#F0F4F8] font-mono focus:border-[#00E676] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#8B9CB0] mb-1 font-mono">Nº de LEDs:</label>
                <input
                  type="number"
                  min={4}
                  max={24}
                  value={profile.shift_lights.led_count}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      shift_lights: {
                        ...profile.shift_lights,
                        led_count: parseInt(e.target.value) || 10,
                      },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#F0F4F8] font-mono focus:border-[#00E676] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#8B9CB0] mb-1 font-mono">Patrón de Encendido:</label>
                <select
                  value={profile.shift_lights.pattern}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      shift_lights: {
                        ...profile.shift_lights,
                        pattern: e.target.value as any,
                      },
                    })
                  }
                  className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-3 py-2 text-[#F0F4F8] font-mono focus:border-[#00E676] outline-none"
                >
                  <option value="left_to_right">De Izquierda a Derecha</option>
                  <option value="center_out">Del Centro hacia Afuera (GT3 / F1)</option>
                  <option value="right_to_left">De Derecha a Izquierda</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
