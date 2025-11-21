import { glob } from "glob";
import path from "path";
import { MiddlewareTemplate } from "../types/Middleware.types.js";

class MiddlewareManager {
  private middlewareCollection: Map<string, any>;
  private independentMiddleware: Map<string, any>;

  constructor() {
    this.middlewareCollection = new Map<string, any>();
    this.independentMiddleware = new Map<string, any>();
  }

  public init = async () => {
    const middlewarePath = path.resolve(process.cwd(), "./src/middlewares");
    const middlewareDir = path
      .join(middlewarePath, "/**/*.{ts,js}")
      .replace(/\\/g, "/");

    const files = await glob(middlewareDir);

    for (const file of files) {
      const filePath = `file://${file.replace(/\\/g, "/")}`;
      const middlewareModule = await import(`${filePath}?update=${Date.now()}`);

      const middlewareConfig: MiddlewareTemplate = middlewareModule.default;
      if (
        !middlewareConfig.name ||
        typeof middlewareConfig.handler !== "function"
      ) {
        console.warn(`[WARN] Skipping invalid Middleware file: ${file}`);
        continue;
      }

      console.log(`[Middleware] Loading middleware: ${middlewareConfig.name}`);

      if (middlewareConfig.type === "express") {
        this.middlewareCollection.set(middlewareConfig.name, middlewareConfig);
      } else {
        this.independentMiddleware.set(middlewareConfig.name, middlewareConfig);
      }
    }
  };

  public getExpressMiddlewares = (middlewaresName: string[]) => {
    const middlewares = [];

    for (const mw of middlewaresName) {
      const module = this.middlewareCollection.get(mw);

      if (module) {
        middlewares.push(module.handler);
      }
    }

    return middlewares;
  };

  public getIndependentMiddleware = (middlewareName: string) => {
    if (this.independentMiddleware.get(middlewareName)) {
      return this.independentMiddleware.get(middlewareName);
    }
  };
}

export default MiddlewareManager;
