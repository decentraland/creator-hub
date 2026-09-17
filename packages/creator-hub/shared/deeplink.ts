/** Channel used to push a deep-link sign-in payload to the renderer.*/
export const AUTH_DEEPLINK_SIGNIN_CHANNEL = 'auth:deep-link-signin';

/**
 * Payload of a deep-link sign in, forwarded from the main process to the renderer.
 *
 * `authRequestId` is the id this app instance generated when it opened the auth
 * dapp, echoed back by the dapp in the deep link. It is the only thing tying the
 * returned identity to the sign in that was started here, so the renderer must
 * match it before applying the identity. It is null when the link carries no
 * correlation id.
 */
export type DeepLinkSignIn = {
  identityId: string;
  authRequestId: string | null;
};
