import type { SseEvent } from '../types';

export class SseParser {
  events: SseEvent[] = [];
  private buffer = '';
  private currentEvent: Partial<SseEvent> = {};
  private dataLines: string[] = [];

  feed(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line === '') {
        this.dispatchEvent();
        continue;
      }
      if (line.startsWith(':')) continue;

      const colonIdx = line.indexOf(':');
      let field: string;
      let value: string;
      if (colonIdx === -1) {
        field = line;
        value = '';
      } else {
        field = line.slice(0, colonIdx);
        value = line.slice(colonIdx + 1);
        if (value.startsWith(' ')) value = value.slice(1);
      }

      switch (field) {
        case 'event':
          this.currentEvent.type = value;
          break;
        case 'data':
          this.dataLines.push(value);
          break;
        case 'id':
          this.currentEvent.id = value;
          break;
        case 'retry':
          break;
      }
    }
  }

  private dispatchEvent(): void {
    if (this.dataLines.length === 0) {
      this.currentEvent = {};
      return;
    }

    this.events.push({
      type: this.currentEvent.type || 'message',
      data: this.dataLines.join('\n'),
      ...(this.currentEvent.id !== undefined ? { id: this.currentEvent.id } : {}),
    });

    this.currentEvent = {};
    this.dataLines = [];
  }
}
