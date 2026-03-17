import { describe, it, expect } from 'vitest';
import { decodeProtobuf } from './protobuf-decoder';

function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7f);
  return new Uint8Array(bytes);
}

function buildProtoMessage(fields: Array<{ number: number; wireType: number; data: Uint8Array }>): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const f of fields) {
    const tag = encodeVarint((f.number << 3) | f.wireType);
    parts.push(tag);
    if (f.wireType === 2) {
      parts.push(encodeVarint(f.data.length));
    }
    parts.push(f.data);
  }
  const total = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) { result.set(p, offset); offset += p.length; }
  return result;
}

describe('decodeProtobuf', () => {
  it('decodes varint field (wire type 0)', () => {
    const buf = buildProtoMessage([{ number: 1, wireType: 0, data: encodeVarint(150) }]);
    const result = decodeProtobuf(buf);
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].number).toBe(1);
    expect(result.fields[0].wireType).toBe(0);
  });

  it('decodes string field (wire type 2)', () => {
    const str = new TextEncoder().encode('hello');
    const buf = buildProtoMessage([{ number: 2, wireType: 2, data: str }]);
    const result = decodeProtobuf(buf);
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].inferredType).toBe('string');
  });

  it('decodes 64-bit field (wire type 1)', () => {
    const data = new Uint8Array(8);
    new DataView(data.buffer).setFloat64(0, 3.14, true);
    const buf = buildProtoMessage([{ number: 3, wireType: 1, data }]);
    const result = decodeProtobuf(buf);
    expect(result.fields[0].wireType).toBe(1);
  });

  it('decodes 32-bit field (wire type 5)', () => {
    const data = new Uint8Array(4);
    new DataView(data.buffer).setFloat32(0, 1.5, true);
    const buf = buildProtoMessage([{ number: 4, wireType: 5, data }]);
    const result = decodeProtobuf(buf);
    expect(result.fields[0].wireType).toBe(5);
  });

  it('returns empty for empty buffer', () => {
    const result = decodeProtobuf(new Uint8Array(0));
    expect(result.fields).toHaveLength(0);
  });

  it('handles malformed data without throwing', () => {
    const garbage = new Uint8Array([0xff, 0xff, 0xff]);
    expect(() => decodeProtobuf(garbage)).not.toThrow();
  });

  it('infers bool for varint values 0 and 1', () => {
    const buf = buildProtoMessage([{ number: 1, wireType: 0, data: encodeVarint(1) }]);
    const result = decodeProtobuf(buf);
    expect(result.fields[0].inferredType).toBe('bool');
  });

  it('falls back to bytes for non-UTF-8 binary data', () => {
    const binary = new Uint8Array([0x00, 0x80, 0xfe, 0xff, 0x01, 0x02]);
    const buf = buildProtoMessage([{ number: 5, wireType: 2, data: binary }]);
    const result = decodeProtobuf(buf);
    expect(result.fields[0].inferredType).toBe('bytes');
  });

  it('respects max recursion depth', () => {
    let inner = new TextEncoder().encode('leaf');
    for (let i = 0; i < 15; i++) {
      const tag = encodeVarint((1 << 3) | 2);
      const len = encodeVarint(inner.length);
      const outer = new Uint8Array(tag.length + len.length + inner.length);
      outer.set(tag, 0);
      outer.set(len, tag.length);
      outer.set(inner, tag.length + len.length);
      inner = outer;
    }
    expect(() => decodeProtobuf(inner)).not.toThrow();
  });
});
