import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'
import { PostgreSQLAdapter as Database } from '@builderbot/database-postgres'
import { BaileysProvider as Provider } from 'builderbot-provider-sherpa'
import { createBotDBAdapter } from '../db/config'
import { flowPrincipal } from '../bot/flow/flow_service'
import { EventEmitter } from 'events';
import { flowTimeoutCurp } from './flow/flowTimeoutCurp'
import { flowFallback } from './flow/flowFallBack'
EventEmitter.defaultMaxListeners = 25;

const PORT = process.env.PORT

const welcomeFlow = addKeyword<Provider, Database>(['hi', 'hello', 'hola'])
  .addAnswer('🙌 Hola *BIENVENIDO AL SISTEMA DE SERVICIOS DE LICENCIAS*, porfavor escanea el *QR* de tu sucursal para mas información')

const flowSecundario = addKeyword(EVENTS.WELCOME)
    .addAnswer(
        'Favor de escanear el *QR* de tu sucursal para mas información',
        { capture: true},
        null,
        null
    )

export const startBot = async () => {
  const adapterFlow = createFlow([flowPrincipal,flowSecundario,flowTimeoutCurp])
  const adapterProvider = createProvider(Provider, { version: [2, 3000, 1027934701] as any})
  const adapterDB = createBotDBAdapter()

  const { httpServer,handleCtx } = await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  })

  httpServer(+PORT)

  adapterProvider.server.post(
    '/v1/messages',
    handleCtx(async (bot, req, res) => {
      const { number, message } = req.body
      await bot.sendMessage(number, message, {})

      return res.end('send')
    })
  )

  
}
