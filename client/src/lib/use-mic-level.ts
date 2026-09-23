import { useEffect, useRef, useState } from 'react';
import { watchMicLevel } from './mic-level';

export interface MicLevel {
  level: number;
  quiet: boolean;
  heard: boolean;
}

type Watch = typeof watchMicLevel;

export const SPEAK_HINT = 'Say something and the line should move';

const SOUND_AT = 0.3;
const QUIET_AFTER_MS = 1500;

export function useMicLevel(
  stream: MediaStream | null,
  micOn: boolean,
  watch: Watch = watchMicLevel,
): MicLevel {
  const [level, setLevel] = useState(0);
  const [quiet, setQuiet] = useState(false);
  const [heard, setHeard] = useState(false);
  const silence = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHeard(false);
  }, [stream]);

  useEffect(() => {
    if (stream === null || !micOn) {
      setLevel(0);
      setQuiet(false);
      return;
    }

    function armed(): void {
      if (silence.current !== null) clearTimeout(silence.current);
      silence.current = setTimeout(() => setQuiet(true), QUIET_AFTER_MS);
    }

    armed();
    const stop = watch(stream, (next) => {
      setLevel(next);
      if (next < SOUND_AT) return;
      setQuiet(false);
      setHeard(true);
      armed();
    });

    return () => {
      stop();
      if (silence.current !== null) clearTimeout(silence.current);
      silence.current = null;
    };
  }, [stream, micOn, watch]);

  return { level, quiet, heard };
}
