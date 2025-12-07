export type TipoRFC = 'MORAL' | 'FISICA'
export type MotivoInvalido = 'formato' | 'fecha'

export interface RFCResultOk {
  ok: true
  tipo: TipoRFC
  rfc: string
}

export interface RFCResultError {
  ok: false
  motivo: MotivoInvalido
}


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

export type RFCResult = RFCResultOk | RFCResultError

/**
 * Valida un RFC (persona moral o física) y devuelve tipo/rfc normalizado.
 * - Formato: 3-4 letras + YYMMDD + 3 alfanum.
 * - Verifica fecha real (no “31/02”, etc.)
 */
export function validarRFC(input: unknown): RFCResult {
  const rfc = String(input ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')

  // Prefijo (3 o 4), fecha YYMMDD, homoclave (3)
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


export function validarCURP(input: unknown): CURPResult {
  const curp = String(input ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

  // 4 letras, fecha YYMMDD, sexo, estado, 3 consonantes, homoclave, dígito verificador
  const re =
    /^([A-Z][AEIOUX][A-Z]{2})(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([HM])(AS|BC|BS|CC|CS|CH|CL|CM|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE|CX)([B-DF-HJ-NP-TV-Z]{3})([A-Z0-9])(\d)$/;

  const m = curp.match(re);
  if (!m) return { ok: false, motivo: 'formato' };

  const [, , yy, mm, dd, sexo, estado] = m;

  // -------- Fecha --------
  const yyn = parseInt(yy, 10);
  // Mismo criterio pragmático que tu RFC: 00–39 → 2000–2039, 40–99 → 1940–1999
  const year = yyn <= 39 ? 2000 + yyn : 1900 + yyn;
  const month = parseInt(mm, 10) - 1;
  const day = parseInt(dd, 10);

  const fecha = new Date(year, month, day);
  const fechaOK =
    fecha.getFullYear() === year &&
    fecha.getMonth() === month &&
    fecha.getDate() === day;

  if (!fechaOK) return { ok: false, motivo: 'fecha' };

  // -------- Sexo (H/M) --------
  if (sexo !== 'H' && sexo !== 'M') {
    return { ok: false, motivo: 'sexo' };
  }

  // -------- Estado (ya lo valida el regex, pero por si quieres lógica extra) --------
  const estadosValidos = new Set([
    'AS',
    'BC',
    'BS',
    'CC',
    'CS',
    'CH',
    'CL',
    'CM',
    'DF',
    'DG',
    'GT',
    'GR',
    'HG',
    'JC',
    'MC',
    'MN',
    'MS',
    'NT',
    'NL',
    'OC',
    'PL',
    'QT',
    'QR',
    'SP',
    'SL',
    'SR',
    'TC',
    'TS',
    'TL',
    'VZ',
    'YN',
    'ZS',
    'NE',
    'CX' // CDMX moderna
  ]);

  if (!estadosValidos.has(estado)) {
    return { ok: false, motivo: 'estado' };
  }

  // -------- Dígito verificador --------
  // Algoritmo oficial RENAPO
  const caracteres = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  const dvEsperado = calcularDigitoVerificadorCURP(curp.slice(0, 17), caracteres);
  const dvReal = parseInt(curp[17], 10);

  if (dvEsperado !== dvReal) {
    return { ok: false, motivo: 'digitoVerificador' };
  }

  return { ok: true, curp };
}

function calcularDigitoVerificadorCURP(base17: string, caracteres: string): number {
  let suma = 0;

  for (let i = 0; i < 17; i++) {
    const c = base17[i];
    const valor = caracteres.indexOf(c);

    // Si aparece un caracter inválido, cortamos
    if (valor === -1) return -1;

    // Peso decreciente de 18 a 2
    suma += valor * (18 - (i + 1));
  }

  const resto = suma % 10;
  const digito = 10 - resto;

  return digito === 10 ? 0 : digito;
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
