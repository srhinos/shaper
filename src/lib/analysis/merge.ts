import type { SchemaObject } from '../types';

export function mergeSchemas(a: SchemaObject, b: SchemaObject): SchemaObject {
  if (!a) return b;
  if (!b) return a;

  if (a.type !== b.type) {
    const variants = [
      ...(a.oneOf || [a]),
      ...(b.oneOf || [b]),
    ];
    const unique = deduplicateSchemas(variants);
    return unique.length === 1 ? unique[0] : { oneOf: unique } as SchemaObject;
  }

  if (a.type === 'object' && b.type === 'object') return mergeObjects(a, b);
  if (a.type === 'array' && b.type === 'array') return mergeArrays(a, b);
  return mergePrimitives(a, b);
}

function mergeObjects(a: SchemaObject, b: SchemaObject): SchemaObject {
  const propsA = a.properties || {};
  const propsB = b.properties || {};
  const allKeys = new Set([...Object.keys(propsA), ...Object.keys(propsB)]);
  const reqA = new Set(a.required || []);
  const reqB = new Set(b.required || []);

  const properties: Record<string, SchemaObject> = {};
  const required: string[] = [];

  for (const key of allKeys) {
    const inA = key in propsA;
    const inB = key in propsB;

    if (inA && inB) {
      properties[key] = mergeSchemas(propsA[key], propsB[key]);
      if (reqA.has(key) && reqB.has(key)) required.push(key);
      else properties[key] = { ...properties[key], nullable: true };
    } else {
      properties[key] = { ...(propsA[key] || propsB[key]), nullable: true };
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

function mergeArrays(a: SchemaObject, b: SchemaObject): SchemaObject {
  const items = a.items && b.items ? mergeSchemas(a.items, b.items) : a.items || b.items;
  return { type: 'array', ...(items ? { items } : {}) };
}

function mergePrimitives(a: SchemaObject, b: SchemaObject): SchemaObject {
  if (a.type === 'string') {
    if ((a.enum && a.enum.length === 0) || (b.enum && b.enum.length === 0)) {
      return { type: 'string', enum: [] };
    }

    const existingEnums = new Set<unknown>(a.enum || []);
    if (a.example !== undefined) existingEnums.add(a.example);
    if (b.example !== undefined) existingEnums.add(b.example);
    if (b.enum) b.enum.forEach(v => existingEnums.add(v));

    if (existingEnums.size > 20) {
      return { type: 'string', enum: [] };
    }
    if (existingEnums.size >= 2) {
      return { type: 'string', enum: [...existingEnums] };
    }
  }

  const example = b.example !== undefined ? b.example : a.example;
  return { type: a.type, ...(example !== undefined ? { example } : {}) };
}

function deduplicateSchemas(schemas: SchemaObject[]): SchemaObject[] {
  const seen = new Set<string>();
  const result: SchemaObject[] = [];
  for (const s of schemas) {
    const key = JSON.stringify(s);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(s);
    }
  }
  return result;
}
