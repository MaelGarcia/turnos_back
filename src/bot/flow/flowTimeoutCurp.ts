import { addKeyword, EVENTS } from '@builderbot/bot';

export const flowTimeoutCurp = addKeyword(EVENTS.ACTION).addAnswer(
  '⏳ Tiempo de espera excedido.\nSi necesitas un turno, favor de escanear el *QR* de sucursal.',
  null,
  async (_, { endFlow }) => {
    return endFlow();
  }
);
