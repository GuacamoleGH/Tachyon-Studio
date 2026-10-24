import React, { useState, useRef } from 'react';
import { SessionBundle } from './core/model/session';
import { importSessionZip } from './core/zip/zipImporter';
import { Navbar } from './ui/components/Navbar';
import { ZipDropzone } from './ui/components/ZipDropzone';
import { SessionSummaryScreen } from './ui/screens/SessionSummaryScreen';

export const App: React.FC = () => {
  const [session, setSession] = useState<SessionBundle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessFile = async (file: File | ArrayBuffer) => {
    setIsLoading(true);
    setError(null);
    setProgressPercent(5);
    setProgressText('Iniciando lectura del archivo...');

    try {
      const bundle = await importSessionZip(file, (step, pct) => {
        setProgressText(step);
        setProgressPercent(pct);
      });
      setSession(bundle);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Error desconocido al abrir el archivo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSynthetic = async () => {
    setIsLoading(true);
    setError(null);
    setProgressText('Descargando sesión sintética de pruebas...');
    setProgressPercent(10);

    try {
      const resp = await fetch('/samples/sesion_sintetica_prueba.zip');
      if (!resp.ok) {
        throw new Error('No se pudo cargar la sesión de prueba desde /samples/sesion_sintetica_prueba.zip');
      }
      const buffer = await resp.arrayBuffer();
      await handleProcessFile(buffer);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Error al cargar la muestra de prueba.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090C0E] text-[#F0F4F8] flex flex-col font-sans selection:bg-[#00E676] selection:text-[#090C0E]">
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleProcessFile(e.target.files[0]);
          }
        }}
      />

      <Navbar
        sessionTitle={session?.title}
        onOpenZipClick={() => fileInputRef.current?.click()}
        onLoadSyntheticClick={handleLoadSynthetic}
        isLoading={isLoading}
      />

      <main className="flex-1 pb-16">
        {!session ? (
          <ZipDropzone
            onFileSelected={handleProcessFile}
            onLoadSynthetic={handleLoadSynthetic}
            isLoading={isLoading}
            progressText={progressText}
            progressPercent={progressPercent}
            error={error}
          />
        ) : (
          <SessionSummaryScreen session={session} onUpdateSession={setSession} />
        )}
      </main>
    </div>
  );
};
