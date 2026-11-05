// True in dev-server and PR/branch builds; false only in a production release.
//
// The signed release is built with MODE=production and PR/dry-run builds with MODE=development
// (see `.github/workflows/creator-hub.yml` + `renderer/vite.config.js`, which sets vite's mode from
// `process.env.MODE`). `import.meta.env.PROD`/`DEV` CANNOT tell builds apart here — a `vite build`
// always reports `PROD === true` regardless of mode (Vite ties PROD to NODE_ENV, which a build forces
// to production) — so we key off `MODE`, which does reflect the build mode.
export const IS_NON_PRODUCTION_BUILD = import.meta.env.MODE !== 'production';
