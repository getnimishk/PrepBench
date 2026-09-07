// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ExamTimer } from './ExamTimer';

/** A minimal WebAudio stand-in: jsdom has none. */
function installFakeAudio() {
  const started: number[] = [];
  class FakeOscillator {
    type = 'sine';
    frequency = { value: 0 };
    connect() { return { connect() {} }; }
    start() { started.push(this.frequency.value); }
    stop() {}
  }
  class FakeAudioContext {
    currentTime = 0;
    destination = {};
    createOscillator() { return new FakeOscillator(); }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() { return { connect() {} }; },
      };
    }
    close() { return Promise.resolve(); }
  }
  (window as any).AudioContext = FakeAudioContext as any;
  return started;
}

/** A start time that leaves `remaining` seconds against a 60-minute paper. */
const startedSoThat = (remaining: number) =>
  new Date(Date.now() - (3600 - remaining) * 1000).toISOString();

describe('ExamTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as any).AudioContext;
  });

  it('says the paper is untimed rather than showing a zero', () => {
    render(<ExamTimer startTime={new Date().toISOString()} />);
    expect(screen.getByText('Unlimited Time')).toBeInTheDocument();
  });

  /**
   * Settings has carried a "Timer sound alert (under 5 min)" switch since
   * before anything could read it: the control's only effect was to be saved.
   * Six other settings were removed for exactly that. This one was kept
   * because the job is real -- in a 60-minute paper people tunnel on the
   * question and stop seeing the clock -- so it had to start working.
   */
  it('sounds the five-minute alert when the setting is on', () => {
    const started = installFakeAudio();
    render(
      <ExamTimer
        startTime={startedSoThat(302)}
        timeAllowedSeconds={3600}
        soundEnabled
      />
    );

    expect(started).toHaveLength(0);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(started).toEqual([880, 660]);
  });

  it('stays silent when the setting is off', () => {
    const started = installFakeAudio();
    render(
      <ExamTimer startTime={startedSoThat(302)} timeAllowedSeconds={3600} soundEnabled={false} />
    );

    act(() => { vi.advanceTimersByTime(3000); });
    expect(started).toHaveLength(0);
  });

  it('sounds once, not every second of the last five minutes', () => {
    const started = installFakeAudio();
    render(<ExamTimer startTime={startedSoThat(302)} timeAllowedSeconds={3600} soundEnabled />);

    act(() => { vi.advanceTimersByTime(30000); });
    expect(started).toEqual([880, 660]);
  });

  // Reopening a paper with four minutes left should not announce a warning
  // that has already passed.
  it('does not sound an alert about a window it was already inside', () => {
    const started = installFakeAudio();
    render(<ExamTimer startTime={startedSoThat(240)} timeAllowedSeconds={3600} soundEnabled />);

    act(() => { vi.advanceTimersByTime(5000); });
    expect(started).toHaveLength(0);
  });

  it('reports time up once, however long the tab stays open', () => {
    const onTimeUp = vi.fn();
    render(
      <ExamTimer startTime={startedSoThat(1)} timeAllowedSeconds={3600} onTimeUp={onTimeUp} />
    );

    act(() => { vi.advanceTimersByTime(10000); });
    expect(onTimeUp).toHaveBeenCalledTimes(1);
  });
});
