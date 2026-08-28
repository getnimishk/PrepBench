// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioRecorder } from './useAudioRecorder';

/**
 * Regression test for a real bug: stop() used to call
 * streamRef.current.getTracks().forEach(t => t.stop()) synchronously,
 * immediately alongside mediaRecorder.stop() -- killing the mic track before
 * MediaRecorder finished flushing its encoder buffer, which can silently
 * truncate the recorded audio in real browsers (reported symptom: recordings
 * "lagging and not capturing the entire" answer).
 *
 * This fake MediaRecorder fires ondataavailable/onstop synchronously, so it
 * can't reproduce the real async race itself -- but it CAN enforce the fix's
 * actual invariant: the track must never be stopped before onstop fires.
 */
class OrderTrackingMediaRecorder {
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: { track: { stop: () => void; stopped: boolean } }, public options: any) {}
  start(_timeslice?: number) {}
  stop() {
    // Real MediaRecorder.stop() is asynchronous -- the encoder flush happens
    // off-thread and dataavailable/stop fire later, not in the same tick.
    // A synchronous fake can't model the actual race (whatever runs
    // immediately after calling .stop() always "wins" against a same-tick
    // callback), so this defers via a real microtask/macrotask boundary,
    // the same way a synchronous bug (stopping the track right after
    // calling .stop(), instead of inside onstop) would actually manifest.
    setTimeout(() => {
      this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
      this.onstop?.();
    }, 0);
  }
}

describe('useAudioRecorder', () => {
  let track: { stop: () => void; stopped: boolean };

  beforeEach(() => {
    track = { stopped: false, stop: vi.fn(function (this: any) { track.stopped = true; }) };
    (globalThis as any).MediaRecorder = OrderTrackingMediaRecorder;
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockImplementation(async () => ({
          track,
          getTracks: () => [track],
        })),
      },
      configurable: true,
    });
  });

  it('does not stop the mic track synchronously in stop() -- only after the recorder actually finishes', async () => {
    const onStopped = vi.fn();
    const { result } = renderHook(() => useAudioRecorder(onStopped));

    await act(async () => {
      await result.current.start();
    });
    expect(track.stopped).toBe(false);

    act(() => {
      result.current.stop();
    });

    // The fake recorder's stop() defers dataavailable/onstop past this tick
    // (modeling the real async flush) -- immediately after calling stop(),
    // before that deferred callback has run, the track must still be alive.
    // The regressed version stopped it right here, which in real browsers
    // can cut the encoder off mid-flush and truncate the recording.
    expect(track.stopped).toBe(false);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(track.stopped).toBe(true);
    expect(onStopped).toHaveBeenCalledWith(expect.any(Blob), expect.any(Number));
  });

  it('starts the recorder with a periodic timeslice instead of buffering everything until stop', async () => {
    const startSpy = vi.spyOn(OrderTrackingMediaRecorder.prototype, 'start');
    const { result } = renderHook(() => useAudioRecorder(vi.fn()));

    await act(async () => {
      await result.current.start();
    });

    expect(startSpy).toHaveBeenCalledWith(expect.any(Number));
    expect(startSpy.mock.calls[0][0]).toBeGreaterThan(0);
  });
});
