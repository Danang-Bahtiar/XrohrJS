export type moduleName = "MIDDLEWARE" | "SPARKLITE" | "AXIOS" | "MEMORIA";
export type serviceName = "AUTH" | "JWT"

/**
 * XrohrJS - A modular and extensible Node.js framework for building scalable applications.
 * Copyright (c) 2024 Dan Koyuki. All rights reserved.
 * server: Server configurations
 * middleware: Middleware configurations
 * restApi: REST API configurations
 * sparkLite: SparkLite/Event Bus configurations
 * axios: Axios/HTTP Client configurations
 * memoria: Memoria/In-memory storage configurations
 * defaults: Default settings for various modules, such as API registration events and trusted sources. Need Simplex to be On to work.
 */
export interface XrohrConfig {
  server: ServerConfig;
  enabledModules: moduleName[];
  enabledServices: serviceName[];
  modulesConfig?: {};
  servicesConfig?: {
    jwtService?: JWTServiceConfig;
  };
  topology: {
      isEdgeNode: boolean; // true = Edge, false = Main Server
    };
  defaults: {
    edgeNode?: EdgeNodeConfig;
    mainNode?: MainNodeConfig;
  };
}

export interface EdgeNodeConfig {
  allowHydrateAPI?: boolean;
  allowHydrateMemories?: boolean;
  /** List of main node URLs/IPs for fallback or reporting */
  mainUrls?: string[]; 
}

export interface MainNodeConfig {
  autoHydrateAPI?: boolean;
  autoHydrateMemories?: boolean;
  /** List of edge node URLs/IPs for distribution */
  edgeUrls: string[]; 
}

export interface AuthServiceConfig {
  denormalizeHandler: (data: any[]) => any | Promise<any>;
  databaseHandler: (query: any) => any[] | Promise<any[]>;
}

export interface JWTServiceConfig {
  secretKey: string;
  useRSA: boolean;
  expiresIn: string
}

/**
 * Server Configurations
 * useDefaultCors: Whether to use default CORS settings. If false, it will create a CORS configuration based on allowedOrigins and allowedMethods.
 * allowedOrigins: List of allowed origins for CORS.
 * allowedMethods: List of allowed HTTP methods for CORS.
 * useJsonParser: Whether to use JSON parser middleware.
 * useUrlEncoded: Whether to use URL-encoded parser middleware.
 */
export interface ServerConfig {
  port: number;
  apiPrefix: string;
  useDefaultCors: boolean;
  allowedOrigins?: string[];
  allowedMethods?: string[];
  useJsonParser: boolean;
  useUrlEncoded: boolean;
}

