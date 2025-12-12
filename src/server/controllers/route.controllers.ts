
import type { Request, Response } from 'express'
import { query } from '../../db/config';

export async function horario(req: Request, res: Response) {
  try {
    const result = await query(
      `SELECT hora_inicio, hora_fin 
       FROM gestion_proyectos_config 
       WHERE est_actual_dato = TRUE
       ORDER BY id_config DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No hay configuración activa" });
    }

    const config = result.rows[0];

    return res.json({
      hora_inicio: config.hora_inicio, // '15:00:00'
      hora_fin: config.hora_fin        // '18:00:00'
    });

  } catch (error) {
    console.error("Error en /horario:", error);
    return res.status(500).json({ error: "Error interno" });
  }
}