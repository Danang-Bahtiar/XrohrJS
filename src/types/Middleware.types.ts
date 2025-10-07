import { NextFunction, Request, Response } from "express";

export interface MiddlewareTemplate {
  name: string;
  description?: string;
  handlers: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
