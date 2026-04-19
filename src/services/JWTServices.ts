import DEBUG from "../utils/Debug.js";

class JWTService {
  private key: string;

  constructor(key: string) {
    this.key = key;
  }

  static validateAndNormalizeKey(
    key: string,
    isEdge: boolean,
    useRSA: boolean,
  ): string {
    let normalized = key.trim();

    // 1. Handle Base64 (If it doesn't start with '-' but looks like Base64)
    if (
      useRSA &&
      !normalized.startsWith("-----") &&
      /^[A-Za-z0-9+/=]+$/.test(normalized.replace(/\s/g, ""))
    ) {
      normalized = Buffer.from(normalized, "base64").toString("utf-8");
    }

    // 2. Handle escaped newlines (The classic .env / Dotenv issue)
    normalized = normalized.replace(/\\n/g, "\n");

    // 3. Validation Gate
    if (useRSA) {
      if (isEdge) {
        if (!normalized.includes("PUBLIC KEY")) {
          DEBUG.error("FATAL: Edge Node requires a PUBLIC KEY for RSA.");
          process.exit(1);
        }
      } else {
        if (!normalized.includes("PRIVATE KEY")) {
          DEBUG.error("FATAL: Main Server requires a PRIVATE KEY for RSA.");
          process.exit(1);
        }
      }
    }

    return normalized;
  }

    // ===================== PUBLIC METHODS =====================
}

export default JWTService;
