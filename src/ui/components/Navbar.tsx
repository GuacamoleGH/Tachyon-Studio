import React from 'react';
import { Gauge, Upload, Zap } from 'lucide-react';

interface NavbarProps {
  sessionTitle?: string;
  onOpenZipClick: () => void;
  onLoadSyntheticClick: () => void;
  isLoading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  sessionTitle,
  onOpenZipClick,
  onLoadSyntheticClick,
  isLoading,
}) => {
  return (
    <header className="border-b border-[#2C3947] bg-[#13181E] px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-md">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#1A222B] border border-[#2C3947] text-[#00E676] shadow-[0_0_12px_rgba(0,230,118,0.25)]">
          <Gauge className="w-5 h-5 stroke-[2.2]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-black tracking-wider text-base text-[#F0F4F8] font-mono">
              TACHYON<span className="text-[#00E676]">.</span>STUDIO
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-[#1A222B] text-[#00E5FF] border border-[#2C3947]">
              v0.1 PC
            </span>
          </div>
          <p className="text-xs text-[#8B9CB0] truncate max-w-md">
            {sessionTitle ? (
              <span className="text-[#F0F4F8] font-medium">{sessionTitle}</span>
            ) : (
              'Herramienta de análisis y renderizado de telemetría'
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onLoadSyntheticClick}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1A222B] hover:bg-[#2C3947] text-[#8B9CB0] hover:text-[#F0F4F8] border border-[#2C3947] transition-all cursor-pointer disabled:opacity-50"
          title="Carga la sesión sintética con casos difíciles (cortes GPS, OBD y offset negativo)"
        >
          <Zap className="w-3.5 h-3.5 text-[#FFB300]" />
          <span>Cargar muestra sintética</span>
        </button>

        <button
          onClick={onOpenZipClick}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold bg-[#00E676] hover:bg-[#00c864] text-[#090C0E] shadow-[0_0_15px_rgba(0,230,118,0.3)] transition-all cursor-pointer disabled:opacity-50"
        >
          <Upload className="w-4 h-4 stroke-[2.5]" />
          <span>Importar ZIP</span>
        </button>
      </div>
    </header>
  );
};
