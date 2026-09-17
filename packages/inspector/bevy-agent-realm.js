/**
 * The one contract between the Bevy editor-agent's exported realm and whoever
 * serves it.
 *
 * `sdk-commands export-static` bakes an absolute `baseUrl` into the realm's
 * `about`, but the serving origin isn't known until launch (both the Creator
 * Hub's inspector server and the dev proxy pick a port at start-up). So the
 * export writes a placeholder and the server swaps it in per request.
 *
 * Three places depend on these agreeing — the exporter (scripts/copy-bevy-agent),
 * the dev proxy (build.js) and the Creator Hub's inspector server
 * (creator-hub/main/src/modules/inspector.ts). The first two share this module;
 * CH can't import it (the inspector package only publishes dist/ and public/) so
 * it keeps its own copy, pointed back here by comment. If you change the
 * placeholder, change it there too — a mismatch doesn't throw, it just serves
 * `__ORIGIN__` verbatim and the agent silently never loads.
 *
 * Plain CommonJS on purpose: build.js is a plain node script, not part of any
 * TS build.
 */

const ORIGIN_PLACEHOLDER = '__ORIGIN__';

/** Realm name passed to export-static; also the dir it nests `about` under. */
const REALM_NAME = 'bevy-agent';

/** Where the realm is served from, under the inspector's `public/`. */
const SERVED_DIR = 'bevy-agent';

/** baseUrl written into the export. Trailing slash is required by export-static. */
const AGENT_BASE_URL = `http://${ORIGIN_PLACEHOLDER}/${SERVED_DIR}/`;

/** Request path of the realm manifest: the export nests `<realmName>/about`. */
const ABOUT_URL_PATH = `/${SERVED_DIR}/${REALM_NAME}/about`;

/** Path of the manifest on disk, relative to the served root. */
const ABOUT_FILE_PARTS = [SERVED_DIR, REALM_NAME, 'about'];

function rewriteAboutOrigin(contents, origin) {
  return contents.replaceAll(ORIGIN_PLACEHOLDER, origin);
}

module.exports = {
  ABOUT_FILE_PARTS,
  ABOUT_URL_PATH,
  AGENT_BASE_URL,
  ORIGIN_PLACEHOLDER,
  REALM_NAME,
  SERVED_DIR,
  rewriteAboutOrigin,
};
