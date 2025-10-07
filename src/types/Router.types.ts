import { Request, Response } from "express";

export interface RouterTemplate {
  basePath: string;
  routes: DynamicRoute[]|StrictRoute[];
}

export interface DynamicRoute {
  type: "dynamic";
  name: string;
  path: string;
  method: "get" | "post" | "delete" | "put";
  middlewares: string[];
  handlers: (req: Request, res: Response) => Promise<void>;
}

export interface StrictRoute {
  type: "strict";
  name: string;
  path: string;
  method: "get" | "post" | "delete" | "put";
  middlewares: string[];
  handlers: {
    action: "fetch" | "deliver" | "write";
    params?: string;
    schema?: object;
  }
}
