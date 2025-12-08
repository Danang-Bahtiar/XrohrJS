class Memories {
  private primaryKey: string;

  private ReadMemories: Map<string, any>;
  private WriteMemories: Map<string, any>;
  private errorStacks: Map<string, any>;

  private Locks: Map<string, Promise<void>>;

  constructor(primaryKey: string) {
    this.primaryKey = primaryKey;

    this.ReadMemories = new Map();
    this.WriteMemories = new Map();
    this.errorStacks = new Map();

    this.Locks = new Map();
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

    return this.lock(id, async () => {
      const existing = this.WriteMemories.get(id) || this.ReadMemories.get(id);

      const newRecord = {
        ...data,
        __version: existing ? existing.__version + 1 : 1,
        isSync: false, // pending sync
      };

      this.WriteMemories.set(id, newRecord);
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
}

export default Memories;
