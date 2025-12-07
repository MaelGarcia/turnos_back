import { createBot, createProvider, createFlow, addKeyword, utils } from '@builderbot/bot'
import { PostgreSQLAdapter as Database } from '@builderbot/database-postgres'
import { BaileysProvider as Provider } from 'builderbot-provider-sherpa'
import { createBotDBAdapter } from '../db/config'
import { flowPrincipal } from '../bot/flow/flow_service'
import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 25;

const PORT = process.env.PORT

const welcomeFlow = addKeyword<Provider, Database>(['hi', 'hello', 'hola'])
  .addAnswer('🙌 Hola *BIENVENIDO AL SISTEMA DE SERVICIOS DE LICENCIAS*, porfavor ingresal la palabra *SUCURSAL* seguido de el id de la sucursal de la cual requieras informacion y tramites')


export const startBot = async () => {
  const adapterFlow = createFlow([flowPrincipal,welcomeFlow])
  const adapterProvider = createProvider(Provider, { version: [2, 3000, 1025190524] as any})
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
