import { describe, it, expect } from 'vitest';
import { toProtoFile } from './proto-file';
import type { InferredProtoSchema } from '../types';

describe('toProtoFile', () => {
  it('generates valid proto3 syntax', () => {
    const schema: InferredProtoSchema = {
      messageName: 'GetUserResponse',
      fields: [
        { number: 1, wireType: 2, inferredType: 'string', repeated: false, optional: false },
        { number: 2, wireType: 0, inferredType: 'int32', repeated: false, optional: false },
      ],
    };
    const result = toProtoFile([{ schema, source: 'POST /api.Service/GetUser', sampleCount: 5 }]);
    expect(result).toContain('syntax = "proto3"');
    expect(result).toContain('message GetUserResponse');
    expect(result).toContain('string field_1 = 1');
    expect(result).toContain('int32 field_2 = 2');
  });

  it('handles optional and repeated fields', () => {
    const schema: InferredProtoSchema = {
      messageName: 'Test',
      fields: [
        { number: 1, wireType: 2, inferredType: 'string', repeated: true, optional: false },
        { number: 2, wireType: 0, inferredType: 'int32', repeated: false, optional: true },
      ],
    };
    const result = toProtoFile([{ schema, source: 'test', sampleCount: 1 }]);
    expect(result).toContain('repeated string field_1 = 1');
    expect(result).toContain('optional int32 field_2 = 2');
  });
});
