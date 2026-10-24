# Tachyon Studio 🏁

> Herramienta de PC 100% local para visualización, diseño de overlays e incrustación de telemetría automovilística sobre vídeo.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-purple?logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.0-cyan?logo=react)](https://react.dev/)
[![WebCodecs](https://img.shields.io/badge/WebCodecs-Hardware%20Accel-green)](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
[![Tests](https://img.shields.io/badge/Tests-31%2F31%20Passing-brightgreen?logo=vitest)](https://vitest.dev/)

**Tachyon Studio** es la herramienta de escritorio complementaria de la aplicación móvil nativa Android **Tachyon**. Permite descargar en el PC todo el trabajo pesado de renderizado, sincronización e instrumentación sin costes de procesamiento en el teléfono móvil, **sin cuentas, sin licencias, sin marcas de agua y sin subir ni un solo byte a ningún servidor externo**.

---

## 🏎️ Características Principales

### 1. Motor de Sincronización Determinista
* **Sincronización Sub-Frame:** Vincula la reproducción del vídeo con las marcas monotónicas de hardware (`time_offset_video_sec = 0.000` en el fotograma 0 del vídeo).
* **Tratamiento de Offset Negativo:** Maneja sin errores muestras registradas antes de pulsar grabar en la cámara ($t < 0.000\,\text{s}$).
* **Regla de Datos Crudos:** Las celdas vacías se interpretan estrictamente como `null` (**nunca como 0**). Si un sensor deja de emitir muestras, los widgets muestran `"N/D"` con estilo atenuado.
* **Separación de Aceleraciones:** Mantiene separada la aceleración inercial medida por el acelerómetro del móvil ($\text{G}$) de la aceleración longitudinal derivada de la velocidad GPS ($a = \frac{dv}{dt}$).

### 2. Perfil de Vehículo y Tacómetro Calibrado
* **El cuadro de instrumentos de tu coche:** Personaliza `scale_max`, `redline_start`, `shift_light_rpm` y ralentí (`idle`).
* **Shift Lights Progresivas:** Matriz de LEDs estilo volante de competición (Fórmula / GT3) con tres patrones (`center_out`, `left_to_right`, `right_to_left`).
* **Aviso Estroboscópico `⚡ SHIFT!`:** Al alcanzar el régimen de cambio, los LEDs y el marco parpadean a $8\,\text{Hz}$ sincronizados con el tiempo de vídeo.
* **Simulador de RPM en Vivo:** Pantalla de calibración con acelerador virtual para probar la respuesta de las luces y el corte sin necesidad de cargar un vídeo.
* **Prioridad de 4 Niveles:** Manuales en pantalla $>$ `session.json` de la app $>$ Perfil guardado en el navegador $>$ Presets por defecto.

### 3. Editor Visual de Plantillas (Estilo MyChron 5)
* **Arrastrar y Redimensionar Libremente:** Manadores en 8 direcciones y límites inteligentes sobre el lienzo.
* **Widgets Modulares Disponibles:**
  * Tacómetro Circular con arco de zona roja personalizada.
  * Barra de Shift Lights progresivas.
  * Velocímetro Digital de alta visibilidad ($\text{km/h}$ o $\text{mph}$).
  * Barra reactiva de acelerador / pedal ($0 \dots 100\%$).
  * G-Meter con círculo de fricción de Kamm y círculos de $0.5\text{G}$ y $1.0\text{G}$.
  * Trazada GPS con proyección de ruta y vector de rumbo.
  * Perfil de velocidad sobre el tiempo con cursor deslizante.
  * Cronómetro de tiempo transcurrido.
* **Exportación e Importación:** Guarda tus plantillas en formato `.json` versionado o guárdalas en `localStorage`.

### 4. Renderizado Acelerado por Hardware (WebCodecs)
* **Más Rápido que Tiempo Real:** Codificación por GPU utilizando `VideoEncoder` en Chromium.
* **Salida 1 — Vídeo Completo MP4:** Genera el archivo final en H.264/AAC con el overlay incrustado.
* **Salida 2 — Overlay Transparente WebM (VP9 con Canal Alfa):** Exporta únicamente los relojes sobre fondo transparente para importar directamente en DaVinci Resolve, Adobe Premiere o Final Cut.
* **Gestión de Memoria y Streaming a Disco (4K y Vídeos Largos):**
  * Utiliza la **File System Access API** (`showSaveFilePicker()`) para escribir los paquetes de vídeo directamente al disco.
  * Evita acumular gigabytes en la memoria RAM del navegador, permitiendo exportar vídeos largos y 4K sin riesgo de que la pestaña se cierre por desbordamiento de memoria.
* **Selección de Tramo y Control:** Selector de inicio y fin ($t_{\text{start}}$ a $t_{\text{end}}$), barra de progreso porcentual, FPS reales de codificación, cálculo de tiempo restante (ETA) y cancelación en cualquier momento.

---

## 📂 Formato de Entrada Soportado

Tachyon Studio importa directamente el archivo `.zip` que genera la app Android al pulsar **Exportar ZIP**:

| Archivo en el ZIP | Función |
| :--- | :--- |
| `video.mp4` | Vídeo original limpio grabado por CameraX (H.264). |
| `telemetria.csv` | Muestras de telemetría sincronizadas con `time_offset_video_sec`. |
| `session.json` | Metadatos de sesión y `vehicle_config` (`max_rpm`, `redline_rpm`, `shift_light_rpm`). |
| `ruta.gpx` | Trazado GPS estándar 1.1 con elevación y velocidad. |
| `LEEME_SINCRONIZACION.txt` | Documento de instrucciones de sincronización. |

### Detección Inteligente de Cabeceras
El importador detecta automáticamente:
1. **Formato Ancho Oficial de Android (20 columnas):** `time_offset_video_sec`, `time_offset_session_sec`, `timestamp_utc_ms`, `iso_time`, `monotonic_nanos`, `latitude`, `longitude`, `altitude_m`, `gps_speed_kmh`, `bearing_deg`, `accuracy_m`, `lateral_g`, `longitudinal_g`, `engine_rpm`, `obd_speed_kmh`, `throttle_pct`, `coolant_temp_c`, `accel_x`, `accel_y`, `accel_z`.
2. **Formato Disperso Multi-Fuente:** Archivos con columna `source: gps/imu/obd` y nombres tipo `lat`, `speed_ms`, `accel_lat_ms2` con conversión automática de unidades ($m/s \rightarrow km/h$, $m/s^2 \rightarrow \text{G}$).
3. **Mapeador Manual:** Modal interactivo para asociar columnas personalizadas a las señales internas del sistema ante cualquier formato desconocido.

---

## 🌐 Compatibilidad de Navegadores

| Navegador | Estado | Notas |
| :--- | :---: | :--- |
| **Google Chrome (v94+)** | 🟢 **Soporte Completo** | Recomendado. Soporte total de WebCodecs, `requestVideoFrameCallback` y File System Access API. |
| **Microsoft Edge (v94+)** | 🟢 **Soporte Completo** | Mismo motor Chromium que Chrome. Rendimiento óptimo en Windows. |
| **Brave / Opera / Vivaldi** | 🟢 **Soporte Completo** | Soporta codificación por hardware y streaming a disco. |
| **Mozilla Firefox** | 🟡 **Parcial** | WebCodecs está en desarrollo / tras flags. File System Access API restringido; fallback a descarga en memoria. |
| **Safari (macOS/iOS)** | 🟡 **Parcial** | Requiere habilitar WebCodecs en ajustes avanzados. No soporta File System Access API para streaming a disco. |

---

## 🛠️ Instalación y Desarrollo Local

### Requisitos Previos
* **Node.js**: Versión 18 o superior (recomendado Node 20 LTS o 22+).
* **NPM**: Gestor de paquetes incluido con Node.

### Comandos Rápidos

```bash
# 1. Clonar el repositorio
git clone https://github.com/GuacamoleGH/Tachyon-Studio.git
cd Tachyon-Studio

# 2. Instalar dependencias
npm install

# 3. Iniciar servidor de desarrollo local
npm run dev

# 4. Ejecutar todas las pruebas unitarias
npm test

# 5. Compilar para producción (TypeScript estricto + Vite)
npm run build
```

---

## 🧪 Pruebas Automatizadas

El proyecto cuenta con **31 pruebas unitarias** ejecutadas con Vitest que garantizan la integridad de todo el pipeline:

* `tests/csv-parser.test.ts`: Parseo de esquemas anchos y dispersos; validación de celdas vacías como `null`.
* `tests/column-mapper.test.ts`: Detección automática de cabeceras oficiales y sintéticas; conversiones de unidades.
* `tests/time-engine.test.ts`: Búsqueda binaria $O(\log N)$, interpolación lineal, interpolación angular cruzando $0^\circ/360^\circ$, detección de huecos `GAP_TIMEOUT`, eventos de bloqueo (`gps_lost`, `obd_disconnected`) y cálculo de aceleración derivada de GPS.
* `tests/vehicle-profile.test.ts`: Validación de coherencia física de perfiles, rechazo de rangos absurdos y derivación desde `VehicleConfig`.
* `tests/widgets.test.ts`: Renderizado en Canvas 2D de tacómetros, shift lights, velocímetros y G-Meter; recorte a `scale_max` y gestión de estados N/D.
* `tests/overlay-renderer.test.ts`: Carga de plantillas, escalado dinámico por resolución y determinismo.
* `tests/template.test.ts`: Serialización y deserialización de plantillas JSON v1.0.0.
* `tests/video-exporter.test.ts`: Detección de capacidades WebCodecs y empaquetado de contenedores MP4 y WebM con alfa.
* `tests/zip-import.test.ts`: Importación y verificación completa de la sesión sintética con casos difíciles (`samples/sesion_sintetica_prueba.zip`).
* `tests/real-session.test.ts`: Verificación completa con un paquete de exportación **REAL** de la app nativa Android.

---

## 🔒 Privacidad y Seguridad

* **100% Offline:** Tachyon Studio no realiza ninguna petición externa ni envía telemetría, ubicaciones o vídeos a la red.
* **Seguridad de Datos:** La carpeta `samples/real/` y los archivos de vídeo `.mp4` están excluidos en `.gitignore` para garantizar que nunca se versionen rutas GPS privadas ni grabaciones personales en repositorios públicos.

---

## ⚖️ Licencia

Distribuido bajo licencia MIT. Desarrollado como software libre para aficionados al automovilismo, tandas en circuito y análisis de conducción.
