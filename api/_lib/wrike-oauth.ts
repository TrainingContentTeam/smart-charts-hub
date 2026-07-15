import { requireEnv } from "./env.js";

const AUTHORIZATION_URL = "https://login.wrike.com/oauth2/authorize/v4";
const TOKEN_URL = "https://login.wrike.com/oauth2/token";
export const WRIKE_OAUTH_SCOPE = "wsReadOnly";

export interface WrikeTokenExchange {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  host: string;
  scope: string;
}

interface WrikeTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: string | number;
  host?: string;
  scope?: string;
}

export class WrikeOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WrikeOAuthError";
  }
}

export function buildWrikeAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("WRIKE_CLIENT_ID"),
    response_type: "code",
    redirect_uri: requireEnv("WRIKE_REDIRECT_URI"),
    state,
    scope: WRIKE_OAUTH_SCOPE,
  });

  return `${AUTHORIZATION_URL}?${params.toString()}`;
}

export async function exchangeWrikeAuthorizationCode(code: string): Promise<WrikeTokenExchange> {
  const params = new URLSearchParams({
    client_id: requireEnv("WRIKE_CLIENT_ID"),
    client_secret: requireEnv("WRIKE_CLIENT_SECRET"),
    grant_type: "authorization_code",
    code,
    redirect_uri: requireEnv("WRIKE_REDIRECT_URI"),
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new WrikeOAuthError(`Wrike rejected the authorization code (HTTP ${response.status}).`);
  }

  const tokenResponse = (await response.json()) as WrikeTokenResponse;
  const expiresIn = Number(tokenResponse.expires_in);

  if (
    !tokenResponse.access_token ||
    !tokenResponse.refresh_token ||
    !tokenResponse.host ||
    !Number.isFinite(expiresIn)
  ) {
    throw new WrikeOAuthError("Wrike token response was missing required fields.");
  }

  return {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresIn,
    host: tokenResponse.host,
    scope: tokenResponse.scope || WRIKE_OAUTH_SCOPE,
  };
}
