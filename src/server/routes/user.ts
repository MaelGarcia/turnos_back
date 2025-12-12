import { Router } from 'express'
import { turno_cancelar,turno_finalizar,getTurnosByModuloSucursal,getModulosAsignados,getTurnosByModulo } from '../controllers/user.controllers'
const router = Router()
router.get('/modulos/:id_modulos/turnos', getTurnosByModulo);
router.get('/usuarios/:id_login/modulos',getModulosAsignados)
router.get('/modulos/:id_modulos/sucursal/:id_sucursal/turnos', getTurnosByModuloSucursal);
router.put('/turnos/:id/finalizar', turno_finalizar);
router.put('/user/turnos/:id/cancelar', turno_cancelar);

export default router