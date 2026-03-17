import type { SchemaObject } from '../types';

export function inferSchema(value: unknown): SchemaObject {
  if (value === null || value === undefined) return { type: 'null' };
  if (typeof value === 'boolean') return { type: 'boolean', example: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { type: 'integer', example: value }
      : { type: 'number', example: value };
  }
  if (typeof value === 'string') return { type: 'string', example: value };
  if (Array.isArray(value)) return inferArraySchema(value);
  if (typeof value === 'object') return inferObjectSchema(value as Record<string, unknown>);
  return { type: 'string', example: String(value) };
}

function inferArraySchema(arr: unknown[]): SchemaObject {
  if (arr.length === 0) return { type: 'array', items: { type: 'null' } };
  const itemSchemas = arr.map(inferSchema);
  return { type: 'array', items: unifySchemas(itemSchemas) };
}

function inferObjectSchema(obj: Record<string, unknown>): SchemaObject {
  const properties: Record<string, SchemaObject> = {};
  const keys = Object.keys(obj);
  for (const key of keys) {
    properties[key] = inferSchema(obj[key]);
  }
  return { type: 'object', properties, required: keys.length > 0 ? [...keys] : undefined };
}

function unifySchemas(schemas: SchemaObject[]): SchemaObject {
  if (schemas.length === 0) return { type: 'null' };
  if (schemas.length === 1) return schemas[0];

  const types = new Set(schemas.map(s => s.type));
  if (types.size === 1) return schemas[0];

  const unique: SchemaObject[] = [];
  const seen = new Set<string>();
  for (const s of schemas) {
    const key = s.type + (s.properties ? JSON.stringify(Object.keys(s.properties).sort()) : '');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(s);
    }
  }
  if (unique.length === 1) return unique[0];
  return { oneOf: unique } as SchemaObject;
}
