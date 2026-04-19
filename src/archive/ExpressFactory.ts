import Server from "../core/Server.js";
import MiddlewareManager from "../modules/Middleware/MiddlewareManager.js";
import RouterUtils from "../modules/Router/Utils.js";

class ExpressFactory {
  static load = (
    prefix: string,
    routeConfig: ExpressRouterDefinition,
    expressApp: Server,
    middlewareManager: MiddlewareManager,
  ) => {
    // Implementation for loading Express routes
    const { basePath } = routeConfig;
    const routes = routeConfig.routes as ExpressRoute[];

    for (const route of routes) {
      // 2. Construct the full path
      const fullPath = `/${prefix}/${basePath}/${route.path}`;

      // 1. Get the actual middleware functions from the manager
      const middlewareChain = middlewareManager.getExpressMiddlewares(
        route.middlewares,
      );

      // Check for unregistered middleware
      if (middlewareChain.length !== route.middlewares.length) {
        console.warn(
          `[WARN] Some middlewares for route ${basePath}${route.path} were not found. Skipping.`,
        );
      }

      // 3. Register the route with the chain of functions
      // The spread operator (...) unpacks the array of middleware
      // Get the method from your route definition
      const method = route.method.toLowerCase();
      const handlerChain = [...middlewareChain, route.handler];
      // Use a switch statement to safely call the correct, type-checked Express function
      RouterUtils.apiExpressRegister(fullPath, method, expressApp, handlerChain);

      console.log(
        `  ✔️  Registered: ${route.method.toUpperCase()} ${fullPath}`,
      );
    }
  };
}

export default ExpressFactory;
