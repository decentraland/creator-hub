/**
 * Navigation, permission and response-header restrictions for the app's web contents.
 *
 * ## Cross-origin isolation
 *
 * `self.crossOriginIsolated` — which the Bevy engine's `SharedArrayBuffer` requires — is only
 * true when the top-level document AND every ancestor frame are isolated via COOP: same-origin
 * plus COEP. The engine runs three frames deep: creator-hub renderer, inspector iframe,
 * bevy-engine iframe. The inspector and engine come from our http-server, which already stamps
 * these headers, but the top document loads from `file://` in production (mainWindow's
 * `loadFile`), which carries no HTTP headers, leaving the whole chain un-isolated and the
 * engine's asset-loader worker throwing `SharedArrayBuffer transfer requires
 * self.crossOriginIsolated`.
 *
 * The headers are therefore injected onto the app's own documents (`file://` renderer plus
 * localhost inspector) and nothing else, so external embeds such as YouTube, docs and studios
 * are unaffected — a blanket COEP would block their cross-origin subresources. COEP is
 * `credentialless` rather than `require-corp` so the inspector iframe's cross-origin
 * subresources load without needing CORP on every one, matching the inspector http-server and
 * the engine's own service worker.
 *
 * ## Frames the app embeds
 *
 * A document with COEP set may only embed a cross-origin *frame* whose own response also
 * carries COEP; `credentialless` relaxes that for subresources, not for frames. So once the
 * inspector document became isolated, the wearable-preview that renders GLB and emote previews
 * had to carry COEP or stop loading — and the import dialog waits on its `onLoad`, so the
 * spinner never resolved. All three environments are listed because decentraland-ui picks the
 * origin from its own env config.
 *
 * ## One listener, one handler
 *
 * Electron keeps only ONE `onHeadersReceived` listener per session — a second registration
 * replaces the first — so the Studios CORS rewrite and the isolation headers must share a
 * handler registered over the union of their filters, each rule applying to the URLs it
 * matches. CORS only fills in a header the response omitted; isolation is forced and replaces
 * whatever the response sent.
 *
 * ## Header names are case-insensitive, and a spread is not
 *
 * Electron rebuilds the whole response header block from the object the handler returns,
 * writing one line per key with no case-insensitive de-duplication, and it keys the incoming
 * object by the *wire* casing — lowercase over HTTP/2, which every CDN in front of these
 * origins speaks. Spreading a capitalized override on top of `details.responseHeaders`
 * therefore appends a SECOND header rather than replacing the response's own. Chromium joins
 * the two (`credentialless, credentialless`), fails to parse the result as a structured item
 * and falls back to `unsafe-none` — an injection that reads correctly while having no effect
 * at all, silently. A duplicated `Access-Control-Allow-Origin` is rejected outright. Hence
 * `setHeader` below, which drops every casing of a name before setting it.
 */
import { URL } from 'node:url';
import { session, type Session } from 'electron';
import { app, shell } from 'electron';

import { STUDIOS_ADMIN_URL } from '/shared/urls';

const IS_DEV = import.meta.env.DEV;

/**
 * Union for all existing permissions in electron
 */
type Permission = Parameters<
  Exclude<Parameters<Session['setPermissionRequestHandler']>[0], null>
>[1];

/**
 * A list of origins that you allow open INSIDE the application and permissions for them.
 *
 * In development mode you need allow open `VITE_DEV_SERVER_URL`.
 */
const ALLOWED_ORIGINS_AND_PERMISSIONS = new Map<string, Set<Permission>>(
  IS_DEV && import.meta.env.VITE_DEV_SERVER_URL
    ? [[new URL(import.meta.env.VITE_DEV_SERVER_URL).origin, new Set()]]
    : [],
);

/**
 * A list of origins that you allow open IN BROWSER.
 * Navigation to the origins below is only possible if the link opens in a new window.
 *
 * @example
 * <a
 *   target="_blank"
 *   href="https://github.com/"
 * >
 */

type AllowedOrigins<IsDev extends boolean> = IsDev extends true
  ? `http://${string}` | `https://${string}`
  : `https://${string}`;
const ALLOWED_EXTERNAL_ORIGINS = new Set<AllowedOrigins<typeof IS_DEV>>([
  'https://decentraland.org',
  'https://decentraland.today',
  'https://decentraland.zone',
  'https://studios.decentraland.org',
  STUDIOS_ADMIN_URL,
  'https://docs.decentraland.org',
  'https://youtube.com',
  'https://www.youtube.com',
  'https://github.com',
  ...(import.meta.env.VITE_ALLOWED_EXTERNAL_ORIGINS ?? '').split(',').filter(Boolean),
] as AllowedOrigins<typeof IS_DEV>[]);

app.on('ready', () => {
  const filter = {
    urls: ['https://studios.decentraland.org/*', `${STUDIOS_ADMIN_URL}/*`],
  };

  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    details.requestHeaders['Origin'] = '*';
    callback({ requestHeaders: details.requestHeaders });
  });

  const isolationFilter = { urls: ['file://*/*', 'http://localhost/*', 'http://localhost:*/*'] };

  const embedFilter = {
    urls: [
      'https://wearable-preview.decentraland.org/*',
      'https://wearable-preview.decentraland.today/*',
      'https://wearable-preview.decentraland.zone/*',
    ],
  };

  const combinedFilter = {
    urls: [...filter.urls, ...isolationFilter.urls, ...embedFilter.urls],
  };
  const matches = (url: string, patterns: string[]) =>
    patterns.some(pattern => {
      // Electron url patterns are `<scheme>://<host><path>` with `*` wildcards;
      // translate to a RegExp (escape regex metachars, `*` → `.*`).
      const re = new RegExp(
        '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
      );
      return re.test(url);
    });

  type ResponseHeaders = Record<string, string[]>;

  const hasHeader = (headers: ResponseHeaders, name: string) =>
    Object.keys(headers).some(key => key.toLowerCase() === name.toLowerCase());

  const setHeader = (headers: ResponseHeaders, name: string, value: string): ResponseHeaders => ({
    ...Object.fromEntries(
      Object.entries(headers).filter(([key]) => key.toLowerCase() !== name.toLowerCase()),
    ),
    [name]: [value],
  });

  session.defaultSession.webRequest.onHeadersReceived(combinedFilter, (details, callback) => {
    let responseHeaders: ResponseHeaders = details.responseHeaders ?? {};

    if (
      matches(details.url, filter.urls) &&
      !hasHeader(responseHeaders, 'Access-Control-Allow-Origin')
    ) {
      responseHeaders = setHeader(responseHeaders, 'Access-Control-Allow-Origin', '*');
    }

    if (matches(details.url, isolationFilter.urls)) {
      responseHeaders = setHeader(responseHeaders, 'Cross-Origin-Opener-Policy', 'same-origin');
      responseHeaders = setHeader(
        responseHeaders,
        'Cross-Origin-Embedder-Policy',
        'credentialless',
      );
      responseHeaders = setHeader(responseHeaders, 'Cross-Origin-Resource-Policy', 'cross-origin');
    }

    if (matches(details.url, embedFilter.urls)) {
      responseHeaders = setHeader(
        responseHeaders,
        'Cross-Origin-Embedder-Policy',
        'credentialless',
      );
    }

    callback({ responseHeaders });
  });
});

app.on('web-contents-created', (_, contents) => {
  /**
   * Block navigation to origins not on the allowlist.
   *
   * Navigation exploits are quite common. If an attacker can convince the app to navigate away from its current page,
   * they can possibly force the app to open arbitrary web resources/websites on the web.
   *
   * @see https://www.electronjs.org/docs/latest/tutorial/security#13-disable-or-limit-navigation
   */
  contents.on('will-navigate', (event, url) => {
    const { origin } = new URL(url);
    if (ALLOWED_ORIGINS_AND_PERMISSIONS.has(origin)) {
      return;
    }

    // Prevent navigation
    event.preventDefault();

    if (IS_DEV) {
      console.warn(`Blocked navigating to disallowed origin: ${origin}`);
    }
  });

  /**
   * Block requests for disallowed permissions.
   * By default, Electron will automatically approve all permission requests.
   *
   * @see https://www.electronjs.org/docs/latest/tutorial/security#5-handle-session-permission-requests-from-remote-content
   */
  contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const { origin } = new URL(webContents.getURL());

    const permissionGranted = !!ALLOWED_ORIGINS_AND_PERMISSIONS.get(origin)?.has(permission);
    callback(permissionGranted);

    if (!permissionGranted && IS_DEV) {
      console.warn(`${origin} requested permission for '${permission}', but was rejected.`);
    }
  });

  /**
   * Hyperlinks leading to allowed sites are opened in the default browser.
   *
   * The creation of new `webContents` is a common attack vector. Attackers attempt to convince the app to create new windows,
   * frames, or other renderer processes with more privileges than they had before; or with pages opened that they couldn't open before.
   * You should deny any unexpected window creation.
   *
   * @see https://www.electronjs.org/docs/latest/tutorial/security#14-disable-or-limit-creation-of-new-windows
   * @see https://www.electronjs.org/docs/latest/tutorial/security#15-do-not-use-openexternal-with-untrusted-content
   */
  contents.setWindowOpenHandler(({ url }) => {
    const { origin } = new URL(url);
    if (ALLOWED_EXTERNAL_ORIGINS.has(origin as AllowedOrigins<typeof IS_DEV>)) {
      // Open url in default browser.
      shell.openExternal(url).catch(console.error);
    } else if (IS_DEV) {
      console.warn(`Blocked the opening of a disallowed origin: ${origin}`);
    }

    // Prevent creating a new window.
    return { action: 'deny' };
  });

  /**
   * Verify webview options before creation.
   *
   * Strip away preload scripts, disable Node.js integration, and ensure origins are on the allowlist.
   *
   * @see https://www.electronjs.org/docs/latest/tutorial/security#12-verify-webview-options-before-creation
   */
  contents.on('will-attach-webview', (event, webPreferences, params) => {
    const { origin } = new URL(params.src);
    if (!ALLOWED_ORIGINS_AND_PERMISSIONS.has(origin)) {
      if (IS_DEV) {
        console.warn(`A webview tried to attach ${params.src}, but was blocked.`);
      }

      event.preventDefault();
      return;
    }

    // Strip away preload scripts if unused or verify their location is legitimate.
    delete webPreferences.preload;
    // @ts-expect-error `preloadURL` exists. - @see https://www.electronjs.org/docs/latest/api/web-contents#event-will-attach-webview
    delete webPreferences.preloadURL;

    // Disable Node.js integration
    webPreferences.nodeIntegration = false;

    // Enable contextIsolation
    webPreferences.contextIsolation = true;
  });
});
