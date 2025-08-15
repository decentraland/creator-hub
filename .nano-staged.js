export default {
  '*.{js,mjs,cjs,ts,mts,cts,vue}': 'make lint-fix',
  '*.{js,ts,tsx,json}': 'make format',
  '{package-lock.json,packages/**/{*.ts,tsconfig.json}}': 'make typecheck',
};
