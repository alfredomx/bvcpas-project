declare module 'intuit-oauth' {
  export interface OAuthClientConfig {
    clientId: string
    clientSecret: string
    environment: 'sandbox' | 'production'
    redirectUri: string
    state?: string
    logging?: boolean
  }

  export interface OAuthToken {
    realmId: string
    token_type: string
    access_token: string
    refresh_token: string
    expires_in: number
    x_refresh_token_expires_in: number
    id_token: string
    latency: number
    createdAt: number
  }

  export interface AuthorizeUriParams {
    scope: string | string[]
    state?: string
  }

  export interface MakeApiCallParams {
    url: string
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    headers?: Record<string, string>
    body?: unknown
    params?: Record<string, unknown>
    timeout?: number
    responseType?: 'json' | 'text' | 'stream' | 'arraybuffer'
    maxRetries?: number
  }

  export interface AuthResponse {
    status: number
    statusText: string
    headers: Record<string, string>
    json: unknown
    body: string
    token: OAuthToken
  }

  export interface OAuthClientInstance {
    authorizeUri(params: AuthorizeUriParams): string
    createToken(uri: string): Promise<AuthResponse>
    refresh(): Promise<AuthResponse>
    refreshUsingToken(refresh_token: string): Promise<AuthResponse>
    revoke(params?: { access_token?: string; refresh_token?: string }): Promise<AuthResponse>
    getUserInfo(): Promise<AuthResponse>
    makeApiCall(params: MakeApiCallParams): Promise<AuthResponse>
    getToken(): OAuthToken
    setToken(token: Partial<OAuthToken>): OAuthToken
    validateToken(): void
    isAccessTokenValid(): boolean
    getAuthHeader(): string
  }

  interface OAuthClientConstructor {
    new (config: OAuthClientConfig): OAuthClientInstance
    scopes: {
      Accounting: string
      Payment: string
      Payroll: string
      TimeTracking: string
      Benefits: string
      Profile: string
      Email: string
      Phone: string
      Address: string
      OpenId: string
      Intuit_name: string
    }
    environment: {
      sandbox: string
      production: string
    }
  }

  const OAuthClient: OAuthClientConstructor
  export default OAuthClient

  type OAuthClient = OAuthClientInstance
  export { OAuthClient }
}
