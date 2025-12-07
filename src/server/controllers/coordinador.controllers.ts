
import type { Request, Response } from 'express'
import { query } from '../../db/config';
import axios from 'axios'
import { getIO } from '~/tools/socket';

const TABLE_LOGIN_SUCURSAL = process.env.TABLE_LOGIN_SUCURSAL;
const TABLE_SUCURSALES = process.env.TABLE_SUCURSALES;
const TABLE_MODULOS = process.env.TABLE_MODULOS;
const TABLE_TURNOS = process.env.TABLE_TURNOS;
const BOT_URL = process.env.BOT_URL;

export async function loginsucursal(req: Request, res: Response) {    
    const { id_login } = req.params;
    const sql = `
        SELECT s.id_sucursal, s.nombre, s.codigo
        FROM ${TABLE_LOGIN_SUCURSAL} ls
        JOIN ${TABLE_SUCURSALES} s ON s.id_sucursal = ls.id_sucursal
        WHERE ls.id_login = $1 AND ls.estado_act_dato = TRUE
    `;
    try {
        const { rows } = await query(sql, [id_login]);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al consultar sucursales' });
    }
}

export async function sucursalmodulos(req: Request, res: Response) {
    const { id_sucursal } = req.params;
    const sql = `
        SELECT id_modulos, codigo_modulo, descripcion, servicios, estatus
        FROM ${TABLE_MODULOS}
        WHERE id_sucursal = $1 AND estado_act_dato = TRUE
        ORDER BY id_modulos;
    `;
    try {
        const { rows } = await query(sql, [id_sucursal]);
        res.json(rows);
    } catch (error) {
        console.error('[Error módulos]', error);
        res.status(500).json({ error: 'Error al consultar módulos' });
    }
}

export async function turnos_modulos(req: Request, res: Response) {
    const { id_sucursal } = req.params;

    const sql = `
        SELECT * FROM ${TABLE_TURNOS}
        WHERE id_sucursal = $1
        AND estado IN ('pendiente','atendiendo','asignado')
        ORDER BY hora_creacion ASC;
    `;

    const { rows } = await query(sql, [id_sucursal]);
    res.json(rows);
}

export async function turnomodulos_estatus_update(req: Request, res: Response) {
    const { id_turno } = req.params;
  const { estado } = req.body;

  // Validar estado permitido
  const estadosValidos = ['pendiente', 'atendiendo', 'finalizado', 'cancelado'];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Debe ser uno de: ${estadosValidos.join(', ')}` });
  }

  try {
    const sql = `
      UPDATE public.turnos
      SET estado = $1,
          hora_llamado = CASE WHEN $1 = 'atendiendo' THEN NOW() ELSE hora_llamado END,
          hora_finalizacion = CASE WHEN $1 = 'finalizado' THEN NOW() ELSE hora_finalizacion END
      WHERE id_turnos = $2
      RETURNING *;
    `;

    const { rows } = await query(sql, [estado, id_turno]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    res.json({ ok: true, turno: rows[0] });
  } catch (error) {
    console.error('[Error al actualizar estado de turno]:', error);
    res.status(500).json({ error: 'Error al actualizar el estado del turno' });
  }
}

export async function modulo_update_servicios(req: Request, res: Response) {
    const { id } = req.params;
    const { servicios } = req.body;
    
    await query(`
      UPDATE modulos
      SET servicios = $1
      WHERE id_modulos = $2
    `, [servicios, id]);

     res.json({ ok: true });
}

export async function modulo_update_estatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { estatus } = req.body as { estatus?: string };

    // Validaciones básicas
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ message: 'ID de módulo inválido' });
    }

    if (!estatus) {
      return res.status(400).json({ message: 'El campo "estatus" es requerido' });
    }

    // Opcional: limitar a valores permitidos
    const estatusPermitidos = ['DISPONIBLE', 'CERRADO'];
    if (!estatusPermitidos.includes(estatus.toUpperCase())) {
      return res.status(400).json({
        message: `Estatus inválido. Valores permitidos: ${estatusPermitidos.join(', ')}`,
      });
    }

    const idModulo = Number(id);
    const estatusNormalizado = estatus.toUpperCase();

    const sql = `
      UPDATE modulos
      SET estatus = $1
      WHERE id_modulos = $2
      RETURNING id_modulos, id_sucursal, codigo_modulo, descripcion, estatus, estado_act_dato
    `;

    const params = [estatusNormalizado, idModulo];
 /* const { rows } = await query(sql, [estado, id_turno]); */
    const { rows } = await query(sql, params);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Módulo no encontrado' });
    }

    return res.status(200).json({
      message: 'Estatus de módulo actualizado correctamente',
      modulo: rows[0],
    });
  } catch (error) {
    console.error('Error en modulo_update_estatus:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

/* export async function turno_update_estado(req: Request, res: Response) {  
  try {
    const { id } = req.params;
    const { estado, id_modulos } = req.body as {
      estado?: string;
      id_modulos?: number | null;
    };

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ message: 'ID de turno inválido' });
    }

    if (!estado) {
      return res
        .status(400)
        .json({ message: 'El campo "estado" es requerido' });
    }

    const estadoNormalizado = String(estado).toLowerCase();
    const estadosPermitidos = ['pendiente', 'asignado', 'atendiendo', 'finalizado', 'cancelado'];

    if (!estadosPermitidos.includes(estadoNormalizado)) {
      return res.status(400).json({
        message: `Estado inválido. Valores permitidos: ${estadosPermitidos.join(
          ', '
        )}`,
      });
    }

    const idTurno = Number(id);
    const idModuloValue =
      typeof id_modulos === 'number' && !isNaN(id_modulos)
        ? id_modulos
        : null;

    // Si el estado es "asignado", también actualizamos hora_llamado = NOW()
    let sql: string;
    const params: any[] = [estadoNormalizado, idModuloValue, idTurno];

    if (estadoNormalizado === 'asignado') {
      sql = `
        UPDATE turnos AS t
        SET estado = $1,
            id_modulos = $2,
            hora_llamado = NOW()
        FROM modulos AS m
        WHERE t.id_turnos = $3
          AND m.id_modulos = $2
        RETURNING 
          t.id_turnos,
          t.id_sucursal,
          t.numero_turno,
          t.codigo_seguridad,
          t.celular,
          t.estado,
          t.id_modulos,
          m.codigo_modulo,        
          t.hora_creacion,
          t.notificado,
          t.hora_llamado
      `;
    } else {
      sql = `
        UPDATE turnos AS t
        SET estado = $1,
            id_modulos = $2
        FROM modulos AS m
        WHERE t.id_turnos = $3
          AND m.id_modulos = $2
        RETURNING 
          t.id_turnos,
          t.id_sucursal,
          t.numero_turno,
          t.codigo_seguridad,
          t.celular,
          t.estado,
          t.id_modulos,
          m.codigo_modulo,         
          t.hora_creacion,
          t.notificado,
          t.hora_llamado
      `;
    }

    const { rows } = await query(sql, params);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Turno no encontrado' });
    }
    const turno = rows[0];

    try {
          const io = getIO();

          const room = `sucursal-${turno.id_sucursal}_modulo-${turno.codigo_modulo}`;

          io.to(room).emit('turnoAsignado', {
          id_turnos: turno.id_turnos,
          numero_turno: turno.numero_turno,
          codigo_seguridad: turno.codigo_seguridad,
          estado: turno.estado,
          id_sucursal: turno.id_sucursal,
          id_modulos: turno.id_modulos,
          codigo_modulo: turno.codigo_modulo,
          hora_llamado: turno.hora_llamado
        });

          console.log(`[SOCKET] Nuevo turno enviado a sala emitido desde el coordinador: ${room}`);
        } catch (error) {
          console.error('Error emitiendo socket:', error);
        }

    if (
      estadoNormalizado === 'asignado' &&
      turno.celular &&
      turno.notificado !== true
    ) {
      const mensaje = `Hola, tu turno ${turno.numero_turno} ha sido asignado al módulo *${turno.codigo_modulo}*. Por favor acércate al módulo.`;

      try {
        await axios.post(`${BOT_URL}/v1/messages`, {
          number: turno.celular,
          message: mensaje,
        });

        await query(
          `UPDATE turnos
           SET notificado = TRUE
           WHERE id_turnos = $1`,
          [idTurno]
        );
        turno.notificado = true;
        // socket.io - notificar nuevo turno asignado
        
      } catch (err) {
        console.error('Error enviando WhatsApp:', err);
        // No hacemos throw aquí para no romper la actualización del turno
      }
    }

    return res.status(200).json({
      message: 'Estado de turno actualizado correctamente',
      turno,
    });
  } catch (error) {
    console.error('Error en turno_update_estado:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

 */
export async function turno_update_estado(req: Request, res: Response) {  
  try {
    const { id } = req.params;
    const { estado, id_modulos, id_login } = req.body as {
      estado?: string;
      id_modulos?: number | null;
      id_login?: number | null;
    };

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ message: 'ID de turno inválido' });
    }

    if (!estado) {
      return res.status(400).json({ message: 'El campo "estado" es requerido' });
    }

    const estadoNormalizado = String(estado).toLowerCase();
    const estadosPermitidos = ['pendiente', 'asignado', 'atendiendo', 'finalizado', 'cancelado'];

    if (!estadosPermitidos.includes(estadoNormalizado)) {
      return res.status(400).json({
        message: `Estado inválido. Valores permitidos: ${estadosPermitidos.join(', ')}`,
      });
    }

    const idTurno = Number(id);
    const idModuloValue =
      typeof id_modulos === 'number' && !isNaN(id_modulos)
        ? id_modulos
        : null;


    // ===============================================================
    //   SQL DINÁMICO SEGÚN EL TIPO DE ESTADO
    // ===============================================================

    let sql: string;
    const params: any[] = [estadoNormalizado, idModuloValue, idTurno];


    // === ESTADO: "asignado" → actualizar hora_llamado ===
    if (estadoNormalizado === 'asignado') {
      sql = `
        UPDATE turnos AS t
        SET estado = $1,
            id_modulos = $2,
            hora_llamado = NOW()
        FROM modulos AS m
        WHERE t.id_turnos = $3
          AND m.id_modulos = $2
        RETURNING 
          t.id_turnos,
          t.id_sucursal,
          t.numero_turno,
          t.codigo_seguridad,
          t.celular,
          t.estado,
          t.id_modulos,
          t.id_login,
          m.codigo_modulo,        
          t.hora_creacion,
          t.notificado,
          t.hora_llamado
      `;
    }

    // === ESTADO: "atendiendo" → guardar id_login ===
    else if (estadoNormalizado === 'atendiendo') {

      sql = `
        UPDATE turnos AS t
        SET estado = $1,
            id_modulos = $2,
            id_login = $4
        FROM modulos AS m
        WHERE t.id_turnos = $3
          AND m.id_modulos = $2
        RETURNING 
          t.id_turnos,
          t.id_sucursal,
          t.numero_turno,
          t.codigo_seguridad,
          t.celular,
          t.estado,
          t.id_modulos,
          t.id_login,
          m.codigo_modulo,        
          t.hora_creacion,
          t.notificado,
          t.hora_llamado
      `;

      params.push(id_login ?? null); // $4
    }

    // === OTROS ESTADOS ===
    else {
      sql = `
        UPDATE turnos AS t
        SET estado = $1,
            id_modulos = $2
        FROM modulos AS m
        WHERE t.id_turnos = $3
          AND m.id_modulos = $2
        RETURNING 
          t.id_turnos,
          t.id_sucursal,
          t.numero_turno,
          t.codigo_seguridad,
          t.celular,
          t.estado,
          t.id_modulos,
          t.id_login,
          m.codigo_modulo,         
          t.hora_creacion,
          t.notificado,
          t.hora_llamado
      `;
    }


    // ===============================================================
    //                EJECUTAR QUERY
    // ===============================================================
    const { rows } = await query(sql, params);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Turno no encontrado' });
    }

    const turno = rows[0];


    // ===============================================================
    //                  EMITIR NOTIFICACIÓN SOCKET
    // ===============================================================
    try {
      const io = getIO();
      const room = `sucursal-${turno.id_sucursal}_modulo-${turno.codigo_modulo}`;
      
      io.to(room).emit('turnoAsignado', {
        id_turnos: turno.id_turnos,
        numero_turno: turno.numero_turno,
        codigo_seguridad: turno.codigo_seguridad,
        estado: turno.estado,
        id_sucursal: turno.id_sucursal,
        id_modulos: turno.id_modulos,
        id_login: turno.id_login,
        codigo_modulo: turno.codigo_modulo,
        hora_llamado: turno.hora_llamado
      });

      console.log(`[SOCKET] Emitido turno a ${room}`);
    } catch (error) {
      console.error('Error emitiendo socket:', error);
    }


    // ===============================================================
    //     ENVIAR WHATSAPP AUTOMÁTICO SI ES ASIGNADO
    // ===============================================================
    if (
      estadoNormalizado === 'asignado' &&
      turno.celular &&
      turno.notificado !== true
    ) {
      const mensaje = `Hola, tu turno ${turno.numero_turno} ha sido asignado al módulo *${turno.codigo_modulo}*. Por favor acércate al módulo.`;

      try {
        await axios.post(`${BOT_URL}/v1/messages`, {
          number: turno.celular,
          message: mensaje,
        });

        await query(
          `UPDATE turnos SET notificado = TRUE WHERE id_turnos = $1`,
          [idTurno]
        );
        turno.notificado = true;

      } catch (err) {
        console.error('Error enviando WhatsApp:', err);
      }
    }


    return res.status(200).json({
      message: 'Estado de turno actualizado correctamente',
      turno
    });

  } catch (error) {
    console.error('Error en turno_update_estado:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}


export async function sucursal_get_modulos(req: Request, res: Response) {
  try {
    const { id_sucursal } = req.params;

    if (!id_sucursal || isNaN(Number(id_sucursal))) {
      return res.status(400).json({ message: 'id_sucursal inválido' });
    }

    const sql = `
      SELECT
        m.id_modulos,
        m.id_sucursal,
        m.codigo_modulo,
        m.descripcion,
        m.estatus,
        m.estado_act_dato,
        m.servicios,
        t.id_turnos      AS turno_id,
        t.numero_turno   AS turno_numero,
        t.estado         AS turno_estado
      FROM modulos m
      LEFT JOIN turnos t
        ON t.id_modulos = m.id_modulos
       AND t.estado = 'atendiendo'
      WHERE m.id_sucursal = $1
      ORDER BY m.id_modulos;
    `;

    const { rows } = await query(sql, [Number(id_sucursal)]);    

    const modulos = rows.map((r) => ({
      id_modulos: r.id_modulos,
      id_sucursal: r.id_sucursal,
      codigo_modulo: r.codigo_modulo,
      descripcion: r.descripcion,
      servicios: r.servicios,
      estatus: r.estatus,
      estado_act_dato: r.estado_act_dato,
      turnoAsignado: r.turno_id
        ? {
            id_turnos: r.turno_id,
            numero_turno: r.turno_numero,
            estado: r.turno_estado,
          }
        : null,
    }));

    return res.status(200).json(modulos);
  } catch (error) {
    console.error('Error en sucursal_get_modulos:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}
