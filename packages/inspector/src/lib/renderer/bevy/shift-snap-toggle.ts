/**
 * Holding Shift inverts the Snap panel for as long as it's held (#1375): snap on
 * → smooth fine-tuning, snap off → snapped. Babylon does this in `initKeyboard`
 * by toggling the shared `snapManager` on Shift down and restoring it on Shift
 * up, and under Bevy the SAME flag has to flip — not just the snap increments the
 * agent is told about. The reverse channel re-snaps every gizmo preview and commit
 * authoritatively through `snapManager` (`mergeTransform`), so a drag the agent
 * left smooth was quantized back onto the grid on the inspector side, and Shift
 * never produced a fine-tuned move. Flipping the manager makes the agent's
 * feedback, the live preview and the committed Transform agree.
 *
 * The pre-Shift state is restored on release (and on disconnect), matching Babylon.
 */

export interface ShiftSnapToggleOptions {
  /** True while Shift is held in the viewport (the modifier tracker; Shift typed
   * in an inspector field must not flip the global Snap setting). */
  isShift(): boolean;
  /** Fires on every Shift press/release transition. Returns an unsubscribe. */
  onShiftChange(cb: () => void): () => void;
  /** The editor's snap setting (the toolbar's Snap panel). */
  snap: { isEnabled(): boolean; setEnabled(enabled: boolean): void };
}

export function createShiftSnapToggle(options: ShiftSnapToggleOptions): () => void {
  const { snap } = options;
  // The Snap panel's own state while Shift is held, so release restores it.
  let restoreTo: boolean | null = null;

  const sync = () => {
    if (options.isShift()) {
      if (restoreTo !== null) return;
      restoreTo = snap.isEnabled();
      snap.setEnabled(!restoreTo);
    } else if (restoreTo !== null) {
      snap.setEnabled(restoreTo);
      restoreTo = null;
    }
  };

  const off = options.onShiftChange(sync);
  return () => {
    off();
    if (restoreTo !== null) {
      snap.setEnabled(restoreTo);
      restoreTo = null;
    }
  };
}
