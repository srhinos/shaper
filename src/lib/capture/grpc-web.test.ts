import { describe, it, expect } from 'vitest';
import { unwrapGrpcWeb } from './grpc-web';

function buildGrpcFrame(flags: number, payload: Uint8Array): Uint8Array {
  const frame = new Uint8Array(5 + payload.length);
  frame[0] = flags;
  new DataView(frame.buffer).setUint32(1, payload.length, false);
  frame.set(payload, 5);
  return frame;
}

describe('unwrapGrpcWeb', () => {
  it('extracts data frame payload', () => {
    const payload = new Uint8Array([1, 2, 3]);
    const frame = buildGrpcFrame(0x00, payload);
    const result = unwrapGrpcWeb(frame);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(payload);
  });

  it('skips trailer frames', () => {
    const data = buildGrpcFrame(0x00, new Uint8Array([1]));
    const trailer = buildGrpcFrame(0x80, new TextEncoder().encode('grpc-status:0'));
    const combined = new Uint8Array(data.length + trailer.length);
    combined.set(data, 0);
    combined.set(trailer, data.length);
    const result = unwrapGrpcWeb(combined);
    expect(result).toHaveLength(1);
  });

  it('handles empty input', () => {
    expect(unwrapGrpcWeb(new Uint8Array(0))).toHaveLength(0);
  });

  it('handles truncated frame gracefully', () => {
    expect(unwrapGrpcWeb(new Uint8Array([0x00, 0x00]))).toHaveLength(0);
  });
});
