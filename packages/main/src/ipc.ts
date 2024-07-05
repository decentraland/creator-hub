import cli from './ipc/cli';
import app from './ipc/app';

export function initIpc() {
  cli();
  app();
}
