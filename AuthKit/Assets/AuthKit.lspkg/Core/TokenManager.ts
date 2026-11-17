/**
 * SPECS Inc. 2027
 * Token persistence and refresh manager for OAuth2. Handles saving tokens to persistent storage,
 * restoring tokens on app restart, and refreshing expired tokens automatically.
 */
import { IToken, Token } from "./Token";

const INTERNET_MODULE = require("LensStudio:InternetModule") as InternetModule;
export class TokenManager {
  storage: GeneralDataStore;

  constructor(storage?: GeneralDataStore) {
    this.storage = storage || global.persistentStorageSystem.store;
  }

  save(clientId: string, token: Token) {
    this.storage.putString(clientId, JSON.stringify(token));
  }

  restoreToken(clientId: string) {
    const tokenJson = this.storage.getString(clientId);

    if (!tokenJson) {
      return undefined;
    }
    const parsedToken = JSON.parse(tokenJson) as IToken;

    return new Token(
      parsedToken.access_token,
      parsedToken.refresh_token,
      parsedToken.expires_in,
      parsedToken.expiration_timestamp,
      parsedToken.id_token
    );
  }

  clearToken(clientId: string) {
    this.storage.remove(clientId);
  }

  async refreshToken({
    clientId,
    refresh_token,
    tokenUri,
    basicAuth,
    id_token,
  }: {
    clientId: string;
    refresh_token: string;
    tokenUri: string;
    basicAuth?: string;
    id_token?: string | null;
  }) {
    const headers = { "Content-Type": "application/x-www-form-urlencoded" };
    if (basicAuth) headers["Authorization"] = "Basic " + basicAuth;

    // LS 5.21+ marks the `Request` constructor as `protected` in StudioLib.d.ts;
    // the runtime still accepts direct construction so we relax the TS check here.
    const request = new (Request as any)(tokenUri, {
      method: "POST",
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refresh_token)}&client_id=${encodeURIComponent(clientId)}`,
      headers,
    });

    const response = await INTERNET_MODULE.fetch(request);
    if (!response.ok) throw new Error("Failed to refresh token");

    const refresh = await response.json();
    // expires_in is optional (RFC 6749 §5.1); Token falls back to 3600 s without it.
    if (!refresh.access_token) {
      throw new Error("Token refresh response missing access_token");
    }

    return new Token(
      refresh.access_token,
      refresh.refresh_token || refresh_token,
      refresh.expires_in,
      undefined,
      refresh.id_token || id_token
    );
  }
}
