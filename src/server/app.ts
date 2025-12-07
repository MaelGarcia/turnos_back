import express from 'express'
import cors from 'cors';
import routes from './routes/routes'
import auth from './routes/auth'
import coordinador from './routes/coordinador'
import user from './routes/user'
import admin from './routes/admin'
import { authMiddleware } from '~/middlewares/authMiddleware';
import {getFechaHoyMexico} from '../tools/tools'

const app = express()

const path = '/api';

export const public_routes = ()=> {
  app.use(path,auth)
}

export const private_routes = ()=> {
  app.use(path, authMiddleware, user, coordinador,admin);
};

export const buildServer = () => {
  const fecha = getFechaHoyMexico();
  console.log("Fecha actual México:", fecha);
  app.use(express.json())
  app.use(cors())
  public_routes();
  private_routes();
  app.use('/api', routes)

  return app
}