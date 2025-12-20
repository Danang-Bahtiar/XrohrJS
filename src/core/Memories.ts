import { SchemaDefinition, SchemaField } from "../types/Memoria.type.js";

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => acc && acc[part], obj);
}

class Memories {
  private primaryKey: string;
  private schema!: Map<string, SchemaField>;

  private ReadMemories: Map<string, any>;
  private WriteMemories: Map<string, any>;
  private Indices: Map<string, Map<any, Set<string>>>;
  private errorStacks: Map<string, any>;

  private Locks: Map<string, Promise<void>>;
  private indexRules: Map<string, boolean | any>;

  constructor(primaryKey: string, schemaDef?: SchemaDefinition | string) {
    this.primaryKey = primaryKey;
    this.schema = new Map();

    // Parse Schema (same as before)
    if (schemaDef) {
      let definitions: SchemaDefinition =
        typeof schemaDef === "string" ? JSON.parse(schemaDef) : schemaDef;

      Object.entries(definitions).forEach(([key, rule]) => {
        this.schema.set(key, rule);
      });
    }

    this.ReadMemories = new Map();
    this.WriteMemories = new Map();
    this.Indices = new Map();
    this.errorStacks = new Map();

    this.Locks = new Map();
    this.indexRules = new Map(); // Changed from Set to Map

    if (this.schema.size > 0) {
      this.registerIndicesFromSchema(this.schema);
    }
  }

  // ----------------------------------------
  // Internal per-key mutex
  // ----------------------------------------
  private async lock(id: string, fn: () => Promise<any>) {
    const prev = this.Locks.get(id) || Promise.resolve();

    let release!: () => void;
    const next = new Promise<void>((res) => (release = res));

    this.Locks.set(
      id,
      prev.then(() => next)
    );

    try {
      return await fn();
    } finally {
      release();
      if (this.Locks.get(id) === next) {
        this.Locks.delete(id);
      }
    }
  }

  private registerIndicesFromSchema(
    schema: Map<string, SchemaField>,
    prefix = ""
  ) {
    for (const [key, rule] of schema.entries()) {
      const fullPath = prefix ? `${prefix}.${key}` : key;

      if (rule.index !== undefined) {
        // Save the rule (true or specific value)
        this.indexRules.set(fullPath, rule.index);
        this.Indices.set(fullPath, new Map());
      }

      if (rule.properties) {
        const nestedMap = new Map(Object.entries(rule.properties));
        this.registerIndicesFromSchema(nestedMap, fullPath);
      }
    }
  }

  // ----------------------------------------
  // SCHEMA VALLIDATION
  // ----------------------------------------
  /**
   * Validates a single object against a specific schema definition
   */
  private processSchema(
    data: any,
    schemaDef: SchemaDefinition | undefined
  ): any {
    // If no specific schema (or schema-less mode), allow everything
    if (!schemaDef || Object.keys(schemaDef).length === 0) return data;

    const sanitized: any = {};

    for (const [key, rule] of Object.entries(schemaDef)) {
      let value = data[key];

      // 1. Defaults
      if (value === undefined && rule.default !== undefined) {
        value = rule.default;
      }

      // 2. Required Check
      if (rule.required && (value === undefined || value === null)) {
        throw new Error(`Validation Error: Field '${key}' is required.`);
      }

      // 3. Type Checking & Recursion
      if (value !== undefined && value !== null) {
        // --- HANDLE OBJECTS (Recursion) ---
        if (rule.type === "object") {
          if (typeof value !== "object" || Array.isArray(value)) {
            throw new Error(`Validation Error: Field '${key}' expects Object.`);
          }

          // If this object has a 'properties' definition, dive deeper!
          if (rule.properties) {
            value = this.processSchema(value, rule.properties);
          }
        }

        // --- HANDLE ARRAYS ---
        else if (rule.type === "array") {
          if (!Array.isArray(value)) {
            throw new Error(`Validation Error: Field '${key}' expects Array.`);
          }
        }

        // --- HANDLE PRIMITIVES ---
        else if (typeof value !== rule.type) {
          throw new Error(
            `Validation Error: Field '${key}' expects ${
              rule.type
            }, got ${typeof value}.`
          );
        }
      }

      // 4. Assign Valid Data
      if (value !== undefined) {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  // Wrapper to start the validation using the root schema
  private validateAndSanitize(data: any): any {
    // Convert Map to plain object for the recursive function
    const rootSchema: SchemaDefinition = Object.fromEntries(this.schema);

    const sanitized = this.processSchema(data, rootSchema);

    // Preserve Metadata (Primary Key & Version)
    if (data[this.primaryKey])
      sanitized[this.primaryKey] = data[this.primaryKey];
    if (data.__version) sanitized.__version = data.__version;

    return sanitized;
  }

  // ----------------------------------------
  // PUBLIC API
  // ----------------------------------------

  public getMemoriesKey = () => this.primaryKey;
  public updatePrimaryKey = (newKey: string) => (this.primaryKey = newKey);

  /** Get record (writeMemories takes priority) */
  public getRecord(id: string) {
    return this.WriteMemories.get(id) || this.ReadMemories.get(id);
  }

  /** Get all records (merged) */
  public getAll() {
    const all = new Map<string, any>();

    // read first
    this.ReadMemories.forEach((v, k) => all.set(k, v));
    // overwrite with writes
    this.WriteMemories.forEach((v, k) => all.set(k, v));

    return all;
  }

  /** CREATE/UPDATE → writeMemories */
  public async setRecord(data: any) {
    const id = data[this.primaryKey];
    if (!id) throw new Error("Key field is missing.");

    const validData = this.validateAndSanitize(data);

    return this.lock(id, async () => {
      const existing = this.WriteMemories.get(id) || this.ReadMemories.get(id);

      const newRecord = {
        ...validData,
        __version: existing ? existing.__version + 1 : 1,
        isSync: false,
      };

      // ✅ FIX: Update the Index
      // We pass the OLD record (to remove from index) and NEW record (to add to index)
      this.updateIndex(id, existing, newRecord);

      this.WriteMemories.set(id, newRecord);

      if (this.ReadMemories.has(id)) {
        this.ReadMemories.delete(id);
      }

      return newRecord;
    });
  }

  /** Remove from BOTH caches */
  public async removeRecord(id: string, expectedVersion?: number) {
    return this.lock(id, async () => {
      const record = this.WriteMemories.get(id) || this.ReadMemories.get(id);
      if (!record) return;

      if (
        expectedVersion !== undefined &&
        record.__version !== expectedVersion
      ) {
        throw new Error("Version mismatch. Delete aborted.");
      }

      // ✅ FIX: Remove from Index (pass null as newRecord)
      this.updateIndex(id, record, null);

      this.WriteMemories.delete(id);
      this.ReadMemories.delete(id);
    });
  }

  // ----------------------------------------
  // SYNC HELPERS
  // ----------------------------------------

  /** All data that needs syncing */
  public getUnsynced() {
    return Array.from(this.WriteMemories.values()).filter((v) => !v.isSync);
  }

  /** After successful sync */
  public markSynced(id: string) {
    const record = this.WriteMemories.get(id);
    if (!record) return;

    const synced = { ...record, isSync: true };

    this.WriteMemories.delete(id);
    this.ReadMemories.set(id, synced);
  }

  /** When sync fails */
  public markSyncFailed(id: string, error: any) {
    const record = this.WriteMemories.get(id);
    if (!record) return;

    this.errorStacks.set(id, error);
  }

  // ----------------------------------------
  // INDEX
  // ----------------------------------------

  /**
   * Fallback Search: O(N) Scan
   * Supports nested paths like "stats.wins"
   */
  public findMany(fieldPath: string, value: any): any[] {
    const results: any[] = [];

    // Helper to check a record
    const check = (record: any) => {
      // Use the helper to dig deep into the object
      const recordValue = getNestedValue(record, fieldPath);
      if (recordValue === value) {
        results.push(record);
      }
    };

    // Scan Write Memory (Dirty)
    this.WriteMemories.forEach(check);

    // Scan Read Memory (Clean)
    this.ReadMemories.forEach(check);

    return results;
  }

  private updateIndex(id: string, oldRecord: any, newRecord: any) {
    this.indexRules.forEach((rule, fieldPath) => {
      const indexMap = this.Indices.get(fieldPath)!;

      // --- REMOVAL LOGIC ---
      if (oldRecord) {
        const oldValue = getNestedValue(oldRecord, fieldPath);

        // If Full Index (true) OR Partial Index matches (rule === oldValue)
        if (rule === true || rule === oldValue) {
          if (oldValue !== undefined) {
            const idSet = indexMap.get(oldValue);
            if (idSet) {
              idSet.delete(id);
              if (idSet.size === 0) indexMap.delete(oldValue);
            }
          }
        }
      }

      // --- ADDITION LOGIC ---
      if (newRecord) {
        const newValue = getNestedValue(newRecord, fieldPath);

        // Only index if rule is TRUE (index everything)
        // OR if newValue matches the specific rule (e.g., "public")
        if (rule === true || rule === newValue) {
          if (newValue !== undefined) {
            if (!indexMap.has(newValue)) {
              indexMap.set(newValue, new Set());
            }
            indexMap.get(newValue)!.add(id);
          }
        }
      }
    });
  }

  // 3. The Smart Find Logic
  public findByIndex(fieldPath: string, value: any): any[] {
    const rule = this.indexRules.get(fieldPath);

    // If no index exists, we must scan manually
    if (rule === undefined) {
      return this.findMany(fieldPath, value);
    }

    // If it's a Partial Index (e.g., "public"), but user asks for "private",
    // we do NOT have that in the index. We must fallback to scan.
    if (rule !== true && rule !== value) {
      // console.warn("Value not covered by partial index, falling back to scan");
      return this.findMany(fieldPath, value);
    }

    // Fast Path: Retrieve from Index
    const idSet = this.Indices.get(fieldPath)?.get(value);
    if (!idSet) return [];

    return Array.from(idSet)
      .map((id) => this.getRecord(id))
      .filter(Boolean);
  }
}

export default Memories;
