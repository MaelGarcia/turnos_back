import { addKeyword } from '@builderbot/bot'
import { greetByTime, EMO, pick, say } from '../../tools/humanize'
import { validarRFC, validarCURP } from '../../tools/tools'
import { registrarInteraccion, generarTurno, verificarTurnoHoy } from '../../db/coneccion_wbd'
import { query } from '../../db/config'
/* import { io } from 'socket.io-client'; */

const TABLE_SUCURSAL = process.env.TABLE_SUCURSALES
const URL_COSTOS = process.env.URL_COSTOS
/* const SERVICE_API = `http://localhost:${process.env.EXPRESS_PORT}`
const socket = io(SERVICE_API); */

export const flowRespuestaLicencias = addKeyword(['1', '2', '3', '0', 'TURNO']).addAnswer(
  '',
  { capture: true },
  async (ctx, { flowDynamic }) => {
    console.log('✅ Entré en flowRespuestaLicencias')
    console.log('👉 Mensaje recibido:', ctx.body)
    await say(ctx, flowDynamic, '📩 Recibí tu mensaje, estoy dentro del flujo hijo de *Licencias*.')
  }
)

// Costos: la propia librería ya maneja el envío, aquí no hace falta lógica extra
export const flowCostos = addKeyword(['2', 'dos', 'COSTO', 'COSTOS', 'costo', 'costos']).addAnswer(
  ['🙌 Estos son los costos y requisitos actualizados'],
  {
    media: URL_COSTOS,
    capture: true,
  },
  null,
  []
)

export const flowTurno = addKeyword(['1', 'uno', 'TURNO', 'turno', 'TURNOS', 'turnos']).addAnswer(
  'MUY BIEN. ENVÍA TU RFC (13 caracteres, sin espacios).',
  { capture: true },
  async (ctx, { state, flowDynamic, fallBack }) => {
    const entrada = ctx.body
    const res = validarCURP(entrada)
    let curp = ''
    let nombre = ''
    let celular = ''
    let sucursal: string | undefined

    // RFC inválido
    if (!res.ok) {
      await say(ctx, flowDynamic, '❌ Inténtalo de nuevo. Envía solo tu CURP.')
      return fallBack()
    }

    await say(ctx, flowDynamic, `✅ CURP VÁLIDO: ${res.curp}`)
    await say(ctx, flowDynamic, `⏳ Verificando disponibilidad de TURNO ...`)

    try {
      const { id_sucursal } = (await state.getMyState()) ?? {}

      curp = res.curp
      nombre = ctx.pushName || ctx.notifyName || 'SIN_NOMBRE'
      celular = ctx.from
      sucursal = id_sucursal

      const id_registro = await registrarInteraccion({ curp, nombre, celular })
      const turno = await generarTurno({ id_registro, id_sucursal, celular })

      await say(ctx, flowDynamic, `📋 Se ha generado tu turno:`)
      await say(
        ctx,
        flowDynamic,
        `🏷️ Turno: ${turno.numero_turno}\n` +
          `🔐 Código: ${turno.codigo_seguridad}\n` +
          `🏢 Sucursal: ${turno.sucursal}\n` +
          `⏳ Tiempo estimado: ${turno.tiempoEstimado}`
      )
    } catch (err: any) {
      // restricción: un solo turno por día
      if (err.code === '23505' && err.constraint === 'ix_turnos_uno_por_dia') {
        const t = await verificarTurnoHoy(celular)
        if (t) {
          await say(
            ctx,
            flowDynamic,
            '📅 Ya tienes un turno asignado hoy, desde este dispositivo.'
          )
          return
        }
        await say(ctx, flowDynamic, '📅 Ya tienes un turno asignado hoy.')
        return
      }

      console.error('Error en flowTurno:', err)
      await say(
        ctx,
        flowDynamic,
        '⚠️ Ocurrió un error al generar tu turno. Por favor, intenta de nuevo más tarde.'
      )
      return
    }
  },
  []
)

export const flowLicencias = addKeyword(['1', 'licencia', 'licencias'])
  .addAnswer(['¿Qué servicio de Licencias necesitas?'])
  .addAnswer(
    ['*1️⃣ Solicitar turno*', '*2️⃣ Costos y Requisitos*', '*3️⃣ Hablar con un Ejecutivo*'],
    { capture: true },
    async (ctx, { gotoFlow, fallBack, flowDynamic }) => {
      const msg = String(ctx.body || '').trim().toLowerCase()
      const digit = msg.match(/\d+/)?.[0]

      if (digit === '1' || msg.includes('licenc')) return gotoFlow(flowTurno)
      if (digit === '2' || msg.includes('cost')) return gotoFlow(flowCostos)
      if (digit === '3' || msg.includes('ejecutiv')) {
        await say(ctx, flowDynamic, '📞 Te voy a canalizar con un ejecutivo (en construcción).')
        return fallBack() 
      }

      await say(ctx, flowDynamic, '❌ Esa opción no existe. Responde *1*, *2* o *3*.')
      return fallBack()
    },
    [flowTurno, flowCostos]
  )

export const flowPlacas = addKeyword(['2', 'placa', 'placas']).addAnswer([
  '🚧 En construcción ...',
])

export const flowPrincipal = addKeyword(['SUCURSAL', 'sucursal'])
  .addAction(async (ctx, { endFlow, state, flowDynamic }) => {
    const raw = String(ctx.body || '').trim()
    const match = raw.match(/sucursal\s*(\d{3})/i)
    const digits = match?.[1] ?? ''

    if (!digits) {
      await say(
        ctx,
        flowDynamic,
        'Formato inválido. Escribe *SUCURSAL023* (tres dígitos) o escanea el QR.'
      )
      return endFlow()
    }

    try {
      const sql = `
        SELECT id_sucursal, codigo, nombre, estatus
        FROM ${TABLE_SUCURSAL}
        WHERE codigo = $1
      `
      const { rows } = await query(sql, [digits])

      if (!rows.length) {
        await say(ctx, flowDynamic, `🏚️ SUCURSAL INEXISTENTE *${digits}*.`)
        return endFlow()
      }

      const s = rows[0]
      if (s.estatus !== 'DISPONIBLE') {
        await say(
          ctx,
          flowDynamic,
          `La sucursal ${s.codigo} – ${s.nombre} está *${s.estatus}* en este momento.`
        )
        return endFlow()
      }

      ctx._codigoSucursal = s.codigo

      await state.update({ id_sucursal: s.id_sucursal, nombre_sucursal: s.nombre })
    } catch (err) {
      console.error('Error SQL:', err)
      await say(ctx, flowDynamic, 'Error interno al consultar la base de datos.')
      return endFlow()
    }
  })

  // Acción 2: saludo personalizado por sucursal
  .addAction(async (ctx, { flowDynamic }) => {
    const codigo =
      ctx._codigoSucursal ?? String(ctx.body || '').match(/sucursal\s*(\d{3})/i)?.[1] ?? ''
    if (!codigo) return

    const sql = `
      SELECT nombre
      FROM ${TABLE_SUCURSAL}
      WHERE codigo = $1
    `
    const { rows } = await query(sql, [codigo])
    const nombre = rows[0]?.nombre ?? `Sucursal ${codigo}`

    await say(ctx, flowDynamic, `${pick(EMO.wave)} ${greetByTime()} — Bienvenido a *${nombre}*.`)
  })

  // Menú principal
  .addAnswer(
    ['Elige una opción:', '*1️⃣ Servicios de Licencias*', '*2️⃣ Servicios de Placas*'],
    { capture: true },
    async (ctx, { gotoFlow, fallBack, flowDynamic }) => {
      const msg = String(ctx.body || '').trim().toLowerCase()
      const digit = msg.match(/\d+/)?.[0]

      if (digit === '1' || msg.includes('licenc')) return gotoFlow(flowLicencias)
      if (digit === '2' || msg.includes('plac')) return gotoFlow(flowPlacas)

      await say(ctx, flowDynamic, '❌ Esa opción no existe. Responde *1* o *2*.')
      return fallBack()
    },
    [flowLicencias, flowPlacas]
  )
