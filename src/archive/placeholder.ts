// 7. Router
    XRohrUtils.logSection("ROUTER MANAGER");
    this.routerManager = new SimplexRouterManager(config.restApi.apiPrefix);
    await this.routerManager.init();
    console.log("[ROUTER] All routes registered successfully.");

    // 8. Default Event Register
    XRohrUtils.logSection("DEFAULT EVENT REGISTRATION");
    // If using Simplex, register a default event listener for API calls
    if (config.restApi.useSimplex && this.sparkLiteEnabled) {
      // Register the Event that would be called by Global Route
      XRohrUtils.apiCallEvent(
        this.sparkLiteApp,
        this.routerManager as SimplexRouterManager,
        this.middlewareManager,
      );
      console.log("[DEFAULT EVENT] API_CALL event registered.");

      // Register the Global Route
      XRohrUtils.globalRouteHandler(
        config.restApi.apiPrefix,
        this.expressApp,
        this.sparkLiteApp,
      );
      console.log("[DEFAULT EVENT] GLOBAL_ROUTE_HANDLER registered.");
    }

    if (config.topology.isEdgeNode) {
      await this.edgeNodeStartup(
        config.defaults.edgeNode as EdgeNodeConfig,
      );
    } else {
      await this.mainNodeStartup(
        config.defaults.mainNode as MainNodeConfig,
      );
    }

    // ================== SERVICES =====================

    if (
      !config.topology.isEdgeNode &&
      config.enabledServices.includes("AUTH")
    ) {
      const authConfig = await AuthServices.authFilesCheck();
      if (!authConfig) {
        console.error(
          "[CONFIG ERROR] 'AUTH' service is enabled but 'authService' configuration is missing. Please provide 'authService' configuration details.",
        );
      } else {
        AuthServices.authMainRoute(authConfig);
      }

      console.log(
        "[AUTH SERVICE] Custom authentication route registered at /__xrohr__/auth/login",
      );
    }

    // ============================================

    private mainNodeStartup = async (
    config: MainNodeConfig,
  ) => {
    const { autoHydrateAPI, autoHydrateMemories } = config;
    const edgeUrls = config.edgeUrls;

    if (autoHydrateAPI || autoHydrateMemories) {
      // Initialize Memories utility once if needed
      if (autoHydrateMemories) {
        this.autoHydrateMemories = true;
        this.memoriesUtility = new MemoriaUtils();
        await this.memoriesUtility.loadMemoriesConfig();
      }

      if (autoHydrateAPI) {
        this.autoHydrateAPI = true;
      }

      for (const url of edgeUrls) {
        try {
          // 1. Normalize the Address (Works for IPs and Hostnames)
          const rawBase = url || "http://localhost:3001";
          const normalizedBase = rawBase.includes("://")
            ? rawBase
            : `http://${rawBase}`;
          const baseAddress = new URL(normalizedBase).origin;

          // 2. Deliver API Event
          if (autoHydrateAPI) {
            XRohrUtils.apiDeliverEvent(
              this.sparkLiteApp,
              this.rheosApp,
              `${baseAddress}/__xrohr__/auto-hydrate`,
            );
          }

          // 3. Deliver Memories Event
          if (autoHydrateMemories) {
            XRohrUtils.memoriesDeliverEvent(
              this.sparkLiteApp,
              this.rheosApp,
              `${baseAddress}/__xrohr__/auto-hydrate-memories`,
            );
          }

          console.log(
            `[DEFAULT EVENT] Hydration registered for node: ${baseAddress}`,
          );
        } catch (err: any) {
          console.error(
            `[ERROR] Failed to register hydration for ${url}:`,
            err.message,
          );
        }
      }

      console.log("[DEFAULT EVENT] Auto-hydration initialization complete.");
    }
  };

  private edgeNodeStartup = async (
    config: EdgeNodeConfig,
  ) => {
    const { allowHydrateAPI, allowHydrateMemories } = config;
    if (allowHydrateAPI) {
      XRohrUtils.apiRegisterEvent(
        this.sparkLiteApp,
        this.memoriaApp,
        this.routerManager,
        this.rheosApp,
      );
      console.log("[DEFAULT EVENT] API_REGISTER event registered.");

      XRohrUtils.autoHydrateRouteHandler(
        this.expressApp,
        this.sparkLiteApp,
      );
      console.log(
        "[DEFAULT EVENT] Auto-hydration API endpoint registered for edge node.",
      );
    }

    if (allowHydrateMemories) {
      XRohrUtils.autoHydrateMemoriesHandler(
        this.expressApp,
        this.memoriaApp,
      );
      console.log(
        "[DEFAULT EVENT] Auto-hydration API endpoint registered for Memoria collections on edge node.",
      );
    }
  };

  try {
          // @TODO: Check for Startup Events
          if (this.autoHydrateAPI) {
            const constructMap = this.routerManager.getConstructIndex();

            const constructObject = Object.fromEntries(constructMap);

            this.sparkLiteApp.Publish("API_DELIVER", {
              configurationMap: constructObject,
            });
          }

          if (this.autoHydrateMemories) {
            const memoriesConfigMap =
              this.memoriesUtility.getMemoriesConfigMap();
            const memoriesObject = Object.fromEntries(memoriesConfigMap);
            this.sparkLiteApp.Publish("MEMORIES_DELIVER", {
              configurationMap: memoriesObject,
            });
          }
        } catch (error) {
          // @TODO: Handle startup event errors (e.g., log them, retry logic, etc.)
          console.error("[XROHR] Error during startup events:", error);
        }

        static globalRouteHandler = (
    prefix: string,
    expressApp: Server,
    sparkliteApp: SparkLite,
  ) => {
    const app = expressApp.getApp();
    // GLOBAL API ENDPOINT
    // This endpoint will act as a bridge, forwarding requests to SparkLite which then routes them to the correct handler
    // Note: We use app.all() to catch all HTTP methods, but we will enforce method checks inside the handler
    // the API will forbid physical GET request, and only allow POST/PUT/DELETE with a body containing { id, method, data }
    app.all(new RegExp(`^/${prefix}/(.*)`), async (req, res) => {
      // 1. Immediate Method Check
      if (req.method === "GET") {
        return res.status(400).json({
          error: true,
          message:
            "Physical GET requests are not supported in Simplex mode. Use POST.",
        });
      }

      // 2. Body Existence Check
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({
          error: true,
          message:
            "Empty request body. Simplex routes require 'id' and 'method' in JSON.",
        });
      }

      // 3. Continue to Bridge
      const result = await sparkliteApp.Publish("API_CALL", {
        id: req.body.id,
        method: req.body.method,
        req: req.body.data,
        headers: req.headers,
        ip: req.ip || req.socket.remoteAddress,
      });

      res.json(result);
    });
  };

  static apiCallEvent = (
    sparkliteApp: SparkLite,
    routerManager: SimplexRouterManager,
    middlewareManager: MiddlewareManager,
  ) => {
    sparkliteApp.Subscribe("API_CALL", async (data, resolver) => {
      try {
        // 1. Try to run the engine
        const result = await routerManager.callSimplexAPI(
          data.id,
          data.req,
          data.method,
          middlewareManager,
          data.headers,
          data.ip,
        );

        // 2. Success! Send the user's data back.
        resolver?.(result);
      } catch (err: any) {
        // 3. ABORT! A middleware called next(err) or a handler threw an exception.
        // We just pass the raw error straight back to the client.
        console.error(`[Simplex Error] Route '${data.id}':`, err.message);

        resolver?.({
          error: true,
          message: err.message || "Internal Server Error",
          // Pass the raw error object if the user attached custom properties to it
          raw: err,
        });
      }
    });
  };

  static apiRegisterEvent = (
    sparkLiteApp: SparkLite,
    memoriaApp: Memoria,
    routerManager: SimplexRouterManager,
    rheosApp: Rheos,
  ) => {
    sparkLiteApp.Subscribe("API_REGISTER", async (data) => {
      routerManager.registerRoute(
        data.configuration,
        memoriaApp,
        rheosApp,
        data.source,
      );
    });
  };

  static autoHydrateRouteHandler = (
    expressApp: Server,
    sparkLiteApp: SparkLite,
  ) => {
    const app = expressApp.getApp();
    app.post("/__xrohr__/auto-hydrate", async (req, res) => {
      const { configurationMap } = req.body;

      if (!configurationMap || typeof configurationMap !== "object") {
        return res
          .status(400)
          .json({ error: "Bad Request: Missing or invalid configuration map" });
      }

      let successCount = 0;
      let failureCount = 0;
      for (const [id, config] of Object.entries(configurationMap)) {
        try {
          sparkLiteApp.Publish("API_REGISTER", {
            configuration: config,
            source: "auto-hydrate",
          });
          successCount++;
        } catch (err) {
          console.error(
            `[Auto-Hydrate Error] Failed to register route '${id}':`,
            err,
          );
          failureCount++;
        }
      }

      res.json({ successCount, failureCount });
    });
  };

  static autoHydrateMemoriesHandler = (
    expressApp: Server,
    memoriaApp: Memoria,
  ) => {
    const app = expressApp.getApp();
    app.post("/__xrohr__/auto-hydrate-memories", async (req, res) => {
      const { configurationMap } = req.body;
      console.log(
        "[Auto-Hydrate Memories] Received auto-hydrate request for memories collections.",
      );
      console.log(
        "[Auto-Hydrate Memories] Request body:",
        req.body.configurationMap,
      );

      if (!configurationMap || typeof configurationMap !== "object") {
        return res
          .status(400)
          .json({ error: "Bad Request: Missing or invalid configuration map" });
      }

      let successCount = 0;
      let failureCount = 0;
      console.log(
        "[Auto-Hydrate Memories] Starting to update memories collections based on received configuration...",
      );
      for (const [name, config] of Object.entries(configurationMap)) {
        try {
          // Here you would typically update your Memoria instance with the new configuration.
          // @TODO: Implement the logic to update the Memoria collections based on the received configuration.
          const conf = config as MemoriesConfig;
          console.log(
            `[DEBUG] Auto-hydrating memories collection '${name}' with primary key '${conf.memoriesPrimaryKey}' and schema:`,
            conf.memoriesSchema,
          );
          memoriaApp.createMemoriesCollection(
            name,
            conf.memoriesPrimaryKey,
            conf.memoriesSchema,
          );
          // This is a placeholder to indicate where that logic would go.
          console.log(`[Auto-Hydrate Memories] Received config for '${name}'`);
          successCount++;
        } catch (err) {
          console.error(
            `[Auto-Hydrate Memories Error] Failed to update memories config '${name}':`,
            err,
          );
          failureCount++;
        }
      }
      res.json({ successCount, failureCount });
    });
  };

  static apiDeliverEvent = (
    sparkLiteApp: SparkLite,
    rheosApp: Rheos,
    endpoint: string,
  ) => {
    sparkLiteApp.Subscribe("API_DELIVER", async (data, resolver) => {
      try {
        const rheosConfig: AxiosCall = {
          name: "API_DELIVERY",
          method: "POST",
          endpoint: endpoint,
          body: data,
          headers: {
            "Content-Type": "application/json",
          },
          absoluteUri: true,
        };
        const result = await rheosApp.performConfigCall(rheosConfig);

        resolver?.(result);
      } catch (error) {
        console.error("[API_DELIVER Error] Failed to deliver API call:", error);
        resolver?.({
          error: true,
          message:
            typeof error === "object" && error !== null && "message" in error
              ? (error as { message?: string }).message ||
                "Failed to deliver API call"
              : "Failed to deliver API call",
          raw: error,
        });
      }
    });
  };

  static memoriesDeliverEvent = (
    sparkLiteApp: SparkLite,
    rheosApp: Rheos,
    endpoint: string,
  ) => {
    sparkLiteApp.Subscribe("MEMORIES_DELIVER", async (data, resolver) => {
      try {
        const rheosConfig: AxiosCall = {
          name: "MEMORIES_DELIVER",
          method: "POST",
          endpoint: endpoint,
          body: data,
          headers: {
            "Content-Type": "application/json",
          },
          absoluteUri: true,
        };
        const result = await rheosApp.performConfigCall(rheosConfig);

        resolver?.(result);
      } catch (error) {
        console.error(
          "[MEMORIES_DELIVER Error] Failed to deliver memories update:",
          error,
        );
        resolver?.({
          error: true,
          message:
            typeof error === "object" && error !== null && "message" in error
              ? (error as { message?: string }).message ||
                "Failed to deliver memories update"
              : "Failed to deliver memories update",
          raw: error,
        });
      }
    });
  };