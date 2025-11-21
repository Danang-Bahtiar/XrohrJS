import { NextFunction, Request, Response } from "express";

// --- 1. Define the Handler Types ---

/**
 * Standard Express.js middleware handler signature.
 */
export type ExpressHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

/**
 * A generic, independent handler for data processing or formatting.
 * It takes some input and returns some output (or a promise of it).
 * You can make this more specific (e.g., (input: string) => number) if you want.
 */
export type IndependentHandler = (payload: any) => Promise<any> | any;

// --- 2. Define the Template Structures ---

/**
 * Base template with common properties.
 */
interface BaseMiddleware {
  name: string;
}

/**
 * Template for middleware used in an Express API route.
 */
export interface ExpressMiddlewareTemplate extends BaseMiddleware {
  type: "express";
  handler: ExpressHandler;
}

/**
 * Template for a standalone processing/formatting function.
 */
export interface IndependentMiddlewareTemplate extends BaseMiddleware {
  type: "Independent";
  handler: IndependentHandler;
}

// --- 3. Create the Final Union Type ---

/**
 * A middleware template that can be *either* for Express *or* independent.
 * TypeScript will enforce that the 'handler' type matches the 'type' string.
 */
export type MiddlewareTemplate =
  | ExpressMiddlewareTemplate
  | IndependentMiddlewareTemplate;
