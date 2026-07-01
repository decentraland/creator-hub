/**
 * Same-origin console transport to the bevy-explorer engine.
 *
 * The engine is a black box driven entirely by console commands — there is no JS
 * entity API (see the feasibility study). When the engine boots it installs
 * `engine_console_command_args` on its own `window`; because we mount it in a
 * **same-origin** iframe, the inspector can call that function on the iframe's
 * `contentWindow` directly (no postMessage). This is the exact seam bevy-editor
 * uses (`packages/ui/src/console.ts`).
 *
 * `consoleCommand(cmd, args)` returns the engine's reply string; callers parse
 * it. `engineReady(win)` reports whether the console function is installed yet.
 */

/** The subset of the engine window the console transport touches. */
export interface EngineWindow extends Window {
  engine_console_command_args?: (cmd: string, args: string[]) => Promise<string>;
  engine_console_command?: (line: string) => Promise<string>;
}

/** True once the engine has installed its console command function. */
export function engineReady(win: EngineWindow | null | undefined): boolean {
  if (!win) return false;
  try {
    return (
      typeof win.engine_console_command_args === 'function' ||
      typeof win.engine_console_command === 'function'
    );
  } catch {
    // Cross-origin access throws — treat as not-ready rather than crashing.
    return false;
  }
}

/**
 * Run a console command against the engine window. `cmd` is the command name
 * without the leading slash (e.g. `'crdt_snapshot'`). Resolves with the reply
 * string; rejects if the console isn't available or the command fails.
 */
export async function consoleCommand(
  win: EngineWindow,
  cmd: string,
  args: string[] = [],
): Promise<string> {
  if (typeof win.engine_console_command_args === 'function') {
    return win.engine_console_command_args(cmd, args);
  }
  if (typeof win.engine_console_command === 'function') {
    return win.engine_console_command([cmd, ...args].join(' '));
  }
  throw new Error('bevy engine console API not available yet');
}
