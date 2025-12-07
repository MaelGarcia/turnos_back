import { Pool } from 'pg'
import { PostgreSQLAdapter as Database } from '@builderbot/database-postgres'
import 'dotenv/config'
// Config base
const cfg = {
  host: process.env.POSTGRES_DB_HOST,
  user: process.env.POSTGRES_DB_USER,
  password: process.env.POSTGRES_DB_PASSWORD,
  database: process.env.POSTGRES_DB_NAME,
  port: Number(process.env.POSTGRES_DB_PORT),
}

let pool: Pool | null = null

export function getPool() {  
  if (!pool) {
    pool = new Pool(cfg)

    pool.on('connect', (client) => {
      client.query(`SET TIME ZONE 'America/Mexico_City';`)
    })

    pool.on('error', (err) => {
      console.error('[DB] Pool error:', err.message || err)
    })
  }
  return pool
}

export async function query(text: string, params?: any[]) {
  const client = await getPool().connect()
  try {
    return await client.query(text, params)
  } finally {
    client.release()
  }
}

export function createBotDBAdapter() {
  return new Database({
    host: cfg.host,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    port: cfg.port,
  })
}

export async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
  }
}
