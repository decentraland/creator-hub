/**
 * Feature flags this app reads, as the flag service names them
 * (`<application>-<flag>`). A flag the service does not know is off, so a new
 * entry here is dark until someone turns it on.
 */
export enum FeatureFlag {
  /** The Analytics section. Off until the analytics API is deployed. */
  ANALYTICS = 'creatorhub-analytics',
  /** The in-editor AI scene assistant chat panel. Dark until turned on. */
  AI_CHAT = 'creatorhub-ai-chat',
}
