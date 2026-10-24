# Tachyon Studio 🏁

> Herramienta de PC 100% local para análisis, diseño de overlays y renderizado de telemetría automovilística sobre vídeo.

Complemento de escritorio de la aplicación Android **Tachyon**. Sin suscripciones, sin marcas de agua, sin subida de datos a servidores externos.

---

## ⚡ Características

* **100% Local & Privado:** Ejecución íntegramente en el navegador web local.
* **Importación de paquetes ZIP:** Descompresión y lectura ultrarrápida en memoria con `fflate`.
* **Detección automática de esquemas:**
  * Formato ancho oficial de Android (`time_offset_video_sec`, `gps_speed_kmh`, `lateral_g`, `engine_rpm`, etc.).
  * Formato disperso multi-fuente (`source: gps/imu/obd`).
  * Mapeador visual interactivo de cabeceras con conversiones automáticas de unidades ($m/s \rightarrow km/h$, $m/s^2 \rightarrow G$).
* **Diagnóstico de Sesión:**
  * Frecuencias efectivas reales por canal (Hz).
  * Detección de pérdidas de cobertura GPS y desconexiones OBD.
  * Respeto de la regla de oro: celda vacía = dato ausente (`null`), **nunca 0**.
* **Perfil de Tacómetro y Luces de Cambio:**
  * Lectura de `vehicle_config` (`max_rpm`, `redline_rpm`, `shift_light_rpm`).
  * Trazabilidad del origen de los parámetros (`session.json (App Android)` vs `Valores por defecto`).

---

## 🚀 Inicio Rápido

### Requisitos
* Node.js v18+ (recomendado Node 20+)
* Navegador moderno basado en Chromium (Google Chrome o Microsoft Edge recomendados)

### Instalación y ejecución
```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm run dev

# 3. Ejecutar pruebas unitarias
npm test

# 4. Compilar para producción
npm run build
```

---

## 🧪 Pruebas
Las pruebas unitarias automatizadas cubren:
* Parseo de CSV ancho oficial y disperso multi-fuente.
* Respeto estricto de celdas vacías como `null`.
* Detección automática y conversión de unidades en el mapeo de columnas.
* Importación de la sesión sintética con casos difíciles (offset negativo, cortes de señal, frecuencias heterogéneas).
* Resolución y trazabilidad del perfil de vehículo.
