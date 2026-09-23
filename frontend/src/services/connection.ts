// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * Whether the PrepBench server is answering, as the app last found out.
 *
 * Every request reports in (see the interceptors in services/api): a response of
 * any kind means the server is there, and a request that got no response at all
 * means it is not. Screens read this to say plainly that work is not being saved,
 * and to send what they kept locally once the server is back -- rather than each
 * one discovering the outage on its own, one failed save at a time.
 */
export type ConnectionState = 'online' | 'unreachable';

type Listener = (state: ConnectionState) => void;

let state: ConnectionState = 'online';
const listeners = new Set<Listener>();

export const connection = {
  get: (): ConnectionState => state,
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  report(next: ConnectionState): void {
    if (next === state) return;
    state = next;
    listeners.forEach((listener) => listener(state));
  },
};
