import type { DecodedProtoMessage, ProtoField, InferredProtoSchema } from '../types';

export function inferProtoSchema(name: string, messages: DecodedProtoMessage[]): InferredProtoSchema {
  const fieldMap = new Map<number, { types: Map<string, number>; count: number; repeated: boolean; wireType: number; nested?: InferredProtoSchema }>();

  for (const msg of messages) {
    const seenInMsg = new Map<number, number>();
    for (const field of msg.fields) {
      seenInMsg.set(field.number, (seenInMsg.get(field.number) || 0) + 1);
    }

    for (const field of msg.fields) {
      let entry = fieldMap.get(field.number);
      if (!entry) {
        entry = { types: new Map(), count: 0, repeated: false, wireType: field.wireType };
        fieldMap.set(field.number, entry);
      }
      entry.types.set(field.inferredType, (entry.types.get(field.inferredType) || 0) + 1);
      if ((seenInMsg.get(field.number) || 0) > 1) entry.repeated = true;
      if (field.nested) entry.nested = field.nested;
    }

    for (const [num, entry] of fieldMap) {
      if (seenInMsg.has(num)) entry.count++;
    }
  }

  const fields: ProtoField[] = [];
  for (const [num, entry] of fieldMap) {
    const bestType = pickBestType(entry.types);
    fields.push({
      number: num,
      wireType: entry.wireType,
      inferredType: bestType,
      repeated: entry.repeated,
      optional: entry.count < messages.length,
      nested: bestType === 'message' ? entry.nested : undefined,
    });
  }

  fields.sort((a, b) => a.number - b.number);
  return { messageName: name, fields };
}

function pickBestType(types: Map<string, number>): string {
  const priority = ['string', 'message', 'bytes'];
  function rank(t: string): number {
    const idx = priority.indexOf(t);
    return idx >= 0 ? idx : priority.length;
  }
  let best = '';
  let bestCount = 0;
  for (const [type, count] of types) {
    if (count > bestCount || (count === bestCount && best !== '' && rank(type) < rank(best))) {
      best = type;
      bestCount = count;
    }
  }
  return best || 'bytes';
}

export function mergeProtoSchemas(a: InferredProtoSchema, b: InferredProtoSchema): InferredProtoSchema {
  const fieldMap = new Map<number, ProtoField>();

  for (const f of a.fields) fieldMap.set(f.number, { ...f });
  for (const f of b.fields) {
    const existing = fieldMap.get(f.number);
    if (!existing) {
      fieldMap.set(f.number, { ...f, optional: true });
    } else {
      if (existing.inferredType !== f.inferredType) {
        const priority = ['string', 'message', 'bytes'];
        if (priority.indexOf(f.inferredType) < priority.indexOf(existing.inferredType)) {
          existing.inferredType = f.inferredType;
        }
      }
      existing.repeated = existing.repeated || f.repeated;
      if (f.nested && existing.nested) {
        existing.nested = mergeProtoSchemas(existing.nested, f.nested);
      }
    }
  }

  for (const f of a.fields) {
    const merged = fieldMap.get(f.number)!;
    if (!b.fields.find(bf => bf.number === f.number)) merged.optional = true;
  }

  const fields = [...fieldMap.values()].sort((a, b) => a.number - b.number);
  return { messageName: a.messageName, fields };
}
