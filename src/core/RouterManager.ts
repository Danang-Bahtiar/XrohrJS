import { RouterTemplate } from "../types/Router.types.js";
import path from "path";
import { glob } from "glob";
import MiddlewareManager from "./MiddlewareManager.js";
import Server from "./Server.js";

class RouterManager {
  private routeCollection: Map<string, any>;
  private middlewareManager: MiddlewareManager;
  private prefix!: string;

  constructor() {
    this.middlewareManager = new MiddlewareManager();
    this.routeCollection = new Map<string, any>();
  }

  public init = async (expressApp: Server, prefix: string) => {
    this.prefix = prefix;
    // Load all available middleware functions into the manager
    await this.middlewareManager.init();

    const routePath = path.resolve(process.cwd(), "./src/routes");
    const routeDir = path.join(routePath, "/**/*.{ts,js}").replace(/\\/g, "/");
    const files = await glob(routeDir);
    

    for (const file of files) {
      const fileName = path.basename(file); // e.g. "users.js"
      const filePath = `file://${file.replace(/\\/g, "/")}`;
      const routeModule = await import(`${filePath}?update=${Date.now()}`);
      const routeConfig: RouterTemplate = routeModule.default;

      if (!routeConfig.basePath || !routeConfig.routes) {
        console.warn(`[WARN] Skipping invalid Route file: ${fileName}`);
        continue;
      }

      console.log(`[ROUTE] Loading routes from: ${fileName}`);

      // Register all routes defined in this config file
      if (routeConfig.type === "TemplateRecipe") {
        this.templateLoader(routeConfig, expressApp);
      } else if (routeConfig.type === "ConstructRecipe") {
        // ????
        console.warn(`[WARN] ConstructRecipe is mean for telling another server to generate routes. Skipping route file: ${fileName}`);
      }
    }
  };

  public templateLoader = (routeConfig: RouterTemplate, expressApp: Server) => {
    const { basePath, routes } = routeConfig;

    for (const route of routes) {
      // 1. Get the actual middleware functions from the manager
      const middlewareChain = this.middlewareManager.getMiddlewares(
        route.middlewares
      );

      const routeKey = `${route.method.toUpperCase()}-${route.name}`;

      // Check for unregistered middleware
      if (middlewareChain.length !== route.middlewares.length) {
        console.warn(
          `[WARN] Some middlewares for route ${basePath}${route.path} were not found. Skipping.`
        );
      }

      // 2. Construct the full path
      const fullPath = `${this.prefix}${basePath}${route.path}`;

      // 3. Register the route with the chain of functions
      // The spread operator (...) unpacks the array of middleware
      // Get the method from your route definition
      const method = route.method.toLowerCase();
      const handlerChain = [...middlewareChain, route.handlers];
      // Use a switch statement to safely call the correct, type-checked Express function
      switch (method) {
        case "get":
          expressApp.get(fullPath, handlerChain);
          break;
        case "post":
          expressApp.post(fullPath, handlerChain);
          break;
        case "put":
          expressApp.put(fullPath, handlerChain);
          break;
        case "delete":
          expressApp.delete(fullPath, handlerChain);
          break;
        default:
          // This handles any unsupported method names from your config files
          console.warn(
            `[WARN] HTTP method '${route.method}' is not supported. Skipping route ${fullPath}.`
          );
          continue;
      }

      // Cache the route for your own reference if needed
      this.routeCollection.set(routeKey, route);
      console.log(
        `  ✔️  Registered: ${route.method.toUpperCase()} ${fullPath}`
      );
    }
  };
}

export default RouterManager;
