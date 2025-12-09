
import { addKeyword, EVENTS } from '@builderbot/bot'; 

export const flowFallback = addKeyword(EVENTS.ACTION).addAnswer(
  'Requiere algun servicio, favor de escanear el *QR* de tu sucursal',
  null,

  async (ctx, { endFlow }) => {
    return endFlow(); 
  }
);
