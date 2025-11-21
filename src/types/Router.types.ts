import { Request, Response } from "express";

export interface RouterTemplate {
  basePath: string;
  type: "TemplateRecipe"|"ConstructRecipe" ;
  routes: TemplateRecipe[]|ConstructRecipe[];
}

export interface TemplateRecipe {
  name: string;
  path: string;
  method: "get" | "post" | "delete" | "put";
  middlewares: string[];
  handlers: (req: Request, res: Response) => Promise<void>;
}

export interface ConstructRecipe {
  name: string;
  path: string;
  method: "get" | "post" | "delete" | "put";
  middlewares: string[];
  construct: ConstructSingle | ConstructMultiple;
}

export interface ConstructSingle {
  resource: string;
  action: "get" | "remove" | "update" | "create" | "getAll";
  mode: "single";
  dataInParams: boolean;
}

export interface ConstructMultiple {
  resource: string;
  action: "get" | "remove" | "update" | "create" | "getAll";
  mode: "multiple";
  dataInParams: false;
}

