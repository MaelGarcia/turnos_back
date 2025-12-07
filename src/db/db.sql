-- Validar si solo va a ser servicio de licencias o varios servicios
-- Si es solo licencias, la tabla servicios puede no ser necesaria 

CREATE DATABASE turnos_db;
\c turnos_db;

SET TIMEZONE TO 'America/Mexico_City';

CREATE TABLE public.login (
  id_login SERIAL PRIMARY KEY,
  usuario VARCHAR(50) UNIQUE NOT NULL,
  correo  VARCHAR(50) UNIQUE NOT NULL,
  contrasena VARCHAR(100) NOT NULL,
  rol VARCHAR(20) DEFAULT 'USER',  -- USER
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  estado_act_dato BOOLEAN DEFAULT TRUE
);



CREATE TABLE public.login_sucursal (
  id_login_sucursal SERIAL PRIMARY KEY,
  id_login    INT NOT NULL,
  id_sucursal INT NOT NULL,
  fecha_alta  TIMESTAMP DEFAULT NOW(),
  estado_act_dato BOOLEAN DEFAULt TRUE,
  FOREIGN KEY (id_login)    REFERENCES public.login(id_login)       ON DELETE CASCADE,
  FOREIGN KEY (id_sucursal) REFERENCES public.sucursal(id_sucursal) ON DELETE CASCADE
);

CREATE TABLE public.login_modulo (
  id_login_modulo SERIAL PRIMARY KEY,
  id_login   INT NOT NULL,
  id_modulos INT NOT NULL,
  fecha_asignacion TIMESTAMP DEFAULT NOW(),
  estado_act_dato BOOLEAN DEFAULT TRUE,

  FOREIGN KEY (id_login)
    REFERENCES public.login(id_login)
    ON DELETE CASCADE,

  FOREIGN KEY (id_modulos)
    REFERENCES public.modulos(id_modulos)
    ON DELETE CASCADE
);

ALTER TABLE public.login_modulo
  ADD COLUMN id_sucursal INT;

ALTER TABLE public.login_modulo
  ADD CONSTRAINT fk_login_modulo_sucursal
    FOREIGN KEY (id_sucursal)
    REFERENCES public.sucursal(id_sucursal)
    ON DELETE CASCADE;


CREATE TABLE public.registros (
  id_registro BIGSERIAL PRIMARY KEY,

  -- RFC único y validado
  curp VARCHAR(18) NOT NULL
      CHECK (curp = UPPER(curp)),

  -- Nombre único
  nombre_whatsapp VARCHAR(200) NOT NULL,

  -- El número puede repetirse, pero se controlará por "activo"
  celular VARCHAR(20) NOT NULL,

  -- Tiempos y estado
  fecha_registro TIMESTAMPTZ DEFAULT NOW(),
  ultima_interaccion TIMESTAMPTZ,
  activo BOOLEAN DEFAULT TRUE, -- se pondrá FALSE cuando el número cambie de dueño

  notas TEXT -- para observaciones del bot o registros internos
);



CREATE TABLE sucursal (
  id_sucursal SERIAL PRIMARY KEY,
  codigo VARCHAR(50) UNIQUE NOT NULL,
  nombre VARCHAR(100),
  direccion TEXT,
  latitud DECIMAL(10, 7),
  longitud DECIMAL(10, 7),
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  estatus VARCHAR(20) DEFAULT 'DISPONIBLE', -- disponible, cerrado
  estado_act_dato BOOLEAN DEFAULT TRUE
);

CREATE TABLE modulos (
  id_modulos SERIAL PRIMARY KEY,	
  id_sucursal INT NOT NULL,
  codigo_modulo VARCHAR(50) NOT NULL,
  descripcion TEXT,
  estatus VARCHAR(20) DEFAULT 'DISPONIBLE', -- disponible, cerrado
  estado_act_dato BOOLEAN DEFAULT TRUE,
  CONSTRAINT fk_modulo_sucursal
    FOREIGN KEY (id_sucursal)
    REFERENCES sucursal (id_sucursal)
    ON DELETE CASCADE
);



CREATE TABLE servicios (
  id_servicios SERIAL PRIMARY KEY,
  id_sucursal INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  tiempo_estimado INT, -- minutos
  activo BOOLEAN DEFAULT TRUE
  CONSTRAINT fk_servicio_sucursal
    FOREIGN KEY (id_sucursal)
    REFERENCES sucursal (id_sucursal)
    ON DELETE CASCADE
);

CREATE TABLE notificaciones (
  id SERIAL PRIMARY KEY,
  usuario_id INT REFERENCES usuarios(id),
  turno_id INT REFERENCES turnos(id),
  tipo VARCHAR(20), -- aviso, recordatorio, llamado
  mensaje TEXT,
  enviado BOOLEAN DEFAULT FALSE,
  fecha_envio TIMESTAMP DEFAULT NOW()
);

// Configuracion de mensajes y otros parametros para respuesta automatica
CREATE TABLE configuracion (
  id SERIAL PRIMARY KEY,
  clave VARCHAR(50) UNIQUE,
  valor TEXT
);

CREATE TABLE public.turnos (
  id_turnos SERIAL PRIMARY KEY,
  id_registro INT REFERENCES registros(id_registro) ON DELETE CASCADE,
  id_sucursal INT REFERENCES sucursal(id_sucursal) ON DELETE CASCADE,
  celular VARCHAR(20) NOT NULL,
  numero_turno VARCHAR(10) NOT NULL,
  codigo_seguridad VARCHAR(8) NOT NULL,
  estado VARCHAR(20) DEFAULT 'pendiente'
      CHECK (estado IN ('pendiente', 'atendiendo', 'finalizado', 'cancelado','asignado')),
  hora_creacion TIMESTAMPTZ DEFAULT NOW(),
  hora_llamado TIMESTAMPTZ,
  hora_finalizacion TIMESTAMPTZ,
  notificado BOOLEAN DEFAULT FALSE,
  observaciones TEXT,
  fecha_turno DATE DEFAULT CURRENT_DATE   -- ← columna normal, no generada
);
-- Agregar columna id_modulos a la tabla turnos
ALTER TABLE turnos
ADD COLUMN id_modulos INT NULL,
ADD CONSTRAINT fk_turno_modulo
  FOREIGN KEY (id_modulos)
  REFERENCES modulos (id_modulos)
  ON DELETE SET NULL;
  
ALTER TABLE public.turnos
ADD COLUMN id_login INT NULL,
ADD CONSTRAINT fk_turno_login
  FOREIGN KEY (id_login)
  REFERENCES public.login (id_login)
  ON DELETE SET NULL;

-- Trigger que actualiza automáticamente la fecha_turno al insertar
CREATE OR REPLACE FUNCTION set_fecha_turno()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_turno := NEW.hora_creacion::date;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_fecha_turno
BEFORE INSERT ON public.turnos
FOR EACH ROW
EXECUTE FUNCTION set_fecha_turno();

-- Índice único: un celular solo puede tener un turno activo por día
CREATE UNIQUE INDEX ix_turnos_uno_por_dia
  ON public.turnos (celular, fecha_turno)
  WHERE estado <> 'cancelado';

-- Gestion Proyecto

CREATE TABLE public.gestion_proyectos_config (
  id_config SERIAL PRIMARY KEY,
  telefono_whatsapp VARCHAR(20) NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  est_actual_dato BOOLEAN DEFAULT TRUE,
  fecha_creacion TIMESTAMP DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.gestion_proyectos_config_before_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.gestion_proyectos_config
  SET est_actual_dato = FALSE
  WHERE est_actual_dato = TRUE;

  NEW.est_actual_dato := TRUE;
  NEW.fecha_creacion := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gestion_proyectos_config_bi
BEFORE INSERT ON public.gestion_proyectos_config
FOR EACH ROW
EXECUTE FUNCTION public.gestion_proyectos_config_before_insert();
