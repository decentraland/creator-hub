import { future } from 'fp-future';
import net, { type AddressInfo } from 'net';

export async function getAvailablePort() {
  const promise = future<number>();
  const server = net.createServer();
  server.unref();
  server.on('error', promise.reject);
  server.listen(() => {
    const { port } = server.address() as AddressInfo;
    server.close(() => {
      promise.resolve(port);
    });
  });
  return promise;
}
