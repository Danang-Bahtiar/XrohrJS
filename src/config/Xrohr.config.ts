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
 * @description {trustedSource} the trustedSource list is used to specify which sources are allowed to trigger certain events, enhancing security by preventing unauthorized access. place this in environment variables and only share with trusted parties to ensure that only authorized sources can trigger sensitive events within the system.
 * @description {apiRegisterEvent} is a boolean flag that determines whether an event should be emitted when a new API route is registered, allowing for dynamic handling of new routes. Can be used to trigger actions like logging, analytics, or even dynamic documentation updates whenever a new API route is added to the system. Accessed using sparklite event bus with name "API_REGISTER" and payload {RouterTemplate (the Configuration of the new Route), source (must match with one of the listed trusteSource)}
 */
export interface XrohrConfig {
  server: ServerConfig;
  middleware: MiddlewareConfig;
  restApi: ActuaConfig;
  sparkLite: SparkLiteConfig;
  axios: AxiosConfig;
  memoria: MemoriaConfig;
  defaults: {
    // 🌐 Distributed Systems Configuration
    topology: {
      isEdgeNode: boolean; // true = Edge, false = Main Server
      syncSecret: string; // The shared password for the handshake
    };
    edgeNode?: {
      apiRegisterEvent?: boolean;
      allowAutoHydrate?: boolean;
    };
    mainNode?: {
      autoHydrateAPI?: boolean;
    };
  };
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
  useDefaultCors: boolean;
  allowedOrigins?: string[];
  allowedMethods?: string[];
  useJsonParser: boolean;
  useUrlEncoded: boolean;
}

/**
 * Middleware Configurations
 * isEnabled: Whether middleware auto loading from default path is enabled. require to use MiddlewareTemplate structure.
 */
export interface MiddlewareConfig {
  isEnabled: boolean;
}

/**
 * Rest API / Actua Configurations
 *
 * @property useSimplex: Whether to use Simplex architecture for the REST API. Simplex mean that all route will be registered under one global address.
 * @property apiPrefix: The global prefix for all REST API routes. Routes will be registered as follow <ipaddress>/{apiPrefix}/{configuration}
 */
export interface ActuaConfig {
  useSimplex: boolean;
  apiPrefix: string;
}

/**
 * SparkLite/Event Bus Configurations
 * @property isEnabled: Whether SparkLite module is enabled.
 */
export interface SparkLiteConfig {
  isEnabled: boolean;
}

/**
 * Axios Configurations
 * @property isEnabled: Whether Axios module is enabled.
 * @property defaultTimeout: Default timeout for Axios requests in milliseconds.
 * @property baseURL: The base URL for Axios requests.
 * @property subURL: An optional sub-URL to append to the base URL for Axios requests.
 */
export interface AxiosConfig {
  isEnabled: boolean;
  defaultTimeout?: number;
  baseURL: string;
  subURL?: string;
}

/**
 * Memoria Configurations
 * @property isEnabled: Whether Memoria module is enabled.
 * This module was provided as a quick in-memory cache solution.
 * If the app work as main server, it advised not to enable this module and use proper Database.
 */
export interface MemoriaConfig {
  isEnabled: boolean;
}
