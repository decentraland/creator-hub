import type {
  CustomNotificationType,
  CustomNotification,
  GenericNotification,
  NotificationId,
  Severity,
  Opts,
} from './types';

let incrementalId = 0;

function getId(type: string): NotificationId {
  return `${type}_${++incrementalId}`;
}

export function createCustomNotification(
  notification: CustomNotificationType,
  opts?: Opts,
): CustomNotification {
  return { ...notification, ...opts, id: opts?.requestId || getId(notification.type) };
}

/**
 * Extract the user-actionable part of a preview/build failure for the toast (#1464).
 * A build error arrives as raw esbuild/CLI output — the useful line is the esbuild
 * diagnostic (`file:line:col: ERROR: message`), buried in a JS stack trace, absolute
 * node_modules paths, and an internal `Developer: All errors thrown must be an
 * instance of "CliError"` line. Keep just the diagnostic line(s); never surface the
 * stack/paths/internal text. Falls back to a short generic hint when no diagnostic is
 * present, so the toast always has a (closeable) detail rather than a raw dump.
 */
export function sanitizePreviewError(raw: string | undefined): string {
  const fallback = 'A build error stopped the preview. Check your scene code.';
  if (!raw) return fallback;
  const esbuildDiagnostic = /([^\s:]+):(\d+):(\d+):\s*(?:ERROR|error):\s*([^\n]+)/gi;
  const found: string[] = [];
  for (const match of raw.matchAll(esbuildDiagnostic)) {
    // Drop any absolute prefix before the project-relative src/ or assets/ segment.
    const file = match[1].replace(/^.*?(?=(?:src|assets)[/\\])/i, '');
    found.push(`${file}:${match[2]}:${match[3]} — ${match[4].trim()}`);
    if (found.length >= 5) break; // cap: don't stack a wall of errors in a toast
  }
  return found.length > 0 ? found.join('\n') : fallback;
}

export function createGenericNotification(
  severity: Severity,
  message: string,
  opts?: Opts & { description?: string },
): GenericNotification {
  const { description, ...rest } = opts || {};
  return {
    ...rest,
    id: rest?.requestId || getId('generic'),
    type: 'generic',
    severity,
    message,
    description,
  };
}
