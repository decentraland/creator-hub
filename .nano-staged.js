export default {
  '*.{js,mjs,cjs,ts,mts,cts}': 'make lint-fix',
  '*.{js,ts,tsx,json}': 'make format-fix',
  '{package-lock.json,packages/**/{*.ts,tsconfig.json}}': 'make typecheck',
};
