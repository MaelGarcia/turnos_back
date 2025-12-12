import { Router } from 'express'
import {obtenerUsuarioPorModulos,scanQr, crearConfig,getConfigHistorial,getConfigActual, u_estatus_suc,actualizarUsuario,crearUsuario,obtenerUsuarioslistado,eliminarModulos, guardarModulos,eliminarSucursal,guardarSucursales, obtenerModulosPorSucursal,obtenerTurnos, obtenerSucursales, obtenerModulos, obtenerUsuarios } from '../controllers/admin.controllers'
const router = Router()

router.get('/admin/turnos', obtenerTurnos);

router.get('/admin/modulos/:id_sucursal', obtenerModulosPorSucursal);

router.get('/admin/usuarios/:id_modulo', obtenerUsuarioPorModulos);

router.get('/admin/sucursales', obtenerSucursales);

router.get('/admin/modulos', obtenerModulos);   

router.get('/admin/usuarios', obtenerUsuarios);

router.get('/admin/usuarios_listado', obtenerUsuarioslistado);

router.post('/admin/guardar_sucursales', guardarSucursales);

router.delete('/admin/eliminar_sucursal/:id_sucursal', eliminarSucursal);

router.delete('/admin/eliminar_modulos/:id', eliminarModulos);

router.post('/admin/guardar_modulos', guardarModulos);

router.post('/admin/c_usuarios', crearUsuario);

router.post('/admin/u_usuarios/:id', actualizarUsuario);

router.patch('/admin/u_estatus/:id_sucursal',u_estatus_suc)

router.get('/admin/gestionproyectos/actual', getConfigActual);

router.get('/admin/gestionproyectos/historial', getConfigHistorial);

router.post('/admin/gestionproyectos', crearConfig);

router.get('/admin/qr',scanQr)

export default router