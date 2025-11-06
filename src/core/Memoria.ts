class Memoria {
  private key: string;
  private schema: object;
  private Memories: Map<string, any>;

  constructor(key: string, schema: object) {
    this.key = key;
    this.schema = schema;
    this.Memories = new Map();
  }

  // =====================
  // Private helpers
  // =====================
  private isObject(value: any): value is object {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  private isArray(value: any): value is any[] {
    return Array.isArray(value);
  }

  private isString(value: any): value is string {
    return typeof value === "string";
  }

  private isNumber(value: any): value is number {
    return typeof value === "number";
  }

  private isBoolean(value: any): value is boolean {
    return typeof value === "boolean";
  }

  private dataValidation = (data: any, schema: any = this.schema): boolean => {
    if (!this.isObject(data)) {
      console.warn("Invalid data: not an object");
      return false;
    }

    const dataObj = data as Record<string, any>;
    const schemaObj = schema as Record<string, any>;

    const keys = Object.keys(dataObj);
    const targetKeys = Object.keys(schemaObj);

    // 1. Key check
    const missing = targetKeys.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !targetKeys.includes(k));
    if (missing.length > 0 || extra.length > 0) {
      console.warn("Invalid data: key mismatch", { missing, extra });
      return false;
    }

    // 2. Type check
    for (const key of targetKeys) {
      const value = dataObj[key];
      const target = schemaObj[key];

      if (this.isObject(target)) {
        if (!this.isObject(value)) {
          console.warn(`Invalid data: ${key} should be object`);
          return false;
        }

        // ✅ Recursive call using sub-schema
        if (!this.dataValidation(value, target)) {
          console.warn(`Invalid nested structure in key: ${key}`);
          return false;
        }
      } else if (this.isArray(target)) {
        if (!this.isArray(value)) {
          console.warn(`Invalid data: ${key} should be array`);
          return false;
        }
        if (
          target.length > 0 &&
          !value.every((v) => typeof v === typeof target[0])
        ) {
          console.warn(`Invalid array element type in ${key}`);
          return false;
        }
      } else if (typeof value !== typeof target) {
        console.warn(
          `Invalid data type at key "${key}": expected ${typeof target}, got ${typeof value}`
        );
        return false;
      }
    }

    return true;
  };

  // =====================
  // Public function
  // =====================
  public createRecord = (key: string, data: any) => {
    if (key !== this.key) throw new Error("Invalid key for creating record");
    this.dataValidation(data, this.schema);
    this.Memories.set(data[this.key], data);
  };

  public staticRecord = (key: string, data: any) => {
    if (key !== this.key) throw new Error("Invalid key for static record");
    this.Memories.set(data[this.key], data);
  };
}

export default Memoria;
