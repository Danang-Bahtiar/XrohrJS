import { Request, Response } from "express";

/**
 * Union type representing all supported router templates.
 * 
 * A router template describes how routes should be registered
 * and how incoming requests should be processed.
 */
export type RouterDefinition =
  | ExpressRouterDefinition
  | SimplexExpressRouterDefinition
  | ConstructRouteDefinition
  | SimplexConstructRouteDefinition;

// =========================================
// Standard Express Route Definition
// =========================================
/**
 * Defines an Express-based router with a physical base path.
 * 
 * This template registers traditional REST endpoints that
 * map directly to Express routes.
 * @field basePath {String} - 
 * @field type {"express"}
 * @field routes - 
 */
export interface ExpressRouterDefinition {
  basePath: string;
  type: "express";
  routes: ExpressRoute[];
}

/**
 * 
 */
export interface ExpressRoute {
  id: string;
  path: string;
  method: "get" | "post" | "delete" | "put";
  middlewares: string[];
  handler: (req: Request, res: Response) => Promise<any>;
}

// =========================================
// Simplex Express Route Definition
// =========================================
/**
 * 
 */
export interface SimplexExpressRouterDefinition {
  type: "express";
  routes: SimplexExpressRoute[];
}

/**
 * 
 */
export interface SimplexExpressRoute {
  id: string;
  method: "get" | "post" | "delete" | "put";
  middlewares: string[];
  handler: (req: Request, res: Response) => Promise<any>;
}

// =========================================
// Standard Construct Route Definition
// =========================================
/**
 * 
 */
export interface ConstructRouteDefinition {
  type: "construct";
  id: string;
  path: string;
  method: "get" | "post" | "delete" | "put";
  version: number;
  source: RouteSource;
  handler?: (req: Request, res: Response) => any;
}

// =========================================
// Simplex Construct Route Definition
// =========================================
/**
 * 
 */
export interface SimplexConstructRouteDefinition {
  type: "construct";
  id: string;
  version: number;
  source: RouteSource;
  handler?: (req: Request, res: Response) => any;
}

// =========================================
// Simplex Construct Route Definition
// =========================================
/**
 * 
 */
export type RouteSource = MemoriaSource|ForwardSource;

/**
 * 
 */
export interface MemoriaSource {
  sourceType: "memoria";
  resource: string;
  action: "get" | "getAll" | "create" | "update" | "remove";
}

/**
 * 
 */
export interface ForwardSource {
  sourceType: "forward";
  resource: string;
  targetId: string;
  targetMethod: "get" | "post" | "delete" | "put";
  config?: {
    forwardHeaders?: boolean;
    includeIp?: boolean;
  };
}