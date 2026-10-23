/**
 * Módulo unificado de manejo y formateo de fechas y horas oficiales de Argentina (UTC-3).
 * Garantiza que la app mobile de mozos muestre exactamente la hora y el día del hotel Ceferino,
 * independientemente del huso horario configurado en el teléfono.
 */

export const ZONA_HORARIA_ARGENTINA = 'America/Argentina/Buenos_Aires';

/**
 * Hora de inicio y corte del día operativo del hotel/restaurante (04:00 AM).
 */
export const HORA_CORTE_OPERATIVO = 4;

/**
 * Normaliza un string ISO o Date interpretando cadenas sin indicador de zona horaria como UTC.
 */
export function parsearFechaUtc(val: string | Date | null | undefined): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  const s = String(val).trim();
  if (!s) return null;
  const iso = s.endsWith('Z') || /[+-]\d{2}(:\d{2})?$/.test(s) ? s : `${s}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Retorna la fecha del día operativo actual de Argentina en formato estándar ISO "YYYY-MM-DD"
 * (jornada de 04:00 AM a 04:00 AM del día siguiente).
 */
export function hoyArgentina(date: Date = new Date()): string {
  const fechaAjustada = new Date(date.getTime() - HORA_CORTE_OPERATIVO * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_ARGENTINA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fechaAjustada);
}

/**
 * Formatea la hora en zona horaria Argentina: "HH:mm" (24 horas).
 */
export function formatearHoraArgentina(val: string | Date | null | undefined): string {
  const d = parsearFechaUtc(val);
  if (!d) return '';
  return d.toLocaleTimeString('es-AR', {
    timeZone: ZONA_HORARIA_ARGENTINA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Formatea la fecha en zona horaria Argentina: "DD/MM/YYYY".
 */
export function formatearFechaArgentina(val: string | Date | null | undefined): string {
  const d = parsearFechaUtc(val);
  if (!d) return '';
  return d.toLocaleDateString('es-AR', {
    timeZone: ZONA_HORARIA_ARGENTINA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formatea fecha y hora en zona horaria Argentina: "DD/MM/YYYY, HH:mm".
 */
export function formatearFechaHoraArgentina(val: string | Date | null | undefined, incluirSegundos = false): string {
  const d = parsearFechaUtc(val);
  if (!d) return '';
  return d.toLocaleString('es-AR', {
    timeZone: ZONA_HORARIA_ARGENTINA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: incluirSegundos ? '2-digit' : undefined,
    hour12: false,
  });
}
