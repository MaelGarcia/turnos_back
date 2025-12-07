import dotenv from 'dotenv'
dotenv.config()

const MIN_MS = Number(process.env.MIN_MS)
const MAX_MS = Number(process.env.MAX_MS)

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const clamp = (n: number, a: number, b: number): number => Math.max(a, Math.min(b, n))

function calcDelay(text = ''): number {
  const clean = String(text).trim()
  const chars = clean.length
  const words = clean.split(/\s+/).filter(Boolean).length
  const basePorChar = 50
  const basePorPalabra = 150

  const base = MIN_MS + chars * basePorChar + words * basePorPalabra

  const jitter = Math.floor(Math.random() * 600)

  return clamp(base + jitter, MIN_MS, MAX_MS)
}

function chunkText(text: string, size = 350): string[] {
  if (!text || text.length <= size) return [text]
  const parts: string[] = []
  let rest = text
  while (rest.length) {
    const cut =
      rest.lastIndexOf('\n', size) > 0
        ? rest.lastIndexOf('\n', size)
        : rest.lastIndexOf(' ', size)
    const idx = cut > 0 ? cut : Math.min(size, rest.length)
    parts.push(rest.slice(0, idx).trim())
    rest = rest.slice(idx).trim()
  }
  return parts.filter(Boolean)
}

async function typing(sock: any, jid: string, ms: number): Promise<void> {
  try {
    if (!sock || !jid) {
      await wait(ms) // sin presencia, pero respetamos el tiempo
      return
    }

    await sock?.presenceSubscribe?.(jid)
    await sock?.sendPresenceUpdate?.('composing', jid)
    await wait(ms)
    await sock?.sendPresenceUpdate?.('paused', jid)
  } catch {
    // silencioso
    await wait(ms)
  }
}

/**
 * Envía un texto simulando escritura humana (presencia + pausas + troceo)
 */
export async function say(
  ctx: any,
  flowDynamic: (text: string) => Promise<any>,
  text: string,
  deps?: { getSock?: () => any }
): Promise<void> {
  const sock = deps?.getSock?.()
  const jid = ctx?.from

  const partes = chunkText(text)

  for (const part of partes) {
    const delay = calcDelay(part)
    await typing(sock, jid, delay)
    await flowDynamic(part)

    // Pausa extra entre mensajes para no parecer metralleta
    const pausaEntreMensajes = 400 + Math.floor(Math.random() * 600) // 400–1000 ms
    await wait(pausaEntreMensajes)
  }
}

export function greetByTime(): string {
  const h = new Date().getHours()
  if (h < 12) return '🌅 Buenos días'
  if (h < 19) return '🌤️ Buenas tardes'
  return '🌙 Buenas noches'
}

export const EMO = {
  wave: ['👋', '🙌'],
  ok: ['✅', '✨', '👌'],
  warn: ['⚠️', '🤔'],
  err: ['❌', '🚫'],
} as const

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
