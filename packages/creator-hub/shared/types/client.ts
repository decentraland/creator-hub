import { ErrorBase } from './error';

export const CLIENT_NOT_INSTALLED_ERROR = 'Decentraland Desktop Client failed with';

export type ClientErrorType = 'CLIENT_NOT_INSTALLED';

export class ClientError extends ErrorBase<ClientErrorType> {}

export const isClientNotInstalledError = (error: unknown): error is ClientError =>
  isClientError(error, 'CLIENT_NOT_INSTALLED') ||
  (error as Error)?.message?.includes(CLIENT_NOT_INSTALLED_ERROR); // Some thrown errors are not wrapped in ClientError

export const isClientError = (error: unknown, type: ClientErrorType): error is ClientError =>
  error instanceof ClientError && error.name === type;
