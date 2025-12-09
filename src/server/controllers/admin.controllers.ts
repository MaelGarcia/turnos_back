import { query } from '../../db/config';
import type { Request, Response } from 'express'
import { join } from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const qrPath = join(__dirname,'..','..','..','bot.qr.png');

export async function obtenerTurnos (req: Request, res: Response) {
    try {
        const { sucursal, modulo, usuario, desde, hasta } = req.query;

        let sql = `
            SELECT 
                t.*,
                s.nombre AS sucursal,
                m.codigo_modulo AS modulo,
                l.usuario AS usuario_nombre 
            FROM turnos t
            LEFT JOIN sucursal s ON s.id_sucursal = t.id_sucursal
            LEFT JOIN modulos m ON m.id_modulos = t.id_modulos
            LEFT JOIN login l ON l.id_login = t.id_login
            WHERE 1=1
        `;

        const params: any[] = [];
        let i = 1;

        if (sucursal) {
            sql += ` AND t.id_sucursal = $${i++}`;
            params.push(sucursal);
        }

        if (modulo) {
            sql += ` AND t.id_modulos = $${i++}`;
            params.push(modulo);
        }

        if (usuario) {
            sql += ` AND t.id_login = $${i++}`;
            params.push(usuario);
        }

        if (desde && hasta) {
            sql += ` AND t.hora_creacion BETWEEN $${i++} AND $${i++}`;
            params.push(desde);
            params.push(hasta);
        }

        sql += ` ORDER BY t.hora_creacion DESC`;

        const result = await query(sql, params);

        res.json(result.rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error obteniendo turnos" });
    }
}



export async function obtenerModulos(req: Request, res: Response) {
    try {
        const sql = `
            SELECT 
                m.id_modulos,
                m.codigo_modulo,
                m.descripcion,
                m.id_sucursal,
                s.nombre AS sucursal
            FROM modulos m
            LEFT JOIN sucursal s ON s.id_sucursal = m.id_sucursal
            WHERE m.estado_act_dato = TRUE
            ORDER BY m.codigo_modulo ASC
        `;

        const result = await query(sql);
        
        res.json(result.rows);

    } catch (error) {
        console.error("Error obteniendo módulos:", error);
        res.status(500).json({ error: "Error obteniendo módulos" });
    }
}

export async function obtenerUsuarios(req: Request, res: Response) {
    try {
        const sql = `
            SELECT id_login, usuario, correo, rol
            FROM login
            WHERE rol = 'USER'      -- ← SOLO USUARIOS NORMALES
              AND estado_act_dato = TRUE
            ORDER BY usuario ASC
        `;

        const result = await query(sql);
        res.json(result.rows);

    } catch (error) {
        console.error("Error obteniendo usuarios:", error);
        res.status(500).json({ error: "Error obteniendo usuarios" });
    }
}

export async function obtenerUsuarioslistado(req: Request, res: Response) {
    try {
        const sql = `
                            SELECT
                l.id_login AS id_usuario,
                l.usuario,
                l.correo,
                l.rol,

                -- Sucursales asignadas
                COALESCE(
                    json_agg(
                    DISTINCT jsonb_build_object(
                        'id_sucursal', s.id_sucursal,
                        'codigo',      s.codigo,
                        'nombre',      s.nombre
                    )
                    ) FILTER (WHERE s.id_sucursal IS NOT NULL),
                    '[]'::json
                ) AS sucursales,

                -- Módulos asignados
                COALESCE(
                    json_agg(
                    DISTINCT jsonb_build_object(
                        'id_modulos',    m.id_modulos,
                        'id_sucursal',   m.id_sucursal,
                        'codigo_modulo', m.codigo_modulo,
                        'descripcion',   m.descripcion
                    )
                    ) FILTER (WHERE m.id_modulos IS NOT NULL),
                    '[]'::json
                ) AS modulos

                FROM public.login l
                LEFT JOIN public.login_sucursal ls
                    ON ls.id_login = l.id_login
                    AND ls.estado_act_dato = TRUE
                LEFT JOIN public.sucursal s
                    ON s.id_sucursal = ls.id_sucursal
                    AND s.estado_act_dato = TRUE

                LEFT JOIN public.login_modulo lm
                    ON lm.id_login = l.id_login
                    AND lm.estado_act_dato = TRUE
                LEFT JOIN public.modulos m
                    ON m.id_modulos = lm.id_modulos
                    AND m.estado_act_dato = TRUE

                GROUP BY l.id_login, l.usuario, l.correo, l.rol
                ORDER BY l.id_login;

        `;

        const result = await query(sql);
        res.json(result.rows);

    } catch (error) {
        console.error("Error obteniendo usuarios:", error);
        res.status(500).json({ error: "Error obteniendo usuarios" });
    }
}

export async function crearUsuario(req: Request, res: Response) {

  try {
    const {
      usuario,
      correo,
      rol,
      password_manual,
      sucursales_ids = [],
      modulos_ids = []
    } = req.body;
    
    // valida mínimo
    if (!usuario || !correo || !rol) {
      return res.status(400).json({ message: 'usuario, correo y rol son requeridos' });
    }

    const contrasena_plana = password_manual || 't3mp0r4l';
    const contrasena_hash = contrasena_plana; // aquí iría bcrypt.hash(...)

    await query('BEGIN');

    const insertLoginText = `
      INSERT INTO public.login (usuario, correo, contrasena, rol)
      VALUES ($1, $2, $3, $4)
      RETURNING id_login, usuario, correo, rol, fecha_creacion, estado_act_dato
    `;
    const insertLoginValues = [usuario, correo, contrasena_hash, rol];

    const resultLogin = await query(insertLoginText, insertLoginValues);
    const login = resultLogin.rows[0];
    const id_login = login.id_login;

    
    if (rol === 'COORDINADOR' && Array.isArray(sucursales_ids) && sucursales_ids.length > 0) {
      const insertLS = `
        INSERT INTO public.login_sucursal (id_login, id_sucursal)
        SELECT $1, unnest($2::int[])
      `;
      await query(insertLS, [id_login, sucursales_ids]);
    }

    
    if (rol === 'USER' && Array.isArray(modulos_ids) && modulos_ids.length > 0) {
    
      const insertLM = `
        INSERT INTO public.login_modulo (id_login, id_modulos, id_sucursal)
        SELECT $1, m.id_modulos, m.id_sucursal
        FROM public.modulos m
        WHERE m.id_modulos = ANY($2::int[])
      `;
      await query(insertLM, [id_login, modulos_ids]);
    }

    await query('COMMIT');

    const usuarioCreado = {
      id_usuario: id_login,
      usuario: login.usuario,
      correo: login.correo,
      rol: login.rol,
      sucursales: [],
      modulos: []
    };

    return res.status(201).json(usuarioCreado);

  } catch (err) {
    await query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ message: 'Error creando usuario' });
  } 
}

export async function u_estatus_suc(req: Request, res: Response) {
  const id = parseInt(req.params.id_sucursal, 10);
  const { estatus } = req.body;
    console.log(id,estatus);
    
  if (isNaN(id) || !estatus) {
    return res.status(400).json({ message: 'Datos inválidos' });
  }

  try {
    await query(
      'UPDATE public.sucursal SET estatus = $1 WHERE id_sucursal = $2',
      [estatus, id]
    );
    return res.json({ message: 'Estatus actualizado' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error actualizando estatus' });
  }
}

export async function actualizarUsuario(req: Request, res: Response) {
    
    
  try {
   
    const id_login = parseInt(req.params.id, 10);
    console.log("Entre a actualziar",req.params);
    if (isNaN(id_login)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const {
      usuario,
      correo,
      rol,
      password_manual,
      sucursales_ids = [],
      modulos_ids = []
    } = req.body;
     console.log(req.body);
     
    if (!usuario || !correo || !rol) {
      return res.status(400).json({
        message: 'usuario, correo y rol son requeridos'
      });
    }

    await query('BEGIN');

    // 1) Actualizar tabla login
    if (password_manual && password_manual.trim().length >= 6) {
      // Aquí lo ideal es hashear (bcrypt)
      const contrasena_hash = password_manual.trim(); // DEMO: sin hash

      const updateLoginConPass = `
        UPDATE public.login
        SET usuario    = $1,
            correo     = $2,
            rol        = $3,
            contrasena = $4
        WHERE id_login = $5
        RETURNING id_login, usuario, correo, rol, fecha_creacion, estado_act_dato
      `;
      await query(updateLoginConPass, [
        usuario,
        correo,
        rol,
        contrasena_hash,
        id_login
      ]);
    } else {
      const updateLoginSinPass = `
        UPDATE public.login
        SET usuario = $1,
            correo  = $2,
            rol     = $3
        WHERE id_login = $4
        RETURNING id_login, usuario, correo, rol, fecha_creacion, estado_act_dato
      `;
      await query(updateLoginSinPass, [
        usuario,
        correo,
        rol,
        id_login
      ]);
    }
    await query(
      `UPDATE public.login_sucursal
       SET estado_act_dato = FALSE
       WHERE id_login = $1`,
      [id_login]
    );

    await query(
      `UPDATE public.login_modulo
       SET estado_act_dato = FALSE
       WHERE id_login = $1`,
      [id_login]
    );

    // 2.a) Si es COORDINADOR → usar login_sucursal
    if (rol === 'COORDINADOR' && Array.isArray(sucursales_ids) && sucursales_ids.length > 0) {
      const insertLoginSucursal = `
        INSERT INTO public.login_sucursal (id_login, id_sucursal)
        SELECT $1, unnest($2::int[])
      `;
      await query(insertLoginSucursal, [id_login, sucursales_ids]);
    }

    // 2.b) Si es USER → usar login_modulo con id_sucursal tomado de modulos
    if (rol === 'USER' && Array.isArray(modulos_ids) && modulos_ids.length > 0) {
      const insertLoginModulo = `
        INSERT INTO public.login_modulo (id_login, id_modulos, id_sucursal)
        SELECT $1, m.id_modulos, m.id_sucursal
        FROM public.modulos m
        WHERE m.id_modulos = ANY($2::int[])
      `;
      await query(insertLoginModulo, [id_login, modulos_ids]);
    }

    await query('COMMIT');

    // 3) (Opcional pero muy útil) Devolver el usuario actualizado con sus sucursales/modulos
    const selectUsuario = `
      SELECT
        l.id_login AS id_usuario,
        l.usuario,
        l.correo,
        l.rol,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id_sucursal', s.id_sucursal,
              'codigo',      s.codigo,
              'nombre',      s.nombre
            )
          ) FILTER (WHERE s.id_sucursal IS NOT NULL),
          '[]'::json
        ) AS sucursales,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id_modulos',    m2.id_modulos,
              'id_sucursal',   m2.id_sucursal,
              'codigo_modulo', m2.codigo_modulo,
              'descripcion',   m2.descripcion
            )
          ) FILTER (WHERE m2.id_modulos IS NOT NULL),
          '[]'::json
        ) AS modulos
      FROM public.login l
      LEFT JOIN public.login_sucursal ls
        ON ls.id_login = l.id_login
       AND ls.estado_act_dato = TRUE
      LEFT JOIN public.sucursal s
        ON s.id_sucursal = ls.id_sucursal
       AND s.estado_act_dato = TRUE
      LEFT JOIN public.login_modulo lm
        ON lm.id_login = l.id_login
       AND lm.estado_act_dato = TRUE
      LEFT JOIN public.modulos m2
        ON m2.id_modulos = lm.id_modulos
       AND m2.estado_act_dato = TRUE
      WHERE l.id_login = $1
      GROUP BY l.id_login, l.usuario, l.correo, l.rol
    `;

    const resultUsuario = await query(selectUsuario, [id_login]);
    const usuarioActualizado = resultUsuario.rows[0];

    return res.json(usuarioActualizado);

  } catch (err) {
    await query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ message: 'Error actualizando usuario' });
  } 
}

export async function obtenerSucursales(req: Request, res: Response) {
    try {
        const sql = `
            SELECT id_sucursal, codigo, nombre, direccion, estatus
            FROM sucursal
            WHERE estado_act_dato = TRUE
            ORDER BY nombre ASC
        `;

        const result = await query(sql);        
        res.json(result.rows);

    } catch (error) {
        console.error("Error obteniendo sucursales:", error);
        res.status(500).json({ error: "Error obteniendo sucursales" });
    }
}

export async function obtenerModulosPorSucursal(req: Request, res: Response) {
    try {
        const { id_sucursal } = req.params;

        const sql = `
            SELECT id_modulos, id_sucursal, codigo_modulo
            FROM modulos
            WHERE id_sucursal = $1
            ORDER BY codigo_modulo ASC
        `;

        const result = await query(sql, [id_sucursal]);

        res.json(result.rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error obteniendo módulos por sucursal" });
    }
}


/* export async function guardarSucursales(req: Request, res: Response) {
    try {
        const { id_sucursal, codigo, nombre, direccion } = req.body;

        // Validaciones simples
        if (!codigo || !nombre) {
            return res.status(400).json({ error: "Código y nombre son obligatorios." });
        }

        let sql;
        let params;

        if (id_sucursal) {
            // 🔄 UPDATE
            sql = `
                UPDATE sucursal
                SET codigo = $1,
                    nombre = $2,
                    direccion = $3
                WHERE id_sucursal = $4
                RETURNING *;
            `;
            params = [codigo, nombre, direccion, id_sucursal];

        } else {
            // ➕ INSERT
            sql = `
                INSERT INTO sucursal (codigo, nombre, direccion)
                VALUES ($1, $2, $3)
                RETURNING *;
            `;
            params = [codigo, nombre, direccion];
        }

        const result = await query(sql, params);

        res.json({
            ok: true,
            message: id_sucursal ? "Sucursal actualizada." : "Sucursal creada.",
            data: result.rows[0]
        });

    } catch (error: any) {
        console.error("Error guardando sucursal:", error);

        // Manejo de error de código duplicado
        if (error.code === "23505") {
            return res.status(400).json({
                error: "El código de sucursal ya existe. Debe ser único."
            });
        }

        res.status(500).json({
            error: "Error guardando sucursal."
        });
    }
} */
export async function guardarSucursales(req: Request, res: Response) {
    try {
        const {
            id_sucursal,
            codigo,
            nombre,
            direccion,
            estatus = 'DISPONIBLE' // por defecto si no lo mandan
        } = req.body;

        // Validaciones simples
        if (!codigo || !nombre) {
            return res.status(400).json({ error: "Código y nombre son obligatorios." });
        }

        let sql: string;
        let params: any[];

        if (id_sucursal) {
            // 🔄 UPDATE
            sql = `
                UPDATE sucursal
                SET codigo   = $1,
                    nombre   = $2,
                    direccion= $3,
                    estatus  = $4
                WHERE id_sucursal = $5
                RETURNING *;
            `;
            params = [codigo, nombre, direccion, estatus, id_sucursal];

        } else {
            // ➕ INSERT
            sql = `
                INSERT INTO sucursal (codigo, nombre, direccion, estatus)
                VALUES ($1, $2, $3, $4)
                RETURNING *;
            `;
            params = [codigo, nombre, direccion, estatus];
        }

        const result = await query(sql, params);

        res.json({
            ok: true,
            message: id_sucursal ? "Sucursal actualizada." : "Sucursal creada.",
            data: result.rows[0]
        });

    } catch (error: any) {
        console.error("Error guardando sucursal:", error);

        // Manejo de error de código duplicado
        if (error.code === "23505") {
            return res.status(400).json({
                error: "El código de sucursal ya existe. Debe ser único."
            });
        }

        res.status(500).json({
            error: "Error guardando sucursal."
        });
    }
}


export async function eliminarSucursal(req: Request, res: Response) { 
  
    try {        
        const { id_sucursal } = req.params;

        if (!id_sucursal) {
            return res.status(400).json({ error: "El ID de la sucursal es obligatorio." });
        }

        const sql = `
            UPDATE sucursal
            SET estado_act_dato = FALSE
            WHERE id_sucursal = $1
            RETURNING *;
        `;

        const result = await query(sql, [id_sucursal]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Sucursal no encontrada." });
        }

        res.json({
            ok: true,
            message: "Sucursal eliminada correctamente.",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Error eliminando sucursal:", error);
        res.status(500).json({ error: "Error eliminando sucursal." });
    }
}

export const eliminarModulos = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                ok: false,
                mensaje: "El ID del módulo es obligatorio"
            });
        }

        // Soft delete: solo marcar estado_act_dato = FALSE
        const sql = `
            UPDATE modulos
            SET estado_act_dato = FALSE
            WHERE id_modulos = $1
              AND estado_act_dato = TRUE
            RETURNING *
        `;

        const result = await query(sql, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                mensaje: "No se encontró el módulo activo con ese ID o ya estaba desactivado"
            });
        }

        return res.status(200).json({
            ok: true,
            mensaje: "Módulo desactivado correctamente",
            modulo: result.rows[0]
        });

    } catch (error) {
        console.error("Error al desactivar módulo:", error);

        return res.status(500).json({
            ok: false,
            mensaje: "Error interno del servidor"
        });
    }
};

export async function guardarModulos(req: Request, res: Response) {
    try {
        const { id_modulos, id_sucursal, codigo_modulo, descripcion } = req.body;

        if (!id_sucursal || !codigo_modulo) {
            return res.status(400).json({ error: "Sucursal y código del módulo son obligatorios." });
        }

        // Validar que la sucursal exista
        const validaSucursal = await query(
            `SELECT id_sucursal FROM sucursal WHERE id_sucursal = $1 AND estado_act_dato = TRUE`,
            [id_sucursal]
        );

        if (validaSucursal.rowCount === 0) {
            return res.status(400).json({ error: "La sucursal especificada no existe o está inactiva." });
        }

        let sql;
        let params;
        
        if (!id_modulos) {
            // INSERT
            sql = `
                INSERT INTO modulos (id_sucursal, codigo_modulo, descripcion)
                VALUES ($1, $2, $3)
                RETURNING *;
            `;
            params = [id_sucursal, codigo_modulo, descripcion];
        } else {
            // UPDATE
            sql = `
                UPDATE modulos
                SET id_sucursal = $1, codigo_modulo = $2, descripcion = $3
                WHERE id_modulos = $4
                RETURNING *;
            `;
            params = [id_sucursal, codigo_modulo, descripcion, id_modulos];
        }

        const result = await query(sql, params);

        res.json({
            ok: true,
            message: !id_modulos ? "Módulo creado correctamente." : "Módulo actualizado correctamente.",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Error guardando módulo:", error);
        res.status(500).json({ error: "Error guardando módulo" });
    }
}

export async function getConfigActual(req: Request, res: Response) {
  try {
    const result = await query(
      `SELECT
         id_config,
         telefono_whatsapp,
         hora_inicio,
         hora_fin,
         est_actual_dato,
         fecha_creacion
       FROM public.gestion_proyectos_config
       WHERE est_actual_dato = TRUE
       ORDER BY fecha_creacion DESC
       LIMIT 1`
    );

    if (result.rowCount === 0) {
      return res.json(null);
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[getConfigActual] Error:', err);
    return res.status(500).json({ message: 'Error consultando configuración actual' });
  }
}

export async function getConfigHistorial(req: Request, res: Response) {
  try {
    const result = await query(
      `SELECT
         id_config,
         telefono_whatsapp,
         hora_inicio,
         hora_fin,
         est_actual_dato,
         fecha_creacion
       FROM public.gestion_proyectos_config
       ORDER BY fecha_creacion DESC`
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('[getConfigHistorial] Error:', err);
    return res.status(500).json({ message: 'Error consultando historial de configuración' });
  }
}

export async function crearConfig(req: Request, res: Response) {
  try {
    const {
      telefono_whatsapp,
      hora_inicio,   // 'HH:MM' o 'HH:MM:SS'
      hora_fin       // 'HH:MM' o 'HH:MM:SS'
    } = req.body;

    if (!telefono_whatsapp || !hora_inicio || !hora_fin) {
      return res.status(400).json({
        message: 'telefono_whatsapp, hora_inicio y hora_fin son requeridos'
      });
    }

    const insertResult = await query(
      `INSERT INTO public.gestion_proyectos_config
        (telefono_whatsapp, hora_inicio, hora_fin)
       VALUES ($1, $2, $3)
       RETURNING
         id_config,
         telefono_whatsapp,
         hora_inicio,
         hora_fin,
         est_actual_dato,
         fecha_creacion`,
      [telefono_whatsapp, hora_inicio, hora_fin]
    );

    const nuevaConfig = insertResult.rows[0];
    return res.status(201).json(nuevaConfig);

  } catch (err) {
    console.error('[crearConfig] Error:', err);
    return res.status(500).json({ message: 'Error creando configuración' });
  }
}

export async function scanQr(req: Request, res: Response) {

  if (!existsSync(qrPath)) {
    console.log('❌ qr.png NO existe en:', qrPath);
    return res.status(404).send('QR no disponible');
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  return res.sendFile(qrPath);
}

