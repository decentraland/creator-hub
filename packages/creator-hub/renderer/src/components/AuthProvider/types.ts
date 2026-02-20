import type { Socket } from 'socket.io-client';
import type { EphemeralAuthAccount } from '/@/lib/auth';

export type AuthSignInProps = {
  socket: Socket;
  ephemeralAccount: EphemeralAuthAccount;
  expiration: Date;
  ephemeralMessage: string;
  requestResponse: any;
};
