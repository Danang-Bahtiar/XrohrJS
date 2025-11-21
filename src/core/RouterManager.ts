import {
  ConstructRecipe,
  RouterTemplate,
  TemplateRecipe,
} from "../types/Router.types.js";
import path from "path";
import { glob } from "glob";
import MiddlewareManager from "./MiddlewareManager.js";
import Server from "./Server.js";
import Memoria from "./Memoria.js";
import { Request, Response } from "express";

class RouterManager {
  private routeCollection: Map<string, any>;
  private constructCollection: Map<string, any>;
  private prefix!: string;

  constructor() {
    this.routeCollection = new Map<string, any>();
    this.constructCollection = new Map<string, any>();
  }

  public init = async (
    expressApp: Server,
    prefix: string,
    middlewareManager: MiddlewareManager
  ) => {
    this.prefix = prefix;

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
        this.templateLoader(routeConfig, expressApp, middlewareManager);
      } else if (routeConfig.type === "ConstructRecipe") {
        this.constructCollection.set(fileName, routeConfig);
        console.warn(
          `[WARN] ConstructRecipe is mean for telling another server to generate routes. Skipping route file: ${fileName}`
        );
        continue;
      }
    }
  };

  public templateLoader = (
    routeConfig: RouterTemplate,
    expressApp: Server,
    middlewareManager: MiddlewareManager
  ) => {
    const { basePath } = routeConfig;
    const routes = routeConfig.routes as TemplateRecipe[];

    for (const route of routes) {
      // 1. Get the actual middleware functions from the manager
      const middlewareChain = middlewareManager.getExpressMiddlewares(
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

  /**
   * This constructLoader is for Memoria based routes only.
   * @param routeConfig
   * @param memoriaApp
   * @param middlewareManager
   * @param expressApp
   */
  public constructLoader = (
    routeConfig: RouterTemplate,
    memoriaApp: Map<string, Memoria>,
    middlewareManager: MiddlewareManager,
    expressApp: Server
  ) => {
    const { basePath } = routeConfig;
    const routes = routeConfig.routes as ConstructRecipe[];

    const actionMap: Record<string, keyof Memoria> = {
      get: "getRecord",
      create: "setRecord",
      update: "setRecord",
      remove: "removeRecord",
      getAll: "getAll",
    };

    for (const route of routes) {
      const handler = async (req: Request, res: Response) => {
        try {
          // 1. Resource Check
          const memoria = memoriaApp.get(route.construct.resource);
          if (!memoria)
            throw new Error(`Resource ${route.construct.resource} not found`);

          const method = actionMap[route.construct.action];
          if (!method)
            throw new Error(`Invalid action: ${route.construct.action}`);

          // 2. Determine Raw Input Source
          let rawInput;
          if (route.construct.mode === "multiple") {
            rawInput = req.body; // Multiple ALWAYS comes from body
          } else {
            // Single mode checks configuration
            if (route.construct.dataInParams) {
              // Take the first URL param found (e.g. /users/:id -> "123")
              const paramValues = Object.values(req.params);
              rawInput = paramValues.length > 0 ? paramValues[0] : undefined;
            } else {
              rawInput = req.body;
            }
          }

          // 3. Helper: Prepare Data for Memoria
          // This ensures 'get/remove' receives a String, and 'set' receives an Object.
          const processItem = (item: any) => {
            // If we need to GET or REMOVE, we strictly need the ID string.
            if (
              route.construct.action === "get" ||
              route.construct.action === "remove"
            ) {
              if (typeof item === "object") {
                // If user sent {id: "123"} in body, extract the value.
                return item.id || item.key || Object.values(item)[0];
              }
              return String(item);
            }
            // If we are SETTING, we pass the whole object.
            return item;
          };

          let result;

          // 4. Execute Logic
          if (route.construct.action === "getAll") {
            // Special handling: Map cannot be serialized to JSON directly.
            // Convert Map values to an Array.
            const mapResult = memoria.getAll();
            result = Array.from(mapResult.values());
          } else if (route.construct.mode === "multiple") {
            if (!Array.isArray(rawInput)) {
              return res
                .status(400)
                .json({ error: "Mode 'multiple' requires an array input." });
            }
            // Map over the array and process each item
            result = rawInput.map((item) => {
              const processed = processItem(item);
              // Execute Memoria function
              // @ts-ignore - Dynamic access
              const res = memoria[method](processed);
              // Return the processed item (or result) so the API response shows what happened
              return res !== undefined ? res : processed;
            });
          } else {
            // Single Mode
            const processed = processItem(rawInput);
            // @ts-ignore
            const opResult = memoria[method](processed);
            // If opResult is undefined (like in set/remove), return the ID/Data instead for clarity
            result = opResult !== undefined ? opResult : processed;
          }

          return res.json({ status: "Success", data: result });
        } catch (error: any) {
          return res
            .status(500)
            .json({ status: "Error", message: error.message });
        }
      };

      // 5. Register Route
      const middlewareChain = middlewareManager.getExpressMiddlewares(
        route.middlewares
      );
      const fullPath = `${this.prefix}${basePath}${route.path}`;

      // FIX: Use spread operator (...) to pass the array of middlewares
      // @ts-ignore
      expressApp[route.method](fullPath, ...middlewareChain, handler);

      console.log(
        `  ✔️  Constructed: ${route.method.toUpperCase()} ${fullPath}`
      );
    }
  };

  public getConstructCollection = () => {
    return [...this.constructCollection].map(([fileName, config]) => ({
      fileName,
      config,
    }));
  };
}

export default RouterManager;
