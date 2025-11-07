export interface XrohrConfig {
  server: ServerConfig;
  router: RouteConfig;
  sparkLite: SparkLiteConfig;
  axios: AxiosConfig;
  memoria: MemoriaConfig;
}

export interface ServerConfig {
  port: number;
  useDefaultCors: boolean;
  allowedOrigins?: string[];
  allowedMethods?: string[];
  useJsonParser: boolean;
  useUrlEncoded: boolean;
}

export interface RouteConfig {
  apiPrefix: string;
  useDefaultRouterRegistration: boolean;
}

export interface SparkLiteConfig {
  enabled: boolean;
}

export interface AxiosConfig {
  enabled: boolean;
  defaultTimeout?: number;
  baseURL: string;
  subURL?: string;
}

export interface MemoriaConfig {
  enabled: boolean;
}