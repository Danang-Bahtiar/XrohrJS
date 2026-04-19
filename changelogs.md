# Changelog

## - "The Topology Update" (2026-April-19)

### Added
- **Identity System**: Unified `self` identity containing `id`, `type`, `baseUrl`, and `version`.
- **Node Discovery**: New handshake protocol (Main-to-Edge) using JWT/RSA.
- **Visual Debugger**: Added `DEBUG` class with ANSI color support for clean, readable logs.
- **Strict Startup**: Added `process.exit(1)` for mandatory module initialization failures.
- **Cache System**: Added `MemoriesUtils` to support auto load Cache Schema.
- **Files Added**: 
  - `core/topology/edge.utils.ts`
  - `core/topology/main.utils.ts`
  - `core/topology/shared.utils.ts`
  - `core/Xrohr.types.ts`
  - `modules/Memoria/Memoria.utils.ts`
  - `services/AuthServices.ts`
  - `services/JWTServices.ts`
  - `utils/Debug.ts`

### Changed
- **Config Refactor**: Moved `apiPrefix` to `ServerConfig`; removed `ActuaConfig` and `autoHydrate` bloat.
- **JWT Service**: Added RSA support with "Smart Guard" (Edge needs Public key, Main needs Private).
- **Rheos (Axios)**: Enhanced retry/fallback strategies and dynamic URL registration.
- **Files Changed**:
  - `core/Server.ts`
  - `core/XRohr.ts`
  - `core/XRohrJS.ts`
  - `modules/Memoria/Memoria.type.ts`
  - `modules/Rheos/Rheos.ts`
  - `modules/Rheos/Rheos.type.ts`
  - `modules/Router/ConstructFactory.ts`
  - `modules/Router/Router.type.ts`
  - `modules/Router/SimplexRouterManager.ts`
  - `modules/Router/SparkLite.ts`

### Removed
- **Routing**: `Express Route` has been removed.
