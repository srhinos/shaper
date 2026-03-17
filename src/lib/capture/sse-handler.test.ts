import { describe, it, expect } from 'vitest';
import { SseParser } from './sse-handler';

describe('SseParser', () => {
  it('parses a complete event', () => {
    const parser = new SseParser();
    parser.feed('data: hello world\n\n');
    expect(parser.events).toHaveLength(1);
    expect(parser.events[0].data).toBe('hello world');
    expect(parser.events[0].type).toBe('message');
  });

  it('parses event with type', () => {
    const parser = new SseParser();
    parser.feed('event: update\ndata: {"x":1}\n\n');
    expect(parser.events[0].type).toBe('update');
    expect(parser.events[0].data).toBe('{"x":1}');
  });

  it('parses event with id', () => {
    const parser = new SseParser();
    parser.feed('id: 42\ndata: test\n\n');
    expect(parser.events[0].id).toBe('42');
  });

  it('handles multi-line data', () => {
    const parser = new SseParser();
    parser.feed('data: line1\ndata: line2\n\n');
    expect(parser.events[0].data).toBe('line1\nline2');
  });

  it('handles incremental feeds', () => {
    const parser = new SseParser();
    parser.feed('data: hel');
    expect(parser.events).toHaveLength(0);
    parser.feed('lo\n\n');
    expect(parser.events).toHaveLength(1);
    expect(parser.events[0].data).toBe('hello');
  });

  it('ignores comment lines', () => {
    const parser = new SseParser();
    parser.feed(': this is a comment\ndata: real\n\n');
    expect(parser.events).toHaveLength(1);
    expect(parser.events[0].data).toBe('real');
  });

  it('handles empty data', () => {
    const parser = new SseParser();
    parser.feed('\n\n');
    expect(parser.events).toHaveLength(0);
  });
});
