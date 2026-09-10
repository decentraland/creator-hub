#!/usr/bin/env node
const child_process = require('child_process');
const { builtinModules } = require('module');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { future } = require('fp-future');
const esbuild = require('esbuild');
const dotenv = require('dotenv');
const { ABOUT_FILE_PARTS, ABOUT_URL_PATH, rewriteAboutOrigin } = require('./bevy-agent-realm.js');

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
      // Only the dev-only code parser imports a .wasm; inlining it as bytes
      // keeps it out of `public/` (nothing extra to serve or publish), and out
      // of production bundles entirely (the importing module is dead code).
      '.wasm': 'binary',
    },
    banner: {
      // prepend hot-reload script to the bundle when in development mode
      js: PRODUCTION
        ? ''
        : `;(() => {${fs.readFileSync(path.resolve(__dirname, './hot-reload.js'), 'utf-8')}})();`,
    },
    define: { ...getEnvVars(), INSPECTOR_DEV_PARSER: JSON.stringify(!PRODUCTION) },
  });

  if (WATCH_MODE) {
    await context.watch();
    // esbuild serves the bundle + public/ on an internal port; a thin proxy in
    // front stamps COOP/COEP on every response. `port: 0` keeps that internal
    // port EPHEMERAL: esbuild otherwise defaults to 8000, which is the port a
    // developer is most likely to ask for via VITE_INSPECTOR_PORT — and it would
    // then lose the race to its own upstream and fail to bind. The bevy-explorer engine wasm
    // (served under public/bevy-engine) uses SharedArrayBuffer threads, which
    // the browser only enables for cross-origin-isolated documents — i.e. ones
    // served with `Cross-Origin-Opener-Policy: same-origin` +
    // `Cross-Origin-Embedder-Policy: require-corp`. esbuild's serve() can't set
    // response headers, so we can't add them there directly.
    const internal = await context.serve({ servedir: 'public', port: 0 });
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
    if (serveAgentAbout(req, res)) return;
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
    // Honour VITE_INSPECTOR_PORT — the SAME variable the Creator Hub reads to
    // decide where to point its inspector iframe, so one value wires both sides.
    // Without it the port is ephemeral, which is unusable as an iframe target;
    // that is why pointing the Hub at a dev inspector used to mean aiming at
    // esbuild's own port instead, which serves the bundle but none of the
    // cross-origin isolation below — and the Bevy engine then can't boot.
    const requested = Number(process.env.VITE_INSPECTOR_PORT) || 0;
    server.once('error', err => {
      if (err.code === 'EADDRINUSE' && requested) {
        reject(
          new Error(
            `VITE_INSPECTOR_PORT=${requested} is already in use. Most often that is a ` +
              'previous watch server that outlived its terminal — find it with ' +
              `\`lsof -nP -iTCP:${requested} -sTCP:LISTEN\` and kill it. Or unset the ` +
              'variable to serve on a random port (the Creator Hub can then only load a ' +
              'prebuilt inspector).',
          ),
        );
        return;
      }
      reject(err);
    });
    server.listen(requested, upstreamHost, () => resolve(server.address().port));
  });
}

// Serve the Bevy editor-agent's realm manifest with this server's origin patched
// in, the way the Creator Hub's inspector server does. The export bakes a
// placeholder because neither server knows its port until launch; esbuild's
// static handler would send it through verbatim, and the engine would then fetch
// the agent's content from a host called `__ORIGIN__`.
//
// The origin comes from the request's own Host header rather than the bound
// port, so it stays right however the browser reached us.
//
// Returns true when it handled the request.
function serveAgentAbout(req, res) {
  const url = (req.url || '').split('?')[0];
  if (url !== ABOUT_URL_PATH) return false;
  let contents;
  try {
    contents = fs.readFileSync(path.resolve(__dirname, 'public', ...ABOUT_FILE_PARTS), 'utf8');
  } catch {
    return false; // not exported (Bevy never built) — let the proxy 404 it
  }
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  res.end(rewriteAboutOrigin(contents, req.headers.host));
  return true;
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
