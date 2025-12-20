export interface SchemaField {
  type: "string" | "number" | "boolean" | "object" | "array";
  required?: boolean;
  default?: any;
  
  // ✅ NEW: Defines the shape of nested objects
  properties?: { [key: string]: SchemaField }; 

  /**
   * - true: Indexes ALL values (Full Index).
   * - value: Only indexes records where this field equals the value (Partial Index).
   */
  index?: boolean | string | number;
}

export interface SchemaDefinition {
  [key: string]: SchemaField;
}