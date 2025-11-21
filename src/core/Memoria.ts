/**
 * A lightweight in-memory data store with schema validation.
 * 
 * @example
 * const userSchema = { id: 0, name: "", age: 0 };
 * const memoria = new Memoria("id", userSchema);
 * memoria.createRecord("id", { id: 1, name: "Dan", age: 21 });
 * console.log(memoria.getRecord(1));
 */
class Memoria {
  private key: string;
  // private schema: object;
  private Memories: Map<string, any>;

  constructor(key: string) {
    this.key = key;
    // this.schema = schema;
    this.Memories = new Map();
  }

  // =====================
  // Public API
  // =====================

  /** Retrieves a record by its key value. */
  public getRecord(id: string) {
    return this.Memories.get(id);
  }

  /** Removes a record by its key value. */
  public removeRecord(id: string) {
    this.Memories.delete(id);
  }

  /** Updates an existing record or creates a new one. */
  public setRecord(data: any) {
    if (!data.hasOwnProperty(this.key)) throw new Error("Data must contain the key field.");
    if (!data[this.key]) throw new Error("Key field cannot be empty.");
    this.Memories.set(data[this.key], data);
  }

  /** Returns all stored records. */
  public getAll() {
    return this.Memories;
  }
}

export default Memoria;
