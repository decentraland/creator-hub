import cli from './ipc/cli';
import path from './ipc/path';

export function initIpc() {
  cli();
  path();
}
