import { describe, it, expect } from 'vitest';
import { inferProtoSchema, mergeProtoSchemas } from './proto-inferrer';
import type { DecodedProtoMessage } from '../types';

describe('inferProtoSchema', () => {
  it('infers schema from single message', () => {
    const msg: DecodedProtoMessage = {
      fields: [
        { number: 1, wireType: 2, inferredType: 'string', repeated: false, optional: false },
        { number: 2, wireType: 0, inferredType: 'int32', repeated: false, optional: false },
      ],
    };
    const schema = inferProtoSchema('TestMessage', [msg]);
    expect(schema.messageName).toBe('TestMessage');
    expect(schema.fields).toHaveLength(2);
    expect(schema.fields[0].number).toBe(1);
  });

  it('marks fields optional when absent in some samples', () => {
    const msg1: DecodedProtoMessage = {
      fields: [
        { number: 1, wireType: 2, inferredType: 'string', repeated: false, optional: false },
        { number: 2, wireType: 0, inferredType: 'int32', repeated: false, optional: false },
      ],
    };
    const msg2: DecodedProtoMessage = {
      fields: [
        { number: 1, wireType: 2, inferredType: 'string', repeated: false, optional: false },
      ],
    };
    const schema = inferProtoSchema('Test', [msg1, msg2]);
    const field2 = schema.fields.find(f => f.number === 2);
    expect(field2?.optional).toBe(true);
  });

  it('detects repeated fields', () => {
    const msg: DecodedProtoMessage = {
      fields: [
        { number: 1, wireType: 2, inferredType: 'string', repeated: false, optional: false },
        { number: 1, wireType: 2, inferredType: 'string', repeated: false, optional: false },
      ],
    };
    const schema = inferProtoSchema('Test', [msg]);
    expect(schema.fields.find(f => f.number === 1)?.repeated).toBe(true);
  });
});

describe('mergeProtoSchemas', () => {
  it('merges two schemas, converging types', () => {
    const a = { messageName: 'M', fields: [
      { number: 1, wireType: 2, inferredType: 'message', repeated: false, optional: false },
    ]};
    const b = { messageName: 'M', fields: [
      { number: 1, wireType: 2, inferredType: 'string', repeated: false, optional: false },
    ]};
    const result = mergeProtoSchemas(a, b);
    expect(result.fields).toHaveLength(1);
  });
});
