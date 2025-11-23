class Memoria {
  private key: string;
  private Memories: Map<string, any>;
  private Locks: Map<string, Promise<void>>;

  constructor(key: string) {
    this.key = key;
    this.Memories = new Map();
    this.Locks = new Map();
  }

  // ----------------------------------------
  // Internal per-key mutex (transaction core)
  // ----------------------------------------
  private async lock(id: string, fn: () => Promise<any>) {
    const prev = this.Locks.get(id) || Promise.resolve();

    let release!: () => void;
    const next = new Promise<void>(res => (release = res));

    this.Locks.set(id, prev.then(() => next));

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
  // PUBLIC CRUD
  // ----------------------------------------

  /** READ: no lock needed */
  public getRecord(id: string) {
    return this.Memories.get(id);
  }

  /** READ ALL: no lock needed */
  public getAll() {
    return this.Memories;
  }

  /** CREATE/UPDATE (implicit transaction + versioning) */
  public async setRecord(data: any) {
    if (!data[this.key]) throw new Error("Key field is missing.");
    const id = data[this.key];

    return this.lock(id, async () => {
      const current = this.Memories.get(id);

      const newRecord = {
        ...data,
        __version: current ? current.__version + 1 : 1,
      };

      this.Memories.set(id, newRecord);
      return newRecord;
    });
  }

  /** DELETE (implicit transaction + optional versioning) */
  public async removeRecord(id: string, expectedVersion?: number) {
    return this.lock(id, async () => {
      const current = this.Memories.get(id);
      if (!current) return;

      if (
        expectedVersion !== undefined &&
        current.__version !== expectedVersion
      ) {
        throw new Error("Version mismatch. Delete aborted.");
      }

      this.Memories.delete(id);
    });
  }
}

export default Memoria;
