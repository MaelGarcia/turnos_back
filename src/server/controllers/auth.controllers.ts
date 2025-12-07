
import type { Request, Response } from 'express'
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { query } from '../../db/config';

const ACCESS_TTL = process.env.ACCESS_TTL;
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const TABLE_LOGIN = process.env.TABLE_LOGIN;

const LoginSchema = z.object({
  username: z.string(),
  password: z.string()
});

export async function authservice(req: Request, res: Response) {   
  const parsed = LoginSchema.safeParse(req.body);

  
  if (!parsed.success) return res.status(400).json({ error: 'payload inválido' });

  const { username, password } = parsed.data;

  const sql = `
    SELECT id_login, usuario, contrasena, rol, estado_act_dato
    FROM ${TABLE_LOGIN}
    WHERE usuario = $1
    LIMIT 1
  `;

  const { rows } = await query(sql, [username]);
  const user = rows[0];
    
  if (!user || !user.estado_act_dato) {
    return res.status(401).json({ error: 'credenciales inválidas' });
  }

  if (user.contrasena !== password) {
    return res.status(401).json({ error: 'credenciales inválidas' });
  }

  const accessToken = jwt.sign(
    {
      id_login: user.id_login,
      usuario: user.usuario,
      rol: user.rol,
      typ: 'access'
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL }
  );

  return res.status(200).json({
    ok: true,
    accessToken,
    user: { id_login: user.id_login, usuario: user.usuario, rol: user.rol }
  });
}