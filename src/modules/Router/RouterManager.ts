import path from "path";
import Server from "../../core/Server.js";
import Memoria from "../Memoria/Memoria.js";
import ConstructFactory from "./ConstructFactory.js";
import ExpressFactory from "./ExpressFactory.js";
import RouterUtils from "./Utils.js";
import MiddlewareManager from "../Middleware/MiddlewareManager.js";
import Rheos from "../Rheos/Rheos.js";
import {
  ConstructRouteDefinition,
  ExpressRoute,
  ExpressRouterDefinition,
  MemoriaSource,
  RouterDefinition,
} from "./Router.types.js";

class RouterManager {
  private prefix: string;
  private useSimplex: boolean = false;

  private constructIndex: Map<string, ConstructRouteDefinition>;

  private constructFactory: ConstructFactory;

  constructor(apiPrefix: string) {
    this.useSimplex = false;
    this.prefix = apiPrefix;

    this.constructIndex = new Map<string, ConstructRouteDefinition>();

    this.constructFactory = new ConstructFactory();
  }

  /**
   * Initializes the RouteManager by dynamically loading route configuration files
   * from the 'src/routes' directory and registering them with the main Express application.
   * It handles only custom 'ExpressRecipe' routes on server start.
   *
   * @param expressApp The main Express server instance to attach routes to.
   * @param middlewareManager The manager responsible for resolving middleware references.
   * @returns {Promise<void>} A promise that resolves when all routes have been processed.
   */
  public init = async (
    expressApp: Server,
    middlewareManager: MiddlewareManager,
  ): Promise<void> => {
    if (!this.useSimplex) {
      console.log(
        `[ROUTER MANAGER] Initializing RouterManager in Standard mode with prefix '${this.prefix}'`,
      );
      console.log(
        `[ROUTER MANAGER] In Standard mode, all routes will be registered under their own defined basepath/path after the prefix.`,
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
          ExpressFactory.load(
            this.prefix,
            routeConfig as ExpressRouterDefinition,
            expressApp,
            middlewareManager,
          );
        } else if (routeConfig.type === "construct") {
          // Just put it on the shelf. Do not load it into Express!
          this.constructIndex.set(
            routeConfig.id,
            routeConfig as ConstructRouteDefinition,
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
    routeConfig: ConstructRouteDefinition,
    expressApp: Server,
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
    // if (routeConfig.type === "express") {
    //   console.warn(
    //     `[WARN] Rejected dynamic ExpressRecipe from ${sourceName}. Main Server logic must be updated via local files, not network payloads.`,
    //   );
    //   return;
    // }

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
        routeConfig.handler = this.constructFactory.createHttpHandler(
          routeConfig.source,
          rheosApp,
        );
      } else if (routeConfig.source.sourceType === "memoria") {
        routeConfig.handler = this.constructFactory.createMemoriaHandler(
          routeConfig.source as MemoriaSource,
          memoriaApp,
          true,
        );
      }

      const fullPath = `${this.prefix}${routeConfig.path}`;
      const handlerChain = [routeConfig.handler];
      RouterUtils.apiExpressRegister(
        fullPath,
        routeConfig.method,
        expressApp,
        handlerChain,
      );
      console.log(
        `  ✔️  Constructed: ${routeConfig.method.toUpperCase()} ${fullPath} (v${routeConfig.version})`,
      );
    } else {
      console.warn(
        `[WARN] Unknown route type '${(routeConfig as any).type}' in: ${sourceName}`,
      );
    }
  };

  public getConstructIndex = () => {
    return this.constructIndex;
  };
}

export default RouterManager;
