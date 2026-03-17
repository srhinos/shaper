import type { InferredProtoSchema } from '../types';

interface ProtoExportEntry {
  schema: InferredProtoSchema;
  source: string;
  sampleCount: number;
}

export function toProtoFile(entries: ProtoExportEntry[]): string {
  const lines: string[] = ['syntax = "proto3";', ''];
  const emitted = new Set<string>();

  for (const entry of entries) {
    lines.push(`// Inferred from: ${entry.source}`);
    lines.push(`// Samples: ${entry.sampleCount}`);
    emitMessage(entry.schema, lines, emitted);
    lines.push('');
  }

  return lines.join('\n');
}

function emitMessage(schema: InferredProtoSchema, lines: string[], emitted: Set<string>): void {
  if (emitted.has(schema.messageName)) return;
  emitted.add(schema.messageName);

  for (const field of schema.fields) {
    if (field.nested) emitMessage(field.nested, lines, emitted);
  }

  lines.push(`message ${schema.messageName} {`);
  for (const field of schema.fields) {
    const prefix = field.repeated ? 'repeated ' : field.optional ? 'optional ' : '';
    const typeName = field.nested ? field.nested.messageName : mapProtoType(field.inferredType);
    let line = `  ${prefix}${typeName} field_${field.number} = ${field.number};`;
    if (field.exampleValue !== undefined && !field.nested) {
      const ex = typeof field.exampleValue === 'string'
        ? `"${field.exampleValue}"`
        : String(field.exampleValue);
      line += ` // e.g. ${ex}`;
    }
    lines.push(line);
  }
  lines.push('}');
}

function mapProtoType(inferredType: string): string {
  switch (inferredType) {
    case 'int32': case 'int64': case 'bool': case 'string':
    case 'bytes': case 'float': case 'double': case 'fixed32': case 'fixed64':
      return inferredType;
    default: return 'bytes';
  }
}
