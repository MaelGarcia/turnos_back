
import type { Request, Response } from 'express'
import { query } from '../../db/config';
import { AuthRequest } from '~/middlewares/authMiddleware';
import axios from 'axios'
import { log } from 'console';


const BOT_URL = process.env.BOT_URL;

export async function getTurnosByModulo(req: AuthRequest, res: Response) {
    
    const userId = req.user.id_login;
    const id_modulos = req.params.id_modulos;
    

    try {
        // verificar que el módulo pertenece al usuario
        const check = await query(
            `SELECT 1 
             FROM login_modulo 
             WHERE id_login = $1 AND id_modulos = $2 AND estado_act_dato = TRUE`,
            [userId, id_modulos]
        );

        if (check.rows.length === 0) {
            return res.status(403).json({ message: "No tienes acceso a este módulo" });
        }
        
        const result = await query(
            `SELECT *
             FROM turnos
             WHERE id_sucursal = (
                    SELECT id_sucursal FROM modulos WHERE id_modulos = $1
             )
             AND fecha_turno = CURRENT_DATE`,
            [id_modulos]
        );
       
        res.json(result.rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener turnos" });
    }
}

export async function getTurnosByModuloSucursal(req: Request, res: Response) {
  try {
    const { id_modulos, id_sucursal } = req.params;
   
    const sql = `
      SELECT *
      FROM turnos
      WHERE id_modulos = $1
        AND id_sucursal = $2
        AND fecha_turno::date = CURRENT_DATE
        AND estado IN ('asignado', 'atendiendo','finalizado')
      ORDER BY hora_creacion ASC
    `;

    const { rows } = await query(sql,[id_modulos,id_sucursal]);
    log('Turnos obtenidos:', rows);
    return res.json(rows);
  } catch (error) {
    console.error('Error en getTurnosByModuloSucursal:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}



export async function getModulosAsignados(req: Request, res: Response) {
    const id_login = req.params.id_login;
    console.log("Aqui entro",id_login);
    try {
        const result = await query(
            `SELECT m.id_modulos, m.codigo_modulo, m.descripcion, m.id_sucursal
             FROM login_modulo lm
             JOIN modulos m ON lm.id_modulos = m.id_modulos
             WHERE lm.id_login = $1
             AND lm.estado_act_dato = TRUE`,
            [id_login]
        );
        
        
        res.json(result.rows);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener módulos asignados" });
    }
}

export async function turno_finalizar(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ message: 'ID de turno inválido' });
    }

    const idTurno = Number(id);

    const sql = `
      UPDATE turnos
      SET estado = 'finalizado',
          hora_finalizacion = NOW()
      WHERE id_turnos = $1
        AND estado = 'atendiendo'
      RETURNING 
        id_turnos,
        id_sucursal,
        numero_turno,
        celular,
        estado,
        id_modulos,
        hora_creacion,
        hora_llamado,
        hora_finalizacion
    `;

    const { rows } = await query(sql, [idTurno]);
    console.log("Dato para finalizar tunro",rows);
    
    if (rows.length === 0) {
      // o no existe, o no estaba en estado "atendiendo"
      return res.status(409).json({
        message: 'No se pudo finalizar: el turno no existe o no está en atención',
      });
    }

    const turno = rows[0];

    // Enviar WhatsApp de finalización (si tenemos celular)
    if (turno.celular) {
      const mensaje = `Hola, tu turno ${turno.numero_turno} ha sido finalizado. Gracias por utilizar nuestros servicios.`;

      try {
        await axios.post(`${BOT_URL}/v1/messages`, {
          number: turno.celular,
          message: mensaje,
        });
      } catch (err) {
        console.error('Error enviando WhatsApp de finalización:', err);
        // No lanzamos 500, la finalización en BD ya se hizo
      }
    }

    return res.status(200).json({
      message: 'Turno finalizado correctamente',
      turno,
    });
  } catch (error) {
    console.error('Error en turno_finalizar:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}