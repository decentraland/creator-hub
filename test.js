import { exec } from 'child_process';
console.log('PATH', process.env.PATH);
console.log('NODE:', process.execPath);
const a = exec('node -v');
a.stdout.pipe(process.stdout);
a.stderr.pipe(process.stdout);
