import Memoria from "../Memoria/Memoria.js";
import MiddlewareManager from "../Middleware/MiddlewareManager.js";
import Rheos from "../Rheos/Rheos.js";
import ConstructFactory from "./ConstructFactory.js";
import {
  ForwardSource,
  MemoriaSource,
  RouterDefinition,
  SimplexConstructRouteDefinition,
  SimplexExpressRoute,
} from "./Router.types.js";
import RouterUtils from "./Utils.js";
import path from "path";

class SimplexRouterManager {
  private prefix: string;
  private useSimplex: boolean = true;

  private routerIndex: Map<string, SimplexExpressRoute>;
  private constructIndex: Map<string, SimplexConstructRouteDefinition>;

  private constructFactory: ConstructFactory;

  constructor(apiPrefix: string) {
    this.useSimplex = true;
    this.prefix = apiPrefix;

    this.routerIndex = new Map<string, SimplexExpressRoute>();
    this.constructIndex = new Map<string, SimplexConstructRouteDefinition>();

    this.constructFactory = new ConstructFactory();
  }

  public init = async (): Promise<void> => {
    if (this.useSimplex) {
      console.log(
        `[ROUTER MANAGER] Initializing RouterManager in Simplex mode with prefix '${this.prefix}'`,
      );
      console.log(
        `[ROUTER MANAGER] In Simplex mode, all routes will be registered under the global prefix '${this.prefix}' regardless of their defined paths.`,
      );
    }

    const files = await RouterUtils.fileDiscovery();

    for (const file of files) {
      const fileName = path.basename(file);
      const filePath = `file://${file.replace(/\\/g, "/")}`;

      try {
        // Dynamically import the route module using a cache-busting timestamp
        const routeModule = await import(`${filePath}?update=${Date.now()}`);
        const routeConfig: RouterDefinition = routeModule.default;

        console.log(`[ROUTER MANAGER] Loading routes from: ${fileName}`);

        // Only pass/register ExpressRecipe type in the init phase regardless egde or main server.

        if (routeConfig.type === "express") {
          for (const route of routeConfig.routes as SimplexExpressRoute[]) {
            this.routerIndex.set(route.id, route);
            console.log(
              `  ✔️  Registered route: ${route.id} (from ${fileName})`,
            );
          }
        } else if (routeConfig.type === "construct") {
          // Just put it on the shelf. Do not load it into Express!
          this.constructIndex.set(
            routeConfig.id,
            routeConfig as SimplexConstructRouteDefinition,
          );
          console.log(
            `  📦  Stored Construct blueprint: ${routeConfig.id} (from ${fileName})`,
          );
        }
      } catch (error) {
        console.error(`[ERROR] Failed to load route file ${fileName}:`, error);
      }
    }
  };

  public registerRoute = (
    routeConfig: RouterDefinition,
    memoriaApp: Memoria,
    rheosApp: Rheos,
    sourceName: string = "Dynamic Payload",
  ): void => {
    if (!routeConfig.type) {
      console.warn(`[WARN] Skipping invalid Route config from: ${sourceName}`);
      return;
    }

    // ============== DYNAMIC REGISTRATION ==============

    // 1. REJECT EXPRESS RECIPES
    if (routeConfig.type === "express") {
      console.warn(
        `[WARN] Rejected dynamic ExpressRecipe from ${sourceName}. Main Server logic must be updated via local files, not network payloads.`,
      );
      return;
    }

    // 2. PROCESS CONSTRUCT RECIPES
    if (routeConfig.type === "construct") {
      const existingRoute = this.constructIndex.get(routeConfig.id);

      if (existingRoute && existingRoute.version >= routeConfig.version) {
        console.log(
          `  [SKIP] Route '${routeConfig.id}' is already at v${existingRoute.version}. Ignored incoming v${routeConfig.version}.`,
        );
        return; // Stop execution! We already have this version or newer.
      }

      if (routeConfig.source.sourceType === "forward") {
        routeConfig.handler = this.constructFactory.createSimplexForwarHandler(
          routeConfig.source as ForwardSource,
          rheosApp,
        );

        const routeEntry: SimplexExpressRoute = {
          id: routeConfig.id,
          method: routeConfig.source.targetMethod,
          middlewares: [], // Edge nodes usually skip middleware
          handler: routeConfig.handler,
        };

        this.routerIndex.set(routeConfig.id, routeEntry);
      } else if (routeConfig.source.sourceType === "memoria") {
        routeConfig.handler = this.constructFactory.createMemoriaHandler(
          routeConfig.source as MemoriaSource,
          memoriaApp,
          true,
        );
        const routeEntry: SimplexExpressRoute = {
          id: routeConfig.id,
          method: "post",
          middlewares: [], // Edge nodes usually skip middleware
          handler: routeConfig.handler,
        };
        this.routerIndex.set(routeConfig.id, routeEntry);
      }

      this.constructIndex.set(routeConfig.id, routeConfig);

      console.log(`  ✔️  [Edge] Hot-loaded proxy route: ${routeConfig.id}`);
    } else {
      console.warn(
        `[WARN] Unknown route type '${(routeConfig as any).type}' in: ${sourceName}`,
      );
    }
  };

  public defaultRegister = (config: RouterDefinition) => {
    if (config.type === "express") {
      for (const route of config.routes as SimplexExpressRoute[]) {
        this.routerIndex.set(route.id, route);
      }
    }
  };

  /**
   * Calls a registered Simplex API route by its ID, passing the original request and a mock response object to capture the output. This allows for dynamic invocation of routes registered in Simplex mode without needing to know their specific paths.
   * Currently only for RouterTempletes with type of ExpressRecipe and useSimplex enabled, will be registered in the routerIndex and can be called through this method.
   * @param routeId The unique identifier of the route to call, as defined in the route configuration.
   * @param req The original Express request object to pass to the route handler, allowing access to request data, parameters, etc.
   * @param method The HTTP method (e.g., "GET", "POST") to ensure the correct route handler is invoked based on the method defined in the route configuration.
   * @returns A promise that resolves with the result of the route handler, captured from the mock response's json method.
   */
  public callSimplexAPI = async (
    routeId: string,
    reqData: any,
    method: string,
    middlewareManager: MiddlewareManager,
    reqHeader: any,
    reqIp: any,
  ): Promise<any> => {
    if (!this.useSimplex) throw new Error("Simplex mode is not enabled.");

    const route = this.routerIndex.get(routeId);

    if (!route) throw new Error(`Route with ID '${routeId}' not found.`);
    if (route.method.toLowerCase() !== method.toLowerCase()) {
      throw new Error(`HTTP method mismatch for route '${routeId}'.`);
    }

    const middlewareChain = middlewareManager.getExpressMiddlewares(
      route.middlewares,
    );

    return new Promise(async (resolve, reject) => {
      let isResponded = false;

      // 1. Create the Ghost Request
      // We map your raw reqData into req.body so standard Express middlewares can find it
      const mockReq = RouterUtils.createMockRequest(
        reqData,
        method,
        reqHeader,
        reqIp,
      );

      // 2. Create the Ghost Response
      // If a handler calls res.json() or res.send(), it resolves the promise!
      const mockRes = RouterUtils.createMockResponse(isResponded, resolve);

      // 3. The Middleware Chain Runner
      let index = 0;

      const next = async (err?: any) => {
        // If a middleware calls next(err), stop and throw the error
        if (err) return reject(err);

        // If there are still middlewares left to run
        if (index < middlewareChain.length) {
          const mw = middlewareChain[index++];
          try {
            await mw(mockReq, mockRes, next);
          } catch (e) {
            reject(e); // Catch synchronous errors in middleware
          }
        } else {
          // 4. All middlewares passed! Execute the final route handler
          try {
            const result = await route.handler(mockReq, mockRes);

            // If the handler returned data directly instead of using res.json()
            if (result !== undefined && !isResponded) {
              isResponded = true;
              resolve(result);
            }
          } catch (e) {
            reject(e);
          }
        }
      };
      next();
    });
  };

  public getConstructIndex = () => {
    return this.constructIndex;
  };
}

export default SimplexRouterManager;
