import { Router } from 'express'
import { horario } from '../controllers/route.controllers'

const router = Router()

router.get('/private/horario',horario)



export default router