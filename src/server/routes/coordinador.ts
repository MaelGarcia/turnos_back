import { Router } from 'express'
import { sucursal_get_modulos,turno_update_estado,modulo_update_estatus,modulo_update_servicios,loginsucursal,sucursalmodulos,turnos_modulos,turnomodulos_estatus_update } from '../controllers/coordinador.controllers'
const router = Router()

router.get('/usuario_sucursal/:id_login', loginsucursal)
router.get('/sucursal_modulo/:id_sucursal', sucursalmodulos)
router.get('/sucursales/:id_sucursal/modulos', sucursal_get_modulos)
router.get('/turnos_modulos/bysucursal/:id_sucursal', turnos_modulos)
router.put('/turnos_modulos/estado/:id_turno', turnomodulos_estatus_update)
router.put('/modulos/:id/servicios', modulo_update_servicios)
router.put('/modulos/:id/estatus', modulo_update_estatus)
router.put('/turnos/:id/estado', turno_update_estado)

export default router