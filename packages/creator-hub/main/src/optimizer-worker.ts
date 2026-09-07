import type { OptimizeWorkerJob, OptimizeWorkerMessage } from '/shared/types/optimizer';

import { runPipeline } from './modules/optimizer/pipeline';

// Entry of the optimizer worker: a separate bundle (main/vite.worker.config.js) that the host
// (modules/optimizer/index.ts) copies next to the downloaded toolchain and runs on the bundled
// real Node. The job arrives in OPTIMIZER_JOB; progress, the result, and errors go back as one
// JSON object per stdout line.

function send(message: OptimizeWorkerMessage): Promise<void> {
  return new Promise(resolve => {
    process.stdout.write(`${JSON.stringify(message)}\n`, () => resolve());
  });
}

async function main(): Promise<void> {
  const raw = process.env.OPTIMIZER_JOB;
  if (!raw) throw new Error('OPTIMIZER_JOB is not set');
  const job = JSON.parse(raw) as OptimizeWorkerJob;
  if (job.command !== 'run') {
    throw new Error(`Unknown optimizer job "${(job as { command: string }).command}"`);
  }
  const result = await runPipeline(job.projectPath, job.options, progress => {
    void send({ type: 'progress', progress });
  });
  await send({ type: 'result', result });
}

main().then(
  () => process.exit(0),
  async (error: unknown) => {
    await send({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  },
);
