import EventEmitter from "events";
import { glob } from "glob";
import path from "path";
import { SparkLiteEvent } from "../types/Event.type.js";

class SparkLite {
  private app: EventEmitter;

  constructor() {
    this.app = new EventEmitter();
  }

  public load = async () => {
    console.log("[SPARKLITE] SparkLite module loaded.");
    const eventPath = path.resolve(process.cwd(), "./src/events");
    console.log(`[SPARKLITE] Loading events from: ${eventPath}`);
    const eventDir = path
      .join(eventPath, "/**/*.{event.ts,event.js}")
      .replace(/\\/g, "/");
    const files = await glob(eventDir);

    for (const file of files) {
      const filePath = `file://${file.replace(/\\/g, "/")}`;
      const eventModule = await import(`${filePath}?update=${Date.now()}`);
      const eventConfig: SparkLiteEvent = eventModule.default;

      if (
        !eventConfig.eventName ||
        typeof eventConfig.listener !== "function"
      ) {
        console.warn(`[SPARKLITE] Skipping invalid Event file: ${file}`);
        continue;
      }

      this.app.on(eventConfig.eventName, eventConfig.listener);

      console.log(
        `[SPARKLITE] Registered event: ${eventConfig.eventName} from ${file}`
      );
    }
  };

  public Subscribe = (
    eventName: string,
    listener: (...args: any[]) => Promise<void>
  ) => {
    this.app.on(eventName, listener);
  };

  public Publish = (eventName: string, ...args: any[]) => {
    this.app.emit(eventName, ...args);
  };
}

export default SparkLite;
