import React, { useState, useRef } from 'react';
import {
  X,
  Film,
  Download,
  AlertCircle,
  HardDrive,
  CheckCircle2,
  Cpu,
  Layers,
  StopCircle,
  Clock,
} from 'lucide-react';
import { SessionBundle } from '../../core/model/session';
import { TimeEngine } from '../../core/telemetry/timeEngine';
import { OverlayRenderer } from '../../engine/canvas/overlayRenderer';
import { VehicleProfile } from '../../core/profile/vehicleProfile';
import {
  ExportMode,
  ExportProgress,
  isFileSystemAccessSupported,
  isWebCodecsSupported,
  VideoExporter,
} from '../../engine/export/videoExporter';

interface RenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: SessionBundle;
  profile: VehicleProfile;
  renderer: OverlayRenderer;
}

export const RenderModal: React.FC<RenderModalProps> = ({
  isOpen,
  onClose,
  session,
  profile,
  renderer,
}) => {
  const [mode, setMode] = useState<ExportMode>(
    session.hasVideo ? 'mp4_combined' : 'mp4_telemetry_only'
  );

  const duration = session.durationSec || 90.0;
  const [startSec, setStartSec] = useState<number>(0.0);
  const [endSec, setEndSec] = useState<number>(duration);
  const [fps, setFps] = useState<number>(60);
  const [resolution, setResolution] = useState<{ width: number; height: number }>({
    width: 1920,
    height: 1080,
  });
  const [bitrate, setBitrate] = useState<number>(14_000_000);
  const [useStreaming, setUseStreaming] = useState<boolean>(isFileSystemAccessSupported());

  // Estado del proceso de renderizado
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [fileSavedDirectly, setFileSavedDirectly] = useState<boolean>(false);

  const cancellationTokenRef = useRef<{ isCancelled: boolean }>({ isCancelled: false });
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);

  if (!isOpen) return null;

  const hasWebCodecs = isWebCodecsSupported();
  const hasFSA = isFileSystemAccessSupported();

  const handleStartRender = async () => {
    setIsRendering(true);
    setError(null);
    setOutputBlob(null);
    setFileSavedDirectly(false);
    cancellationTokenRef.current = { isCancelled: false };

    const engine = TimeEngine.fromBundle(session);

    try {
      const res = await VideoExporter.exportVideo(engine, renderer, profile, session.points, {
        mode,
        startSec,
        endSec,
        fps,
        width: resolution.width,
        height: resolution.height,
        bitrate,
        videoSourceElement: hiddenVideoRef.current,
        videoBlob: session.videoBlob,
        useFileSystemAccess: useStreaming && hasFSA,
        onProgress: setProgress,
        cancellationToken: cancellationTokenRef.current,
      });

      if (res.blob) {
        setOutputBlob(res.blob);
      }
      setFileSavedDirectly(res.fileSavedDirectly);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('cancelada')) {
        setProgress(null);
      } else {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Error desconocido durante el renderizado.');
      }
    } finally {
      setIsRendering(false);
    }
  };

  const handleCancel = () => {
    cancellationTokenRef.current.isCancelled = true;
    setIsRendering(false);
  };

  const handleDownloadBlob = () => {
    if (!outputBlob) return;
    const isWebm = mode === 'webm_transparent';
    const ext = isWebm ? 'webm' : 'mp4';
    const url = URL.createObjectURL(outputBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tachyon_${session.title.toLowerCase().replace(/\s+/g, '_')}_${resolution.width}p.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
      {/* Elemento de vídeo oculto para búsqueda de fotogramas en segundo plano */}
      {session.hasVideo && session.videoUrl && (
        <video
          ref={hiddenVideoRef}
          src={session.videoUrl}
          playsInline
          muted
          className="hidden"
          crossOrigin="anonymous"
        />
      )}

      <div className="bg-[#13181E] border border-[#2C3947] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-[#2C3947] flex items-center justify-between bg-[#1A222B]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#090C0E] border border-[#2C3947] flex items-center justify-center text-[#00E676]">
              <Cpu className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F0F4F8]">
                Exportar y Renderizar Vídeo (WebCodecs)
              </h2>
              <p className="text-xs text-[#8B9CB0]">
                Aceleración por hardware en el navegador. Sin servidores ni marcas de agua.
              </p>
            </div>
          </div>
          {!isRendering && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Contenido principal */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs font-mono">
          {!hasWebCodecs && (
            <div className="p-3 bg-[#FF1744]/15 border border-[#FF1744]/40 rounded-xl text-[#FF1744] flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Navegador no compatible con WebCodecs</span>
                Tu navegador no tiene la API VideoEncoder activa. Se recomienda Google Chrome o
                Microsoft Edge actualizados para procesar vídeo en local.
              </div>
            </div>
          )}

          {/* Estado de renderizado en progreso */}
          {isRendering && progress && (
            <div className="bg-[#1A222B] border border-[#2C3947] rounded-xl p-5 space-y-3 animate-fadeIn">
              <div className="flex justify-between items-center">
                <span className="text-[#00E5FF] font-bold text-sm flex items-center gap-2">
                  <Film className="w-4 h-4 animate-spin" />
                  {progress.status}
                </span>
                <span className="text-lg font-black text-[#00E676]">{progress.percent}%</span>
              </div>

              {/* Barra de progreso visual */}
              <div className="h-3 w-full bg-[#090C0E] rounded-full overflow-hidden border border-[#2C3947] p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-[#00E676] to-[#00E5FF] rounded-full transition-all duration-200"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              {/* Métricas de rendimiento en vivo */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-[#8B9CB0] text-center">
                <div className="bg-[#090C0E] p-2 rounded border border-[#2C3947]/70">
                  <span className="block text-[10px]">Fotogramas:</span>
                  <span className="text-[#F0F4F8] font-bold">
                    {progress.currentFrame} / {progress.totalFrames}
                  </span>
                </div>
                <div className="bg-[#090C0E] p-2 rounded border border-[#2C3947]/70">
                  <span className="block text-[10px]">Velocidad Real:</span>
                  <span className="text-[#00E676] font-bold">{progress.fpsEncoding} FPS</span>
                </div>
                <div className="bg-[#090C0E] p-2 rounded border border-[#2C3947]/70">
                  <span className="block text-[10px]">Tiempo Restante:</span>
                  <span className="text-[#FFB300] font-bold">{progress.etaSec}s</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF1744]/20 hover:bg-[#FF1744]/30 text-[#FF1744] border border-[#FF1744]/40 font-bold transition-colors cursor-pointer"
                >
                  <StopCircle className="w-4 h-4" />
                  <span>Cancelar Render</span>
                </button>
              </div>
            </div>
          )}

          {/* Resultado exitoso */}
          {!isRendering && (outputBlob || fileSavedDirectly) && (
            <div className="bg-[#00E676]/10 border border-[#00E676]/40 rounded-xl p-5 space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2.5 text-[#00E676] text-sm font-bold">
                <CheckCircle2 className="w-5 h-5" />
                <span>¡Vídeo renderizado con éxito!</span>
              </div>

              <p className="text-[#8B9CB0] text-xs">
                {fileSavedDirectly
                  ? 'El archivo ha sido guardado por streaming directamente en la ubicación que elegiste en tu disco.'
                  : 'El vídeo ha sido generado en memoria listo para ser descargado a tu carpeta.'}
              </p>

              {!fileSavedDirectly && outputBlob && (
                <button
                  onClick={handleDownloadBlob}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c864] text-[#090C0E] font-bold shadow-[0_0_15px_rgba(0,230,118,0.3)] transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Descargar archivo ({mode === 'webm_transparent' ? '.webm' : '.mp4'})</span>
                </button>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-[#FF1744]/15 border border-[#FF1744]/40 rounded-xl text-[#FF1744] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {/* Formulario de configuración (si no está renderizando) */}
          {!isRendering && !outputBlob && !fileSavedDirectly && (
            <div className="space-y-4">
              {/* 1. Modo de Exportación */}
              <div>
                <label className="block text-[#8B9CB0] uppercase mb-1.5 font-bold">
                  1. Formato y Modo de Salida:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div
                    onClick={() => setMode(session.hasVideo ? 'mp4_combined' : 'mp4_telemetry_only')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                      mode !== 'webm_transparent'
                        ? 'bg-[#1A222B] border-[#00E676] shadow-sm'
                        : 'bg-[#090C0E] border-[#2C3947] hover:border-[#3D4F63]'
                    }`}
                  >
                    <Film className="w-4 h-4 text-[#00E676] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[#F0F4F8] font-bold block">Vídeo Completo MP4</span>
                      <span className="text-[#8B9CB0] text-[11px] block mt-0.5">
                        {session.hasVideo
                          ? 'Vídeo original con los relojes incrustados (H.264 / AAC)'
                          : 'Vídeo con fondo negro de los instrumentos'}
                      </span>
                    </div>
                  </div>

                  <div
                    onClick={() => setMode('webm_transparent')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                      mode === 'webm_transparent'
                        ? 'bg-[#1A222B] border-[#00E5FF] shadow-sm'
                        : 'bg-[#090C0E] border-[#2C3947] hover:border-[#3D4F63]'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-[#00E5FF] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[#F0F4F8] font-bold block">Overlay Transparente WebM</span>
                      <span className="text-[#8B9CB0] text-[11px] block mt-0.5">
                        Fondo alfa transparente (VP9) para importar en DaVinci Resolve o Premiere.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Selección de Tramo */}
              <div className="bg-[#1A222B] p-3.5 rounded-xl border border-[#2C3947] space-y-2">
                <div className="flex justify-between items-center text-[#8B9CB0]">
                  <span className="font-bold flex items-center gap-1.5 uppercase">
                    <Clock className="w-3.5 h-3.5 text-[#00E5FF]" />
                    2. Selección de Tramo (Inicio y Fin):
                  </span>
                  <span className="text-[#00E676] font-bold">
                    Duración: {(endSec - startSec).toFixed(1)} segundos
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[#8B9CB0] text-[11px] mb-1">Segundo Inicial (t_start):</label>
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      max={endSec - 0.5}
                      value={startSec}
                      onChange={(e) => setStartSec(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-2.5 py-1.5 text-[#F0F4F8] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8B9CB0] text-[11px] mb-1">Segundo Final (t_end):</label>
                    <input
                      type="number"
                      step={0.5}
                      min={startSec + 0.5}
                      max={duration}
                      value={endSec}
                      onChange={(e) => setEndSec(Math.min(duration, parseFloat(e.target.value) || duration))}
                      className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-2.5 py-1.5 text-[#F0F4F8] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Parámetros de Calidad y Resolución */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#8B9CB0] mb-1 font-bold">Resolución:</label>
                  <select
                    value={`${resolution.width}x${resolution.height}`}
                    onChange={(e) => {
                      const [w, h] = e.target.value.split('x').map(Number);
                      setResolution({ width: w, height: h });
                    }}
                    className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-2.5 py-1.5 text-[#F0F4F8]"
                  >
                    <option value="1280x720">720p HD</option>
                    <option value="1920x1080">1080p Full HD</option>
                    <option value="3840x2160">4K Ultra HD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#8B9CB0] mb-1 font-bold">Tasa de Cuadros (FPS):</label>
                  <select
                    value={fps}
                    onChange={(e) => setFps(parseInt(e.target.value))}
                    className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-2.5 py-1.5 text-[#F0F4F8]"
                  >
                    <option value={30}>30 FPS (Estándar)</option>
                    <option value={60}>60 FPS (Ultra Suave)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#8B9CB0] mb-1 font-bold">Tasa de Bits (Bitrate):</label>
                  <select
                    value={bitrate}
                    onChange={(e) => setBitrate(parseInt(e.target.value))}
                    className="w-full bg-[#090C0E] border border-[#2C3947] rounded px-2.5 py-1.5 text-[#F0F4F8]"
                  >
                    <option value={8_000_000}>8 Mbps (Rápido)</option>
                    <option value={14_000_000}>14 Mbps (Alta Calidad)</option>
                    <option value={20_000_000}>20 Mbps (Competición)</option>
                  </select>
                </div>
              </div>

              {/* 4. Streaming a disco */}
              {hasFSA && (
                <div className="bg-[#1A222B] p-3 rounded-xl border border-[#2C3947] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <HardDrive className="w-4 h-4 text-[#00E5FF]" />
                    <div>
                      <span className="text-[#F0F4F8] font-bold block">
                        Streaming directo a disco (File System Access)
                      </span>
                      <span className="text-[#8B9CB0] text-[11px]">
                        Escribe los fotogramas directamente al almacenamiento evitando acumular datos en RAM.
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={useStreaming}
                    onChange={(e) => setUseStreaming(e.target.checked)}
                    className="w-4 h-4 accent-[#00E676] cursor-pointer"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#2C3947] bg-[#1A222B] flex items-center justify-end gap-3 font-mono">
          {!isRendering && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8B9CB0] hover:text-[#F0F4F8] hover:bg-[#2C3947] transition-colors"
            >
              {outputBlob || fileSavedDirectly ? 'Cerrar' : 'Cancelar'}
            </button>
          )}

          {!isRendering && !outputBlob && !fileSavedDirectly && (
            <button
              onClick={handleStartRender}
              disabled={!hasWebCodecs}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#00E676] hover:bg-[#00c864] text-[#090C0E] shadow-[0_0_15px_rgba(0,230,118,0.3)] transition-all cursor-pointer disabled:opacity-50"
            >
              <Cpu className="w-4 h-4 stroke-[2.5]" />
              <span>Iniciar Renderizado</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
