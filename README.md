# XRohrJS
---

## 1. Overview
A lightweight, opinionated, and highly flexible Node.js backend framework built on top of Express.js. XRohrJS is designed to streamline the development of resilient, live-service APIs by enforcing a centralized configuration structure and providing a modular, event-driven architecture.

## 2. Key Features
- Centralized Configuration: Single source of truth for server settings, origins, and module enablement.
- Dynamic Route Handling: Automates API endpoint registration for seamless content updates (e.g., via metadata "recipes").
- Built-in In-Memory Caching: Includes the `Memoria` module for fast, local data storage when a dedicated caching service (like Redis) is unavailable.
- Event-Driven Communication: Leverages the `SparkLite` module for creating event based activity.
- Managed HTTP Client: Includes the `Rheos` module, a pre-configured Axios wrapper for easy external API calls.
- Typescript Support: types are available, however i test the package mostly on plain JavaScript. Could use some help on TypeScript Testing.

## 3. Installation
- Github Direct
    ```sh
    npm i https://github.com/Danang-Bahtiar/XrohrJS.git
    ```
- NPM Registry
    ```sh
    npm i @dan_koyuki/xrohrjs
    ```

## 4. Usage
### 1. Config
- Create `xrohr.config.js` in the root directory of the project
- add and change the following code to your need:
  ```js
  import {XrohrJS} from '@dan_koyuki/xrohrjs'

  export default XrohrJS.XrohrConfig({
    "server": {
        port: process.env.PORT || 3001,
        allowedOrigins: ["http://localhost:3000"],
        allowedMethods: ["GET", "POST", "PUT", "DELETE"],
        useDefaultCors: true,
        useJsonParser: true,
        useUrlEncoded: true
    },
    "router": {
        useDefaultRouterRegistration: true,
        apiPrefix: "/api",
    },
    "sparkLite": {
        enabled: true
    },
    "axios": {
        enabled: true,
        defaultTimeout: 10000,
        baseURL: "http://localhost:3000/api"
    },
    "memoria": {
        enabled: true
    }
  })
  ```

### 2. Starting the Server
- create `index.js`
- add and change the following code example:
  ```js
  import { XrohrJS } from "@dan_koyuki/xrohrjs";
  
  // We use an async IIFE to handle the top-level await
  (async () => {
    try {
        console.log("Starting application...");
            
        // .create() loads all configs, routes, and services
        const client = await XrohrJS.create();
        
        // .start() begins listening on the port in your config
        client.start();
        
        // You could access other modules here if needed
        // const spark = client.getSparkApp();
    } catch (error) {
        // This ensures any errors during startup are not hidden
        console.error("Failed to start XRohrJS application:", error);
        process.exit(1); // Exit with an error code
    }
  }())

  // The following work on some case:
  // import {XrohrJS} from '@dan_koyuki/xrohrjs

  // const client = await XRohrJS.create();
  // client.start();
  ```

### 3. Creating a Route
- XRohrJS will automatically import all file that end with `.js` or `.ts` inside `./src/routes` directory.
- there are two type of Route Template, `TemplateRecipe` and `ConstructRecipe`. A TemplateRecipe use a stirct template provided by XRohrJS, while ConstructRecipe will need a pipeline that will generate the route handler where this pipeline might be prefered to be created by self.
- a file can have more than one route, it all will be registered under `basePath` and endpoint `path`.
- example of `TemplateRecipe` as follow:
    ```js
    import {XrohrJS} from '@dan_koyuki/xrohrjs'

    export default XrohrJS.Route({
        basePath: "/health",
        type: "TemplateRecipe",
        routes: [
            {
                name: "healthCheck",
                method: "get",
                middlewares: [],
                path: "/",
                handlers: async (req, res) => {
                    return res.json({ status: "OK" });
                }
            }
        ]
    })
    ```
- while ConstructRecipe is not implemented here, it was there to differentiate between which file the loader will read. A ConstructRecipe later can be used to as metadata that tell other XRohrJS server what endpoint to create.