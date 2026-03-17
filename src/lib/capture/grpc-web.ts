export function unwrapGrpcWeb(buf: Uint8Array): Uint8Array[] {
  const dataFrames: Uint8Array[] = [];
  let pos = 0;

  while (pos + 5 <= buf.length) {
    const flags = buf[pos];
    const length = new DataView(buf.buffer, buf.byteOffset + pos + 1, 4).getUint32(0, false);
    pos += 5;

    if (pos + length > buf.length) break;

    if ((flags & 0x80) === 0) {
      dataFrames.push(buf.slice(pos, pos + length));
    }
    pos += length;
  }

  return dataFrames;
}
