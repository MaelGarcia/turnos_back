import { EVENTS, addKeyword } from '@builderbot/bot'
import type { BotContext, TFlow } from '@builderbot/bot/dist/types'

const curpTimers = new Map<string, NodeJS.Timeout>();

function getKey(ctx: any) {
  // normalmente ctx.from o ctx.key.remoteJid
  return ctx.from;
}

export type MotivoInvalido = 'formato' | 'fecha'

/* export interface RFCResultOk {
  ok: true
  tipo: TipoRFC
  rfc: string
}

export interface RFCResultError {
  ok: false
  motivo: MotivoInvalido
} */


export type CURPResult = {
  ok: boolean;
  curp?: string;
  motivo?:
    | 'formato'
    | 'fecha'
    | 'sexo'
    | 'estado'
    | 'digitoVerificador';
};

export const idleCurpFlow = addKeyword(EVENTS.ACTION).addAction(
  async (ctx, { endFlow }) => {
    return endFlow(
      '⏱️ Se agotó el tiempo para ingresar tu CURP (más de 1 minuto). Se cierra la conversación.\n' +
      'Si necesitas otro turno, escanear el *QR* de tu sucursal nuevamente.'
    )
  }
)

export function startCurpTimer(
  ctx: any,
  flowDynamic: any,
  endFlow: any,
  timeoutMs: number
) {
  const key = getKey(ctx);
  stopCurpTimer(ctx);

  console.log('[CURP TIMER] Iniciado para', key, 'timeout:', timeoutMs, 'ms');

  const timer = setTimeout(async () => {
    console.log('[CURP TIMER] Tiempo excedido para', key);

    try {
      // Enviar mensaje usando flowDynamic
      await flowDynamic([
        {
          body:
            '⏳ Tiempo de espera excedido.\n' +
            'Si necesitas un turno, escanear el *QR* de tu sucursal nuevamente.',
        },
      ]);

      // Cerrar el flujo actual
      await endFlow();
    } catch (err) {
      console.error('[CURP TIMER] Error enviando mensaje de timeout:', err);
    }
  }, timeoutMs);

  curpTimers.set(key, timer);
}


export function resetCurpTimer(
  ctx: any,
  flowDynamic: any,
  endFlow: any,
  timeoutMs: number
) {
  console.log('[CURP TIMER] Reiniciado');
  startCurpTimer(ctx, flowDynamic, endFlow, timeoutMs);
}

// Detiene el timer (cuando ya no estamos esperando CURP)

export function stopCurpTimer(ctx: any) {
  const key = getKey(ctx);
  const timer = curpTimers.get(key);

  if (timer) {
    clearTimeout(timer);
    curpTimers.delete(key);
    console.log('[CURP TIMER] Detenido para', key);
  }
}


/* 
export type RFCResult = RFCResultOk | RFCResultError */

/**
 * Valida un RFC (persona moral o física) y devuelve tipo/rfc normalizado.
 * - Formato: 3-4 letras + YYMMDD + 3 alfanum.
 * - Verifica fecha real (no “31/02”, etc.)
 */
/* export function validarRFC(input: unknown): RFCResult {
  const rfc = String(input ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
  const re =
    /^([A-ZÑ&]{3,4})(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([A-Z0-9]{3})$/i

  const m = rfc.match(re)
  if (!m) return { ok: false, motivo: 'formato' }

  const [, prefijo, yy, mm, dd] = m
  const yyn = parseInt(yy, 10)
  // Rango pragmático: 00–39 → 2000–2039, 40–99 → 1940–1999
  const year = yyn <= 39 ? 2000 + yyn : 1900 + yyn
  const month = parseInt(mm, 10) - 1
  const day = parseInt(dd, 10)

  const fecha = new Date(year, month, day)
  const fechaOK =
    fecha.getFullYear() === year &&
    fecha.getMonth() === month &&
    fecha.getDate() === day

  if (!fechaOK) return { ok: false, motivo: 'fecha' }

  const tipo: TipoRFC = prefijo.length === 3 ? 'MORAL' : 'FISICA'
  return { ok: true, tipo, rfc }
}
 */

export function validarCURP(input: unknown): CURPResult {
  const curp = String(input ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')

  const re = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}$/

  if (!re.test(curp)) return { ok: false, motivo: 'formato' }

  return { ok: true, curp }
}

export function generarCodigoSeguridad(len: number = 6): string {
  const L = Math.max(1, Math.floor(len)) // sanea longitud
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < L; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

export function getFechaHoyMexico(): string {
  const fecha = new Date();

  // Opciones para obtener año, mes y día directamente en hora de México
  const opciones: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };

  // Formatear como "DD/MM/YYYY"
  const fechaMexicoStr = fecha.toLocaleDateString('es-MX', opciones); // "20/11/2025"

  // Convertir a "YYYY-MM-DD" para PostgreSQL
  const [dia, mes, anio] = fechaMexicoStr.split('/');
  return `${anio}-${mes}-${dia}`;
}
