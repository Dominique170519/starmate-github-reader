export type OAuthState = { nonce: string; returnTo: string; expiresAt: number };
export function hashToken(token: string): Promise<string>;
export function newOpaqueToken(): string;
export function signState(payload: OAuthState, secret: string): Promise<string>;
export function verifyState(token: string, secret: string, now?: number): Promise<OAuthState>;
