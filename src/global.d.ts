import type { Browser } from 'webextension-polyfill';

declare global {
  const browser: Browser;
  function atob(data: string): string;
  function btoa(data: string): string;
}
