import { Router } from 'express'

const router = Router()

router.get('/test', (_req, res) => {
  res.json({ ok: true, message: 'Bot alive 🟢' })
})



export default router