import { describe, it, expect } from 'vitest';
import { mergeSchemas } from './merge';
import type { SchemaObject } from '../types';

describe('mergeSchemas', () => {
  it('merges identical schemas', () => {
    const a: SchemaObject = { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] };
    const result = mergeSchemas(a, a);
    expect(result.properties?.x?.type).toBe('string');
    expect(result.required).toContain('x');
  });

  it('marks fields optional when absent in one schema', () => {
    const a: SchemaObject = { type: 'object', properties: { x: { type: 'string' }, y: { type: 'integer' } }, required: ['x', 'y'] };
    const b: SchemaObject = { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] };
    const result = mergeSchemas(a, b);
    expect(result.required).toEqual(['x']);
    expect(result.properties?.y?.nullable).toBe(true);
  });

  it('creates oneOf for conflicting types', () => {
    const a: SchemaObject = { type: 'object', properties: { v: { type: 'string' } }, required: ['v'] };
    const b: SchemaObject = { type: 'object', properties: { v: { type: 'integer' } }, required: ['v'] };
    const result = mergeSchemas(a, b);
    expect(result.properties?.v?.oneOf).toBeDefined();
  });

  it('detects enums from small value sets', () => {
    const a: SchemaObject = { type: 'string', example: 'active' };
    const b: SchemaObject = { type: 'string', example: 'inactive' };
    const result = mergeSchemas(a, b);
    expect(result.enum).toContain('active');
    expect(result.enum).toContain('inactive');
  });

  it('merges array items', () => {
    const a: SchemaObject = { type: 'array', items: { type: 'string' } };
    const b: SchemaObject = { type: 'array', items: { type: 'string' } };
    const result = mergeSchemas(a, b);
    expect(result.type).toBe('array');
    expect(result.items?.type).toBe('string');
  });

  it('returns first schema when merging with null', () => {
    const a: SchemaObject = { type: 'string' };
    expect(mergeSchemas(a, undefined as unknown as SchemaObject)).toEqual(a);
  });

  it('merges nested objects with differing sub-keys', () => {
    const a: SchemaObject = { type: 'object', properties: {
      user: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    }, required: ['user'] };
    const b: SchemaObject = { type: 'object', properties: {
      user: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' } }, required: ['name', 'email'] },
    }, required: ['user'] };
    const result = mergeSchemas(a, b);
    expect(result.properties?.user?.properties?.name).toBeDefined();
    expect(result.properties?.user?.properties?.email?.nullable).toBe(true);
  });

  it('does not produce enum with more than 20 values', () => {
    let schema: SchemaObject = { type: 'string', example: 'v0' };
    for (let i = 1; i <= 25; i++) {
      schema = mergeSchemas(schema, { type: 'string', example: `v${i}` });
    }
    expect(!schema.enum || schema.enum.length === 0).toBe(true);
  });

  it('oneOf does not set type at top level', () => {
    const a: SchemaObject = { type: 'object', properties: { v: { type: 'string' } }, required: ['v'] };
    const b: SchemaObject = { type: 'object', properties: { v: { type: 'integer' } }, required: ['v'] };
    const result = mergeSchemas(a, b);
    const field = result.properties?.v;
    expect(field?.oneOf).toBeDefined();
    expect(field?.type).toBeUndefined();
  });
});
