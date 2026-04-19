
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

  // ========================================
  // STANDARD HTTP
  // ========================================
  public createHttpHandler = (construct: ForwardSource, rheosApp: Rheos) => {
    return async (req: Request, res: Response) => {
      try {
        const methodMap = {
          get: "GET",
          post: "POST",
          put: "PUT",
          delete: "DELETE",
        } as const;

        const fwConfig = construct.config || {};

        const rheosConfig: AxiosCall = {
          name: "ForwardCall",
          // 1. Physical Network Method
          method: methodMap[construct.targetMethod],
          // 2. The Headers Fix (Force TS to accept Express headers, or send undefined)
          headers: fwConfig.forwardHeaders
            ? (req.headers as Record<string, string>)
            : {
                "Content-Type": "application/json",
              },
          body: req.body,
          absoluteUri: true,
          endpoint: construct.resource,
        };

        const mainServerResponse = await rheosApp.performConfigCall(rheosConfig);

        // return res.status(mainServerResponse.status).json(responseData);
      } catch (error: any) {
        const errMsg =
          error.name === "AbortError" ? "Gateway Timeout" : error.message;

        const status = error.name === "AbortError" ? 504 : 502;
        return res
          .status(status)
          .json({ status: "Error", message: `Proxy Failed: ${errMsg}` });
      }
    };
  };