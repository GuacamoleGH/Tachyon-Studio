import * as fflate from 'fflate';
import {
  DEFAULT_VEHICLE_CONFIG,
  SessionBundle,
  SessionEvent,
  SessionMetadataRaw,
  SignalStats,
  VehicleConfigWithOrigin,
} from '../model/session';
import { STANDARD_SIGNALS, StandardSignalKey, TelemetryPoint } from '../model/telemetry';
import { parseTelemetryCsv } from '../csv/csvParser';

export interface ImportProgressCallback {
  (step: string, percentage: number): void;
}

/**
 * Importa y analiza por completo un paquete ZIP de sesión exportado por Tachyon.
 */
export async function importSessionZip(
  zipInput: File | Uint8Array | ArrayBuffer,
  onProgress?: ImportProgressCallback
): Promise<SessionBundle> {
  onProgress?.('Leyendo archivo ZIP...', 10);

  let zipBytes: Uint8Array;
  if (zipInput instanceof File) {
    const arrayBuffer = await zipInput.arrayBuffer();
    zipBytes = new Uint8Array(arrayBuffer);
  } else if (zipInput instanceof ArrayBuffer) {
    zipBytes = new Uint8Array(zipInput);
  } else {
    zipBytes = zipInput;
  }

  onProgress?.('Descomprimiendo archivos en memoria...', 30);
  const unzipped = fflate.unzipSync(zipBytes);

  // Buscar archivos dentro del ZIP (soportando mayúsculas/minúsculas o nombres en la raíz)
  const fileEntries = Object.keys(unzipped);

  const findEntry = (name: string): Uint8Array | null => {
    const key = fileEntries.find((f) => f.toLowerCase().endsWith(name.toLowerCase()));
    return key ? unzipped[key] : null;
  };

  const csvBytes = findEntry('telemetria.csv');
  if (!csvBytes) {
    throw new Error('El paquete ZIP no contiene el archivo requerido "telemetria.csv".');
  }

  const jsonBytes = findEntry('session.json');
  const gpxBytes = findEntry('ruta.gpx');
  const readmeBytes = findEntry('LEEME_SINCRONIZACION.txt');
  const videoBytes = findEntry('video.mp4');

  const textDecoder = new TextDecoder('utf-8');

  onProgress?.('Decodificando metadatos y telemetría...', 50);
  const rawCsvText = textDecoder.decode(csvBytes);
  const rawJsonText = jsonBytes ? textDecoder.decode(jsonBytes) : undefined;
  const rawGpxText = gpxBytes ? textDecoder.decode(gpxBytes) : undefined;
  const rawReadmeText = readmeBytes ? textDecoder.decode(readmeBytes) : undefined;

  let metadata: SessionMetadataRaw | undefined;
  if (rawJsonText) {
    try {
      metadata = JSON.parse(rawJsonText);
    } catch (e) {
      console.warn('No se pudo parsear session.json:', e);
    }
  }

  // 1. Resolver VehicleConfig y su origen de prioridad
  const vehicleConfigWithOrigin = resolveVehicleConfig(metadata);

  // 2. Parsear CSV y telemetría
  onProgress?.('Parseando CSV y normalizando señales...', 70);
  const csvResult = parseTelemetryCsv(rawCsvText);
  const points = csvResult.points;
  const timeRange = csvResult.timeRange;

  // 3. Preparar vídeo si existe
  let hasVideo = false;
  let videoBlob: Blob | undefined;
  let videoUrl: string | undefined;

  if (videoBytes && videoBytes.length > 0) {
    hasVideo = true;
    videoBlob = new Blob([new Uint8Array(videoBytes)], { type: 'video/mp4' });
    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      videoUrl = URL.createObjectURL(videoBlob);
    }
  } else if (metadata?.video_synchronization?.has_video) {
    hasVideo = true;
  }

  // 4. Calcular estadísticas de señales, frecuencias reales y detección de huecos
  onProgress?.('Analizando frecuencias reales y huecos temporales...', 85);
  const signalsStats = calculateSignalsStats(points, timeRange, metadata);

  // 5. Analizar y combinar eventos (del JSON o derivados de cortes de señal)
  const events = resolveEvents(metadata, signalsStats);

  // 6. Datos globales de la sesión
  const sessionId = metadata?.session?.id || metadata?.session_id || 'sesion-' + Date.now();
  const title = metadata?.session?.title || metadata?.vehicle?.name || 'Sesión de Telemetría';
  const startTimeIso =
    metadata?.session?.start_time_iso ||
    metadata?.started_utc ||
    (points[0]?.timestamp_utc_ms ? new Date(points[0].timestamp_utc_ms).toISOString() : new Date().toISOString());

  const totalDurationSec =
    timeRange.maxSec > timeRange.minSec
      ? timeRange.maxSec - timeRange.minSec
      : metadata?.session?.duration_seconds || 0;

  const totalDistance =
    metadata?.session?.total_distance_meters ||
    metadata?.stats?.distance_m ||
    calculateDistanceMeters(points);

  const maxSpeed =
    metadata?.session?.max_speed_kmh ||
    metadata?.stats?.max_speed_kmh ||
    calculateMaxSpeed(points);

  const avgSpeed =
    metadata?.session?.avg_speed_kmh ||
    metadata?.stats?.avg_speed_kmh ||
    (totalDurationSec > 0 ? (totalDistance / 1000) / (totalDurationSec / 3600) : 0);

  onProgress?.('¡Importación completada!', 100);

  return {
    id: sessionId,
    title,
    startTimeIso,
    durationSec: totalDurationSec,
    totalDistanceMeters: totalDistance,
    maxSpeedKmh: maxSpeed,
    avgSpeedKmh: avgSpeed,
    totalPoints: points.length,
    hasVideo,
    videoFileName: hasVideo ? 'video.mp4' : undefined,
    videoBlob,
    videoUrl,
    rawCsvText,
    points,
    timeRange,
    rawJsonText,
    metadata,
    rawGpxText,
    rawReadmeText,
    vehicleConfigWithOrigin,
    signalsStats,
    events,
    csvFormat: csvResult.mappingConfig.detectedFormat,
  };
}

/**
 * Resuelve la configuración del vehículo respetando la prioridad establecida.
 */
export function resolveVehicleConfig(metadata?: SessionMetadataRaw): VehicleConfigWithOrigin {
  const vc = metadata?.vehicle_config;
  if (vc && typeof vc.max_rpm === 'number' && typeof vc.redline_rpm === 'number') {
    const maxRpm = vc.max_rpm > 0 ? vc.max_rpm : DEFAULT_VEHICLE_CONFIG.max_rpm;
    const redlineRpm = vc.redline_rpm > 0 ? vc.redline_rpm : DEFAULT_VEHICLE_CONFIG.redline_rpm;
    const shiftLightRpm =
      typeof vc.shift_light_rpm === 'number' && vc.shift_light_rpm > 0
        ? vc.shift_light_rpm
        : Math.max(1000, redlineRpm - 500);

    return {
      config: {
        max_rpm: maxRpm,
        redline_rpm: redlineRpm,
        shift_light_rpm: shiftLightRpm,
      },
      source: 'app',
      sourceDescription: 'session.json (App Android)',
    };
  }

  return {
    config: { ...DEFAULT_VEHICLE_CONFIG },
    source: 'default',
    sourceDescription: 'Valores estándar por defecto (7500 / 6500 / 6000 RPM)',
  };
}

/**
 * Calcula estadísticas avanzadas por señal: muestras válidas, frecuencias reales y huecos.
 */
function calculateSignalsStats(
  points: TelemetryPoint[],
  timeRange: { minSec: number; maxSec: number },
  metadata?: SessionMetadataRaw
): Record<StandardSignalKey, SignalStats> {
  const durationSec = Math.max(0.001, timeRange.maxSec - timeRange.minSec);
  const result = {} as Record<StandardSignalKey, SignalStats>;

  const signalKeys = Object.keys(STANDARD_SIGNALS) as StandardSignalKey[];

  for (const sigKey of signalKeys) {
    const def = STANDARD_SIGNALS[sigKey];
    let validCount = 0;
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;

    let lastValidTime: number | null = null;
    const gaps: Array<{ startSec: number; endSec: number; durationSec: number }> = [];
    let maxGapSec = 0;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const val = p[sigKey];

      if (val !== null && val !== undefined && typeof val === 'number') {
        validCount++;
        if (val < min) min = val;
        if (val > max) max = val;
        sum += val;

        if (lastValidTime !== null) {
          const gap = p.time_offset_video_sec - lastValidTime;
          if (gap > def.defaultMaxGapSec) {
            gaps.push({
              startSec: lastValidTime,
              endSec: p.time_offset_video_sec,
              durationSec: gap,
            });
            if (gap > maxGapSec) maxGapSec = gap;
          }
        }
        lastValidTime = p.time_offset_video_sec;
      }
    }

    const effectiveHz = validCount > 0 ? validCount / durationSec : 0;

    // Frecuencia nominal si viene en el JSON
    let nominalHz: number | undefined;
    if (metadata?.channels) {
      if (def.category === 'GPS' && metadata.channels.gps?.nominal_hz) {
        nominalHz = metadata.channels.gps.nominal_hz;
      } else if (def.category === 'IMU' && metadata.channels.imu?.nominal_hz) {
        nominalHz = metadata.channels.imu.nominal_hz;
      } else if (def.category === 'OBD' && metadata.channels.obd_rpm_pedal_speed?.nominal_hz) {
        nominalHz = metadata.channels.obd_rpm_pedal_speed.nominal_hz;
      }
    }

    result[sigKey] = {
      signalKey: sigKey,
      label: def.label,
      unit: def.unit,
      category: def.category,
      foundInCsv: validCount > 0,
      sampleCount: validCount,
      effectiveHz: Math.round(effectiveHz * 10) / 10,
      nominalHz,
      min: validCount > 0 && isFinite(min) ? Math.round(min * 100) / 100 : undefined,
      max: validCount > 0 && isFinite(max) ? Math.round(max * 100) / 100 : undefined,
      avg: validCount > 0 ? Math.round((sum / validCount) * 100) / 100 : undefined,
      gapCount: gaps.length,
      maxGapSec: Math.round(maxGapSec * 10) / 10,
      gaps,
    };
  }

  return result;
}

/**
 * Combina eventos explícitos de session.json con huecos detectados automáticamente.
 */
function resolveEvents(
  metadata: SessionMetadataRaw | undefined,
  signalsStats: Record<StandardSignalKey, SignalStats>
): SessionEvent[] {
  const events: SessionEvent[] = [];

  // 1. Eventos explícitos del JSON si existen (e.g. sesión sintética)
  if (metadata?.events && Array.isArray(metadata.events)) {
    for (let i = 0; i < metadata.events.length; i++) {
      const e = metadata.events[i];
      const start = Number(e.start_sec);
      const end = Number(e.end_sec);
      const dur = end - start;
      const eventType =
        e.type === 'gps_lost' || e.type === 'obd_disconnected' || e.type === 'session_pause'
          ? e.type
          : 'custom';

      events.push({
        id: `json-event-${i}`,
        type: eventType,
        title:
          eventType === 'gps_lost'
            ? 'Pérdida de señal GPS'
            : eventType === 'obd_disconnected'
            ? 'Desconexión adaptador OBD-II'
            : e.description || e.type,
        startSec: start,
        endSec: end,
        durationSec: Math.round(dur * 10) / 10,
        source: 'app_json',
      });
    }
  }

  // 2. Si no hay eventos explícitos, agregar huecos notables detectados (> 3 segundos)
  if (events.length === 0) {
    const gpsGaps = signalsStats.latitude?.gaps || [];
    for (let i = 0; i < gpsGaps.length; i++) {
      const g = gpsGaps[i];
      if (g.durationSec >= 3.0) {
        events.push({
          id: `detected-gps-gap-${i}`,
          type: 'gps_lost',
          title: 'Corte de cobertura GPS detectado',
          startSec: g.startSec,
          endSec: g.endSec,
          durationSec: Math.round(g.durationSec * 10) / 10,
          source: 'detected_gap',
        });
      }
    }

    const obdGaps = signalsStats.engine_rpm?.gaps || [];
    for (let i = 0; i < obdGaps.length; i++) {
      const g = obdGaps[i];
      if (g.durationSec >= 2.0) {
        events.push({
          id: `detected-obd-gap-${i}`,
          type: 'obd_disconnected',
          title: 'Interrupción datos OBD-II detectada',
          startSec: g.startSec,
          endSec: g.endSec,
          durationSec: Math.round(g.durationSec * 10) / 10,
          source: 'detected_gap',
        });
      }
    }
  }

  events.sort((a, b) => a.startSec - b.startSec);
  return events;
}

function calculateDistanceMeters(points: TelemetryPoint[]): number {
  let total = 0;
  let lastLat: number | null = null;
  let lastLon: number | null = null;

  for (const p of points) {
    if (p.latitude != null && p.longitude != null) {
      if (lastLat != null && lastLon != null) {
        total += haversineDistanceMeters(lastLat, lastLon, p.latitude, p.longitude);
      }
      lastLat = p.latitude;
      lastLon = p.longitude;
    }
  }
  return Math.round(total * 10) / 10;
}

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateMaxSpeed(points: TelemetryPoint[]): number {
  let max = 0;
  for (const p of points) {
    const spd = p.gps_speed_kmh ?? p.obd_speed_kmh;
    if (spd != null && spd > max) {
      max = spd;
    }
  }
  return Math.round(max * 10) / 10;
}
