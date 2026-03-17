import type { DecodedProtoMessage, ProtoField } from '../types';

const MAX_VARINT_LEN = 10;
const MAX_DEPTH = 10;

function decodeProtobufTracked(buf: Uint8Array, depth: number): { message: DecodedProtoMessage; bytesConsumed: number } {
  const { fields, pos } = decodeFields(buf, depth);
  return { message: { fields }, bytesConsumed: pos };
}

export function decodeProtobuf(buf: Uint8Array, depth = 0): DecodedProtoMessage {
  const { fields } = decodeFields(buf, depth);
  return { fields };
}

function decodeFields(buf: Uint8Array, depth: number): { fields: ProtoField[]; pos: number } {
  const fields: ProtoField[] = [];
  if (depth > MAX_DEPTH) return { fields, pos: buf.length };

  let pos = 0;
  while (pos < buf.length) {
    const tagResult = readVarint(buf, pos);
    if (!tagResult) break;
    pos = tagResult.pos;
    const fieldNumber = tagResult.value >>> 3;
    const wireType = tagResult.value & 0x7;
    if (fieldNumber === 0) break;

    switch (wireType) {
      case 0: {
        const val = readVarint(buf, pos);
        if (!val) return { fields, pos };
        pos = val.pos;
        const isBool = val.value <= 1;
        fields.push({
          number: fieldNumber, wireType, repeated: false, optional: false,
          inferredType: isBool ? 'bool' : val.value <= 0x7fffffff ? 'int32' : 'int64',
          exampleValue: isBool ? Boolean(val.value) : val.value,
        });
        break;
      }
      case 1: {
        if (pos + 8 > buf.length) return { fields, pos };
        const dv = new DataView(buf.buffer, buf.byteOffset + pos, 8);
        const doubleVal = dv.getFloat64(0, true);
        pos += 8;
        fields.push({ number: fieldNumber, wireType, inferredType: 'double', repeated: false, optional: false, exampleValue: doubleVal });
        break;
      }
      case 2: {
        const lenResult = readVarint(buf, pos);
        if (!lenResult) return { fields, pos };
        pos = lenResult.pos;
        const len = lenResult.value;
        if (pos + len > buf.length) return { fields, pos };
        const data = buf.slice(pos, pos + len);
        pos += len;
        const field = decodeLengthDelimited(data, fieldNumber, depth);
        fields.push(field);
        break;
      }
      case 5: {
        if (pos + 4 > buf.length) return { fields, pos };
        const fv = new DataView(buf.buffer, buf.byteOffset + pos, 4);
        const floatVal = fv.getFloat32(0, true);
        pos += 4;
        fields.push({ number: fieldNumber, wireType, inferredType: 'float', repeated: false, optional: false, exampleValue: floatVal });
        break;
      }
      default:
        return { fields, pos };
    }
  }
  return { fields, pos };
}

function decodeLengthDelimited(data: Uint8Array, fieldNumber: number, depth: number): ProtoField {
  if (depth < MAX_DEPTH && data.length > 0) {
    const nested = tryDecodeAsMessage(data, depth + 1);
    if (nested && nested.fields.length > 0) {
      return {
        number: fieldNumber, wireType: 2, inferredType: 'message',
        repeated: false, optional: false,
        nested: { messageName: `Message_${fieldNumber}`, fields: nested.fields },
      };
    }
  }

  if (isValidUtf8String(data)) {
    const str = new TextDecoder().decode(data);
    const example = str.length > 60 ? str.slice(0, 60) + '...' : str;
    return { number: fieldNumber, wireType: 2, inferredType: 'string', repeated: false, optional: false, exampleValue: example };
  }

  return { number: fieldNumber, wireType: 2, inferredType: 'bytes', repeated: false, optional: false };
}

function tryDecodeAsMessage(data: Uint8Array, depth: number): DecodedProtoMessage | null {
  try {
    const { message, bytesConsumed } = decodeProtobufTracked(data, depth);
    if (message.fields.length >= 1 && bytesConsumed === data.length) return message;
  } catch {
    // not a valid message
  }
  return null;
}

function isValidUtf8String(data: Uint8Array): boolean {
  try {
    const str = new TextDecoder('utf-8', { fatal: true }).decode(data);
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      if (c === 0) return false;
      if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) return false;
    }
    return str.length > 0;
  } catch {
    return false;
  }
}

function readVarint(buf: Uint8Array, pos: number): { value: number; pos: number } | null {
  let value = 0;
  let shift = 0;
  for (let i = 0; i < MAX_VARINT_LEN; i++) {
    if (pos >= buf.length) return null;
    const byte = buf[pos++];
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value: value >>> 0, pos };
    shift += 7;
  }
  return null;
}
