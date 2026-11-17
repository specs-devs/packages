/**
 * SPECS Inc. 2027
 * Token data structures for OAuth2 authentication. Defines the interface and class for managing
 * access tokens, refresh tokens, and token expiration timestamps.
 */
export interface IToken {
  access_token: string;
  refresh_token: string | null;
  expires_in: number;
  expiration_timestamp: number;
  id_token?: string | null;
}

export class Token implements IToken {
  access_token: string;
  refresh_token: string | null;
  expires_in: number;
  expiration_timestamp: number;
  id_token: string | null;

  constructor(
    access_token: string,
    refresh_token?: string | null,
    expires_in?: number,
    expiration_timestamp?: number,
    id_token?: string | null
  ) {
    this.access_token = access_token;
    this.refresh_token = refresh_token || null;
    this.expires_in = expires_in || 3600;
    this.expiration_timestamp = expiration_timestamp || (Date.now() + this.expires_in * 1000 - 60_000);
    this.id_token = id_token || null;
  }

  public toString() {
    // Mask sensitive values to avoid leaking full tokens and identity claims in logs.
    // Keep the first and last 4 chars so logs remain useful for debugging.
    const mask = (v: string | null) => {
      if (!v) return "null";
      if (v.length <= 8) return "<redacted>";
      return `${v.slice(0, 4)}...${v.slice(-4)}`;
    };
    return `Token(access_token=${mask(this.access_token)}, refresh_token=${mask(this.refresh_token)}, expires_in=${this.expires_in}, expiration_timestamp=${this.expiration_timestamp}, id_token=${mask(this.id_token)})`;
  }
}
