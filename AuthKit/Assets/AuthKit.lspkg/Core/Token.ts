export interface IToken {
  access_token: string;
  refresh_token: string | null;
  expires_in: number;
  expiration_timestamp: number;
}

export class Token implements IToken {
  access_token: string;
  refresh_token: string | null;
  expires_in: number;
  expiration_timestamp: number;

  constructor(
    access_token: string,
    refresh_token?: string | null,
    expires_in?: number,
    expiration_timestamp?: number
  ) {
    this.access_token = access_token;
    this.refresh_token = refresh_token || null;
    this.expires_in = expires_in || 3600;
    this.expiration_timestamp = expiration_timestamp || (Date.now() + this.expires_in * 1000 - 60_000);
  }

  public toString() {
    return `Token(access_token=${this.access_token}, refresh_token=${this.refresh_token}, expires_in=${this.expires_in}, expiration_timestamp=${this.expiration_timestamp})`;
  }
}
