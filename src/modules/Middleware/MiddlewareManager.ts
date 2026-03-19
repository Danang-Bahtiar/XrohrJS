import { glob } from "glob";
import path from "path";
import { MiddlewareTemplate } from "./Middleware.types.js";

class MiddlewareManager {
  private expressMiddlewares: Map<string, any>;
  private independentMiddlewares: Map<string, any>;

  constructor() {
    this.expressMiddlewares = new Map<string, any>();
    this.independentMiddlewares = new Map<string, any>();
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

      console.log(`[MIDDLEWARE] Loading middleware: ${middlewareConfig.name}`);

      if (middlewareConfig.type === "express") {
        this.expressMiddlewares.set(middlewareConfig.name, middlewareConfig);
      } else {
        this.independentMiddlewares.set(
          middlewareConfig.name,
          middlewareConfig
        );
      }
    }
  };

  public getExpressMiddlewares = (middlewaresName: string[]) => {
    const middlewares = [];

    for (const mw of middlewaresName) {
      const module = this.expressMiddlewares.get(mw);

      if (module) {
        middlewares.push(module.handler);
      }
    }

    return middlewares;
  };

  public getIndependentMiddleware = (middlewareName: string) => {
    if (this.independentMiddlewares.get(middlewareName)) {
      return this.independentMiddlewares.get(middlewareName);
    }
  };
}

export default MiddlewareManager;
