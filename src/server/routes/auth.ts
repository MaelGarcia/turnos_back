import { Router } from 'express'
import { authservice } from '../controllers/auth.controllers'
const router = Router()

router.post('/auth', authservice)

export default router