import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
    user?: any;
}

/* export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Token no proporcionado" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
        req.user = decoded; // ← AQUÍ SE INSERTA req.user
        next();
    } catch (error) {
        return res.status(401).json({ message: "Token inválido" });
    }
}; */


const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;

export interface AuthRequest extends Request {
  user?: any;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(" ")[1];
    
  if (!token) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    req.user = decoded;   // ← Ahora aquí estará id_login, usuario, rol
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido" });
  }
};
