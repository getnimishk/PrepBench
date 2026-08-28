// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { useEffect, useRef, useState } from 'react';

/**
 * Encapsulates browser MediaRecorder/getUserMedia mic-capture logic, shared
 * between RecordingsPage (freeform library) and InterviewPracticeRecordPage
 * (round-based practice) so the start/stop/elapsed-timer/permission-error
 * handling lives in one place instead of being duplicated.
 */
export function useAudioRecorder(onStopped: (blob: Blob, elapsedSeconds: number) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = async () => {
    setRecordError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        // Stop the underlying mic track only now, after the recorder has
        // actually finished flushing its encoder buffer -- stopping the
        // track synchronously alongside recorder.stop() (the previous bug
        // here) can cut the encoder off before it finishes writing the
        // final chunk, silently truncating the recording.
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size > 0) onStopped(blob, elapsedRef.current);
      };
      mediaRecorderRef.current = recorder;
      // Request a periodic chunk flush instead of the default (one giant
      // buffer handed over only at stop()) -- keeps memory/serialization
      // work spread out during long recordings instead of all landing in a
      // single lump on stop, and gives ondataavailable a chance to run
      // well before the final flush that onstop depends on.
      recorder.start(1000);
      setIsRecording(true);
      setElapsed(0);
      elapsedRef.current = 0;
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
      }, 1000);
    } catch {
      // getUserMedia failing is a browser permission problem, not a server
      // response, so there is nothing more specific to surface than this.
      setRecordError('Microphone access denied or unavailable. Please allow microphone permission and try again.');
    }
  };

  const stop = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
  };

  return { isRecording, elapsed, recordError, start, stop };
}
