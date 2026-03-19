import { SchemaDefinition } from "./Memoria.type.js";
import Memories from "./Memories.js";

class Memoria {
  private memoriesCollections: Map<string, Memories>;

  constructor() {
    this.memoriesCollections = new Map();
  }

  // ----------------------------------------
  // CREATE
  // ----------------------------------------
  /**
   * createMemoriesCollection
   * Creates a new memories collection with the specified name, primary key, and schema definition.
   * Work akin to a table in a database.
   * @param name - Name of the memories collection.
   * @param primaryKey - Primary key field for the collection.
   * @param p0 - Optional schema definition or string.
   * string should be a valid JSON representation of SchemaDefinition. (e.g. if schema was received from API response.)
   * @returns 
   */
  public createMemoriesCollection(
    name: string,
    primaryKey: string,
    p0?: string | SchemaDefinition | undefined
  ): Memories {
    if (this.memoriesCollections.has(name)) {
      throw new Error(`Memories collection with name ${name} already exists.`);
    }

    const newCollection = new Memories(primaryKey, p0);
    this.memoriesCollections.set(name, newCollection);
    return newCollection;
  }

  // ----------------------------------------
  // GETTERS
  // ----------------------------------------
  public getMemoriesCollection(name: string): Memories | undefined {
    return this.memoriesCollections.get(name);
  }

  /** Throws if missing */
  public requireMemoriesCollection(name: string): Memories {
    const col = this.memoriesCollections.get(name);
    if (!col) {
      throw new Error(`Memories collection '${name}' does not exist.`);
    }
    return col;
  }

  public hasMemoriesCollection(name: string): boolean {
    return this.memoriesCollections.has(name);
  }

  public getAllMemoriesCollections(): Map<string, Memories> {
    return this.memoriesCollections;
  }

  public getCollectionNames(): string[] {
    return Array.from(this.memoriesCollections.keys());
  }

  // ----------------------------------------
  // RENAME / KEY UPDATE
  // ----------------------------------------
  public updateMemoriesCollectionName(oldName: string, newName: string): void {
    const collection = this.requireMemoriesCollection(oldName);

    if (this.memoriesCollections.has(newName)) {
      throw new Error(
        `Memories collection with name ${newName} already exists.`
      );
    }

    this.memoriesCollections.delete(oldName);
    this.memoriesCollections.set(newName, collection);
  }

  public updateMemoriesCollectionKey(name: string, newKey: string): void {
    const collection = this.requireMemoriesCollection(name);
    collection.updatePrimaryKey(newKey);
  }

  // ----------------------------------------
  // DELETE
  // ----------------------------------------
  public deleteMemoriesCollection(name: string): boolean {
    return this.memoriesCollections.delete(name);
  }

  public clearAllMemoriesCollections(): void {
    this.memoriesCollections.clear();
  }
}

export default Memoria;
