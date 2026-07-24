#!/usr/bin/env node
const child_process = require('child_process');
const { builtinModules } = require('module');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { future } = require('fp-future');
const esbuild = require('esbuild');
const dotenv = require('dotenv');

const WATCH_MODE = process.argv.includes('--watch');
const PRODUCTION = process.argv.includes('--production');

// the following modules will not be embedded in the NodeJs bundle.
// we create a bundle because many dependencies are exported as ESM and Node
// is not ready yet to support them OOTB
const externalModulesArray = getNotBundledModules();

async function main() {
  const context = await esbuild.context({
    entryPoints: ['src/index.tsx'],
    bundle: true,
    platform: 'browser',
    outfile: 'public/bundle.js',
    sourcemap: 'linked',
    minify: PRODUCTION,
    loader: {
      '.png': 'dataurl',
      '.svg': 'dataurl',
      '.eot': 'dataurl',
      '.woff': 'dataurl',
      '.woff2': 'dataurl',
      '.ttf': 'dataurl',
      '.glb': 'dataurl',
    },
    banner: {
      // prepend hot-reload script to the bundle when in development mode
      js: PRODUCTION
        ? ''
        : `;(() => {${fs.readFileSync(path.resolve(__dirname, './hot-reload.js'), 'utf-8')}})();`,
    },
    define: { ...getEnvVars() },
  });

  if (WATCH_MODE) {
    await context.watch();
    // esbuild serves the bundle + public/ on an internal port; a thin proxy in
    // front stamps COOP/COEP on every response. The bevy-explorer engine wasm
    // (served under public/bevy-engine) uses SharedArrayBuffer threads, which
    // the browser only enables for cross-origin-isolated documents — i.e. ones
    // served with `Cross-Origin-Opener-Policy: same-origin` +
    // `Cross-Origin-Embedder-Policy: require-corp`. esbuild's serve() can't set
    // response headers, so we can't add them there directly.
    const internal = await context.serve({ servedir: 'public' });
    const publicPort = await serveWithCrossOriginIsolation(internal.host, internal.port);
    console.log(`> Serving on http://localhost:${publicPort}`);
  } else {
    console.time('> Building browser bundle');
    await context.rebuild();
    await context.dispose();
    console.timeEnd('> Building browser bundle');
  }

  await buildCommonJsDistributable();
  await runTypeChecker();
}

// Reverse-proxy in front of esbuild's dev server that adds the cross-origin
// isolation headers on every response (esbuild's serve() can't set headers).
// Without cross-origin isolation the browser refuses SharedArrayBuffer, so the
// bevy-explorer engine wasm (served from public/bevy-engine) won't boot.
// Resolves with the public port it bound.
//
// COEP is `credentialless`, not `require-corp`: the engine loads cross-origin
// subresources (CDN scripts, and at runtime scene assets) that don't all send
// CORP. `require-corp` would block those; `credentialless` still yields
// crossOriginIsolated (so SharedArrayBuffer works) while fetching cross-origin
// no-cors subresources without credentials. This matches what the engine's own
// service worker sets (see bevy-engine/service_worker.js + its issue #807 note).
function serveWithCrossOriginIsolation(upstreamHost, upstreamPort) {
  const server = http.createServer((req, res) => {
    const proxyReq = http.request(
      {
        host: upstreamHost,
        port: upstreamPort,
        method: req.method,
        path: req.url,
        headers: req.headers,
      },
      proxyRes => {
        res.writeHead(proxyRes.statusCode ?? 502, {
          ...proxyRes.headers,
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'credentialless',
          // Lets the isolated top document embed the engine's own subresources.
          'Cross-Origin-Resource-Policy': 'cross-origin',
        });
        proxyRes.pipe(res);
      },
    );
    proxyReq.on('error', () => {
      res.writeHead(502).end('bad gateway');
    });
    req.pipe(proxyReq);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    // Ephemeral port (0), matching esbuild's default; the caller logs it.
    server.listen(0, upstreamHost, () => resolve(server.address().port));
  });
}

async function buildCommonJsDistributable() {
  const context = await esbuild.context({
    entryPoints: ['src/tooling-entrypoint.ts'],
    bundle: true,
    platform: 'node',
    outfile: 'dist/tooling-entrypoint.js',
    sourcemap: 'both',
    minify: PRODUCTION,
    external: externalModulesArray,
    loader: {
      '.glb': 'dataurl',
    },
  });

  if (WATCH_MODE) {
    await context.watch();
  } else {
    console.time('> Building NodeJs bundle');
    await context.rebuild();
    await context.dispose();
    console.timeEnd('> Building NodeJs bundle');
  }
}

main().catch(err => {
  process.exitCode = 1;
  console.error(err);
  process.exit(1);
});

function runTypeChecker() {
  const args = [require.resolve('typescript/lib/tsc'), '-p', 'tsconfig.json'];
  if (WATCH_MODE) args.push('--watch');

  console.time('> Running typechecker');
  const ts = child_process.spawn('node', args, {
    env: process.env,
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const typeCheckerFuture = future();

  ts.on('close', code => {
    console.timeEnd('> Running typechecker');
    console.log('  Type checker exit code:', code);
    if (code !== 0) {
      typeCheckerFuture.reject(new Error(`Typechecker exited with code ${code}.`));
      return;
    }

    typeCheckerFuture.resolve(code);
  });

  ts.stdout.pipe(process.stdout);
  ts.stderr.pipe(process.stderr);

  if (WATCH_MODE) {
    typeCheckerFuture.resolve();
  }

  return typeCheckerFuture;
}

function getNotBundledModules() {
  // || true is added because `npm ls` fails installing a package from S3.
  // stderr is muted so harmless transitive-dependency warnings don't pollute
  // the dev server output; stdout stays piped for JSON.parse below.
  const child = child_process.execSync('npm ls --all --json || true', {
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 64 * 1024 * 1024,
  });
  const ret = JSON.parse(child.toString());

  const externalModules = new Set();
  function traverseDependencies(obj) {
    if (obj.dependencies)
      for (let depName in obj.dependencies) {
        const dep = obj.dependencies[depName];
        externalModules.add(depName);
        traverseDependencies(dep);
      }
  }
  traverseDependencies(ret);

  // now remove the ESM dependencies
  const esmModulesToBundle = [
    '@dcl/sdk',
    '@dcl/ecs',
    '@dcl/mini-rpc',
    '@dcl/asset-packs',
    '@dcl-sdk/utils',
    '@dcl/gltf-validator-ts',
  ];
  return Array.from(externalModules)
    .concat(builtinModules)
    .filter($ => !esmModulesToBundle.includes($));
}

function getEnvVars() {
  const envVars = {};
  dotenv.config();

  for (const env in process.env) {
    // Skip environment variables with invalid characters for JavaScript identifiers
    // This includes parentheses, spaces, and other special characters
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(env)) {
      envVars[`process.env.${env}`] = JSON.stringify(process.env[env] ?? true);
    }
  }

  return envVars;
}
