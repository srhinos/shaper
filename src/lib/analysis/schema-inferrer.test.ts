import { describe, it, expect } from 'vitest';
import { inferSchema } from './schema-inferrer';

describe('inferSchema', () => {
  it('infers null', () => {
    expect(inferSchema(null)).toEqual({ type: 'null' });
  });

  it('infers boolean', () => {
    expect(inferSchema(true)).toEqual({ type: 'boolean', example: true });
  });

  it('infers integer', () => {
    expect(inferSchema(42)).toEqual({ type: 'integer', example: 42 });
  });

  it('infers number (float)', () => {
    expect(inferSchema(3.14)).toEqual({ type: 'number', example: 3.14 });
  });

  it('infers string', () => {
    expect(inferSchema('hello')).toEqual({ type: 'string', example: 'hello' });
  });

  it('infers empty array', () => {
    expect(inferSchema([])).toEqual({ type: 'array', items: { type: 'null' } });
  });

  it('infers array of strings', () => {
    expect(inferSchema(['a', 'b'])).toEqual({
      type: 'array',
      items: { type: 'string', example: 'a' },
    });
  });

  it('infers object with required fields', () => {
    const result = inferSchema({ name: 'Alice', age: 30 });
    expect(result.type).toBe('object');
    expect(result.properties?.name).toEqual({ type: 'string', example: 'Alice' });
    expect(result.properties?.age).toEqual({ type: 'integer', example: 30 });
    expect(result.required).toEqual(['name', 'age']);
  });

  it('infers nested object', () => {
    const result = inferSchema({ user: { id: 1 } });
    expect(result.properties?.user?.type).toBe('object');
    expect(result.properties?.user?.properties?.id).toEqual({ type: 'integer', example: 1 });
  });

  it('infers array with mixed types uses oneOf', () => {
    const result = inferSchema([1, 'a']);
    expect(result.type).toBe('array');
    expect(result.items?.oneOf).toBeDefined();
  });
});
