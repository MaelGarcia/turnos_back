// src/services/registrarInteraccion.ts
import 'dotenv/config'
import { query } from '../db/config' // Ajusta la ruta según tu proyecto
import {generarCodigoSeguridad,getFechaHoyMexico} from '../tools/tools'
import { getIO } from '../tools/socket';
// import { generarCodigoSeguridad } from '../tools/tools' // (opcional, no usado aquí)

/* type RegistrarInteraccionInput = {
  rfc: string
  nombre?: string
  celular: string
}
 */

type RegistrarInteraccionInput = {
  curp: string
  nombre?: string
  celular: string
}

type GenerarTurnoInput = {
  id_registro: number
  id_sucursal: number
  celular: string
}

type GenerarTurnoOutput = {
  numero_turno: string
  codigo_seguridad: string
  sucursal: string
  tiempoEstimado: string
}

export type TurnoHoy = {
  id_turnos: number
  numero_turno: string
  codigo_seguridad: string
  sucursal: string
  estado: 'pendiente' | 'atendido' | 'cancelado' | string
  hora_creacion: string | Date
}

const TABLE_REGISTROS = process.env.TABLE_REGISTROS
const TABLE_SUCURSAL = process.env.TABLE_SUCURSALES
const TABLE_TURNO = process.env.TABLE_TURNO
const TIEMPO_ATENCION_LICENCIAS = Number(process.env.TIEMPO_ATENCION_LICENCIAS)

export async function registrarInteraccion(
  { curp, nombre, celular }: RegistrarInteraccionInput
): Promise<number> {
  const curpNorm = String(curp ?? '').trim().toUpperCase()
  const nombreNorm = String(nombre ?? 'SIN_NOMBRE').trim()
  const celNorm = String(celular ?? '').trim()

  if (!curpNorm) {
    throw new Error('CURP es requerido')
  }
  if (!celNorm) {
    throw new Error('Celular es requerido')
  }

  const sql = `
    INSERT INTO ${TABLE_REGISTROS} (curp, nombre_whatsapp, celular, fecha_registro, ultima_interaccion, activo)
    VALUES ($1, $2, $3, NOW(), NOW(), TRUE)
    RETURNING id_registro;
  `

  try {
    const result = await query(sql, [curpNorm, nombreNorm, celNorm])
    // Tip: si tu `query` ya tipa el retorno, podes cambiar `any` por el tipo real
    const id = (result?.rows?.[0]?.id_registro as number | undefined)
    if (!id && id !== 0) {
      throw new Error('No se recibió id_registro desde la base de datos')
    }
    console.log('Nuevo registro insertado:', id)
    return id
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Error en registrarInteraccion:', msg)
    throw err
  }
}

export async function generarTurno({
  id_registro,
  id_sucursal,
  celular,
}: GenerarTurnoInput): Promise<GenerarTurnoOutput> {
  const fechaHoy = getFechaHoyMexico();
  console.log(fechaHoy);
  
  let tiempoEstimado = '';
  const codigo_seguridad = generarCodigoSeguridad(6)
  const numero_turno = `T${Math.floor(1000 + Math.random() * 9000)}`
  
  try {
    // Insertar nuevo turno
    const insertSQL = `
      INSERT INTO ${TABLE_TURNO}
        (id_registro, id_sucursal, celular, numero_turno, codigo_seguridad, estado,fecha_turno)
      VALUES ($1, $2, $3, $4, $5, 'pendiente',$6)
      RETURNING id_turnos,numero_turno, codigo_seguridad, id_sucursal;
    `
    const { rows } = await query(insertSQL, [
      id_registro,
      id_sucursal,
      celular,
      numero_turno,
      codigo_seguridad,
      fechaHoy
    ])

    if (!rows.length) throw new Error('No se generó el turno en la base de datos')
    const turno = rows[0]

    // Recuperar nombre de la sucursal
    const sucursalSQL = `SELECT nombre FROM ${TABLE_SUCURSAL} WHERE id_sucursal = $1`
    const suc = await query(sucursalSQL, [id_sucursal])
    const nombreSucursal = suc.rows[0]?.nombre ?? 'Sucursal principal'

    // Contar pendientes del día
    const pendientesSQL = `
      SELECT COUNT(*) AS total
      FROM ${TABLE_TURNO}
      WHERE estado = 'pendiente'
        AND id_sucursal = $1
        AND DATE(hora_creacion) = CURRENT_DATE;
    `
    const pendientes = await query(pendientesSQL, [id_sucursal])
    const cantidadPendientes = parseInt(pendientes.rows[0]?.total ?? '0', 10)
    
    const minutos = (cantidadPendientes - 1) * TIEMPO_ATENCION_LICENCIAS
    if (minutos < 1){
        tiempoEstimado = `Favor de acercarse inmediatamente a la ventanilla.`
    }else{
        tiempoEstimado = `${minutos} minutos aprox.`
    }
    

    try {
      const io = getIO();
      io.emit('nuevo_turno', {
        id_sucursal,
        id_turnos: turno.id_turnos,
        numero_turno,
        codigo_seguridad,
        estado: 'pendiente',
        sucursal: nombreSucursal,
        tiempoEstimado,
      });

    } catch (socketErr) {
      console.warn('⚠️ No se pudo emitir el evento Socket:', socketErr);
    }

    return {
      numero_turno: turno.numero_turno,
      codigo_seguridad: turno.codigo_seguridad,
      sucursal: nombreSucursal,
      tiempoEstimado,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Error en generarTurno:', msg)
    throw err
  }
}

export async function verificarTurnoHoy(celular: string): Promise<TurnoHoy | null> {
  const sql = `
    SELECT
      t.id_turnos,
      t.numero_turno,
      t.codigo_seguridad,
      s.nombre AS sucursal,
      t.estado,
      t.hora_creacion
    FROM ${TABLE_TURNO} t
    JOIN ${TABLE_SUCURSAL} s ON s.id_sucursal = t.id_sucursal
    WHERE t.celular = $1
      AND t.estado <> 'cancelado'
      AND DATE(t.hora_creacion) = CURRENT_DATE
    LIMIT 1;
  `

  try {
    
    const { rows } = await query(sql, [celular])
    console.log(rows);
    
    return (rows?.[0] as TurnoHoy) ?? null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('verificarTurnoHoy error:', msg)
    return null
  }
}


/* export async function obtenerHorarioTurno() {
  const sql = `
    SELECT 
      hora_inicio,
      hora_fin,
      (NOW()::time BETWEEN hora_inicio AND hora_fin) AS dentro_horario
    FROM public.gestion_proyectos_config
    WHERE est_actual_dato = TRUE
    ORDER BY fecha_creacion DESC
    LIMIT 1
  `

  const { rows } = await query(sqll)

  if (!rows.length) {
    return {
      existeConfig: false,
      dentroHorario: false,
      horaInicio: null,
      horaFin: null
    }
  }

  const row = rows[0]

  return {
    existeConfig: true,
    dentroHorario: row.dentro_horario,

    horaInicio: row.hora_inicio,
    horaFin: row.hora_fin
  }
} */
