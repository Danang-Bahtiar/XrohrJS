export interface XrohrConfig {
  server: ServerConfig;
  router: RouteConfig;
}

export interface ServerConfig {
  port: number;
  apiPrefix: string;
  useDefaultCors: boolean;
  allowedOrigins?: string[];
  allowedMethods?: string[];
  useJsonParser: boolean;
  useUrlEncoded: boolean;
}

export interface RouteConfig {
  useDefaultRouterRegistration: boolean;
}
