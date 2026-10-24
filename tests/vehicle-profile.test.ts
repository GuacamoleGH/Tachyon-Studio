import { describe, it, expect } from 'vitest';
import {
  PRESET_GASOLINA_ESTANDAR,
  PRESET_DIESEL,
  PRESET_DEPORTIVO_ALTAS_VUELTAS,
  validateVehicleProfile,
  deriveProfileFromAppConfig,
  VehicleProfile,
} from '../src/core/profile/vehicleProfile';

describe('Vehicle Profile & Validation', () => {
  it('valida con éxito los presets estándar (gasolina, diesel, altas vueltas)', () => {
    expect(validateVehicleProfile(PRESET_GASOLINA_ESTANDAR).isValid).toBe(true);
    expect(validateVehicleProfile(PRESET_DIESEL).isValid).toBe(true);
    expect(validateVehicleProfile(PRESET_DEPORTIVO_ALTAS_VUELTAS).isValid).toBe(true);
  });

  it('detecta incoherencias físicas en el perfil y las rechaza', () => {
    const invalidProfile: VehicleProfile = {
      ...PRESET_GASOLINA_ESTANDAR,
      rpm: {
        ...PRESET_GASOLINA_ESTANDAR.rpm,
        scale_max: 6000,
        redline_start: 7000, // Error: redline > scale_max
        idle: 6500,          // Error: idle > scale_max
      },
      shift_lights: {
        ...PRESET_GASOLINA_ESTANDAR.shift_lights,
        start_rpm: 6500,
        all_on_rpm: 6200,    // Error: start_rpm > all_on_rpm
        flash_rpm: 8000,     // Error: flash_rpm > scale_max
      },
    };

    const res = validateVehicleProfile(invalidProfile);
    expect(res.isValid).toBe(false);
    expect(res.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('deriva un perfil completo con coherencia a partir de VehicleConfig de Android', () => {
    const appConfig = {
      max_rpm: 7500,
      redline_rpm: 6500,
      shift_light_rpm: 6000,
    };

    const derived = deriveProfileFromAppConfig(appConfig);
    expect(derived.rpm.scale_max).toBe(7500);
    expect(derived.rpm.redline_start).toBe(6500);
    expect(derived.shift_lights.flash_rpm).toBe(6000);
    expect(derived.shift_lights.start_rpm).toBeLessThan(derived.shift_lights.all_on_rpm);
    expect(derived.shift_lights.all_on_rpm).toBeLessThanOrEqual(derived.shift_lights.flash_rpm);

    const val = validateVehicleProfile(derived);
    expect(val.isValid).toBe(true);
  });
});
