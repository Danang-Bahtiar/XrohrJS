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
- Typescript Support: types are available, however im testing the package mostly on plain JavaScript. Could use some help on TypeScript Testing.

## 3. Installation

- Github Direct
  ```sh
  npm i https://github.com/Danang-Bahtiar/XrohrJS.git
  ```
- NPM Registry
  ```sh
  npm i @dan_koyuki/xrohrjs
  ```

## 4. Docs

[XRohrJS](https://portfolio.irwantodan.dev/project/xrohr)
