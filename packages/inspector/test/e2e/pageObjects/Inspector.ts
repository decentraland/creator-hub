import { type Page } from 'playwright';

declare const page: Page;

type ComponentSnapshot = Record<string, unknown> | null;

/**
 * Engine-state readers backed by the global `window.store` exposed in
 * `src/redux/store.ts`. Avoids depending on the EntityInspector UI rendering,
 * which is conditional on smart-item Config (`isBasicViewEnabled`) and other
 * runtime flags — `.GltfInspector` / `.ActionInspector` aren't always
 * mounted for the selected entity. Reading directly from the inspector engine
 * is the most stable way to assert post-spawn component state in e2e.
 */
class InspectorPageObject {
  async waitForEngineReady(timeout = 30_000) {
    await page.waitForFunction(
      () => !!(window as any).store?.getState?.().sdk?.inspectorEngine,
      undefined,
      { timeout },
    );
  }

  /** Returns the component value for an entity, or null if the component isn't attached. */
  async getComponent(entityId: number, componentName: string): Promise<ComponentSnapshot> {
    return page.evaluate(
      ({ id, name }: { id: number; name: string }) => {
        const engine = (window as any).store?.getState?.().sdk?.inspectorEngine;
        if (!engine) return null;
        const Component = engine.getComponentOrNull(name);
        if (!Component) return null;
        const value = Component.getOrNull(id);
        if (!value) return null;
        return JSON.parse(JSON.stringify(value));
      },
      { id: entityId, name: componentName },
    );
  }

  /**
   * Polls `getComponent` until it returns a non-null value or the timeout
   * elapses. Useful right after a spawn, when the CRDT sync hasn't finished
   * propagating into the inspector engine yet.
   */
  async waitForComponent(
    entityId: number,
    componentName: string,
    timeout = 15_000,
  ): Promise<ComponentSnapshot> {
    const deadline = Date.now() + timeout;
    let lastValue: ComponentSnapshot = null;
    while (Date.now() < deadline) {
      lastValue = await this.getComponent(entityId, componentName);
      if (lastValue !== null) return lastValue;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return lastValue;
  }
}

export const Inspector = new InspectorPageObject();
