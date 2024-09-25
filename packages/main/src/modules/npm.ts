import { run } from './bin';

export async function install(path: string) {
  const installCommand = run('npm', 'npm', { args: ['install', '--loglevel', 'error'], cwd: path });
  await installCommand.wait();
}
