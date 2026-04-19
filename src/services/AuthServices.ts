import { Request, Response } from "express";
import { AuthServiceConfig } from "../config/Xrohr.config.js";
import { SimplexExpressRouterDefinition } from "../modules/Router/Router.types.js";
import { glob } from "glob";
import path from "path";

class AuthServices {
  static authFilesCheck = async () => {
    const routePath = path.resolve(process.cwd());
    const pattern = path
      .join(routePath, "auth.config.{ts,js}")
      .replace(/\\/g, "/");
    const files = await glob(pattern);

    if (files.length > 0) {
      const configPath = files[0];
      // Dynamic import to check the content
      const filePath = `file://${configPath.replace(/\\/g, "/")}`;
      const module = await import(`${filePath}?update=${Date.now()}`);

      const config = module.default || module;

      // Validation: Check if it matches your interface signature
      if (
        config &&
        typeof config === "object" &&
        "databaseHandler" in config &&
        "denormalizeHandler" in config &&
        typeof config.databaseHandler === "function" &&
        typeof config.denormalizeHandler === "function"
      ) {
        console.log(`[AUTH SERVICE] Valid config found: ${configPath}`);
        return config as AuthServiceConfig;
      }

      console.warn(
        `[AUTH SERVICE] File found but it doesn't match AuthServiceConfig.`,
      );
      return null;
    } else {
      console.warn(
        `[AUTH SERVICE] No auth configuration file found at ${pattern}. Authentication service will not be initialized.`,
      );
      return null;
    }
  };

  static authMainRoute = (
    config: AuthServiceConfig,
  ): SimplexExpressRouterDefinition => {
    return {
      type: "express",
      routes: [
        {
          id: "default-auth-route",
          method: "post",
          middlewares: [],
          handler: async (req: Request, res: Response) => {
            try {
              const dbHandler = config.databaseHandler;
              const denormHandler = config.denormalizeHandler;

              if (!dbHandler || !denormHandler) {
                res.status(500).json({
                  error: "Authentication service is not properly configured.",
                });
                return;
              }

              const userData = await dbHandler(req.body);
              const denormalizedData = await denormHandler(userData);

              // TODO: Add JWT or session token generation here for real authentication flow
              // TODO: SENT THE TOKEN TO EDGE SERVERS
              // JWT Service ... mainNode mode read private.key and edgeNode mode read public.key, then use JWT to sign the token with private key and verify with public key on edge nodes.

              return {};
            } catch (error: any) {
              console.error(
                "[AUTH SERVICE] Error occurred during authentication:",
                error.message,
              );
              return {
                message: "An error occurred during authentication.",
              };
            }
          },
        },
      ],
    };
  };
}

export default AuthServices;
