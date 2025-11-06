// Type definitions for Shopify OAuth Worker

export interface ShopData {
  accessToken: string;
  scope: string;
  installedAt: string;
}

export interface ApiKeyData {
  shop: string;
  accessToken: string;
  createdAt: string;
}

export interface TokenResponse {
  access_token: string;
  scope: string;
}

export interface ShopifyApiResponse {
  data: any;
  status: number;
}

export interface Environment {
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_APP_HANDLE: string;
  SHOPIFY_API_VERSION: string;
  OAUTH_SCOPES: string;
  APP_URL: string;
  SHOPS: KVNamespace;
  AUTH_STATES: KVNamespace;
  API_KEYS: KVNamespace;
}

export interface Webhook {
  topic: string;
  address: string;
}

export interface ProxyRequest {
  endpoint: string;
  method?: string;
  data?: any;
}

export interface ApiRequest {
  shop: string;
}

export interface WebhookData {
  shop_domain?: string;
  [key: string]: any;
}

// Error classes
export declare class AuthenticationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode?: number);
}

export declare class ValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode?: number);
}

export declare class ConfigurationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode?: number);
}

// Utility functions
export declare function getCorsHeaders(): Record<string, string>;
export declare function extractApiKey(request: Request): string | null;
export declare function parseJsonBody(request: Request): Promise<any>;
export declare function createJsonResponse(
  data: any,
  status: number,
  headers?: Record<string, string>,
): Response;
export declare function buildShopifyAuthUrl(
  shop: string,
  clientId: string,
  scope: string,
  redirectUri: string,
  state: string,
): string;

// Validation functions
export declare function validateEnvironment(env: Environment): void;
export declare function isValidShopDomain(shop: string): boolean;
export declare function isValidEmbeddedContext(
  embedded: string,
  host: string,
  hmac: string,
): boolean;
export declare function isValidHost(host: string, shop: string): boolean;
export declare function checkInstallation(shop: string, env: Environment): Promise<boolean>;

// HMAC functions
export declare function timingSafeEqual(a: string, b: string): boolean;
export declare function verifyShopifyHmac(
  params: URLSearchParams,
  secret: string,
): Promise<boolean>;
export declare function verifyWebhookHmac(
  body: string,
  hmac: string,
  secret: string,
): Promise<boolean>;

// Shopify API functions
export declare function exchangeCodeForToken(
  shop: string,
  code: string,
  env: Environment,
): Promise<TokenResponse>;
export declare function storeShopData(
  shop: string,
  tokenData: TokenResponse,
  env: Environment,
): Promise<void>;
export declare function registerMandatoryWebhooks(
  shop: string,
  accessToken: string,
  env: Environment,
): Promise<void>;
export declare function proxyToShopify(
  shop: string,
  endpoint: string,
  method: string,
  data: any,
  accessToken: string,
  env: Environment,
): Promise<ShopifyApiResponse>;

// Handler functions
export declare function routeRequest(
  request: Request,
  url: URL,
  env: Environment,
  corsHeaders: Record<string, string>,
): Promise<Response>;
export declare function handleOAuth(request: Request, env: Environment): Promise<Response>;
export declare function handleOAuthCallback(request: Request, env: Environment): Promise<Response>;
export declare function handleExtensionAuth(
  request: Request,
  env: Environment,
  corsHeaders: Record<string, string>,
): Promise<Response>;
export declare function handleAPIProxy(
  request: Request,
  env: Environment,
  corsHeaders: Record<string, string>,
): Promise<Response>;
export declare function handleWebhook(
  request: Request,
  env: Environment,
  topic: string,
): Promise<Response>;

// Template functions
export declare function createInstallRedirect(shop: string, env: Environment): Response;
export declare function createAccessDeniedPage(shop: string): Response;
export declare function createEmbeddedApp(shop: string, host: string, env: Environment): Response;
export declare function createLandingPage(): Response;

// Error handler
export declare function handleError(error: Error): Response;
