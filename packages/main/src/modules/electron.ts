import {app} from 'electron';

export function getHome() {
  return app.getPath('home');
}
