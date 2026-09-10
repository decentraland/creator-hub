/**
 * Feature flags this app reads, as the flag service names them
 * (`<application>-<flag>`). A flag the service does not know is off, so a new
 * entry here is dark until someone turns it on.
 */
export enum FeatureFlag {
  /** The Analytics section. Off until the analytics API is deployed. */
  ANALYTICS = 'creatorhub-analytics',
  /**
   * Reads asset-bundle conversion status from the abgen registry instead of the Unity
   * converter's. Owned by the explorer, which flips its registry and CDN together on this
   * same flag — the two apps have to agree on which pipeline converted a scene.
   */
  ABGEN_PIPELINE = 'explorer-alfa-abgen-pipeline',
}
