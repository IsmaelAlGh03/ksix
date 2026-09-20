export type Cue = 'join' | 'leave' | 'message';

export interface Cues {
  play(cue: Cue): void;
  enabled(): boolean;
  setEnabled(on: boolean): void;
}

export interface CuesOptions {
  context?: () => AudioContext;
  storage?: Storage;
}

interface Note {
  frequency: number;
  at: number;
  length: number;
}

const KEY = 'ksix:sounds';
const PEAK = 0.08;
const FLOOR = 0.0001;

const PHRASES: Record<Cue, Note[]> = {
  join: [
    { frequency: 523, at: 0, length: 0.12 },
    { frequency: 659, at: 0.07, length: 0.14 },
  ],
  leave: [
    { frequency: 659, at: 0, length: 0.12 },
    { frequency: 523, at: 0.07, length: 0.14 },
  ],
  message: [{ frequency: 880, at: 0, length: 0.05 }],
};

function readStored(storage: Storage | undefined): boolean {
  try {
    return storage?.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

function writeStored(storage: Storage | undefined, on: boolean): void {
  try {
    storage?.setItem(KEY, on ? 'on' : 'off');
  } catch {
    return;
  }
}

export function createCues(options: CuesOptions = {}): Cues {
  const {
    context: openContext = () => new AudioContext(),
    storage = typeof localStorage === 'undefined' ? undefined : localStorage,
  } = options;

  let context: AudioContext | null = null;
  let on = readStored(storage);

  function ensureContext(): AudioContext | null {
    if (context === null) {
      try {
        context = openContext();
      } catch {
        return null;
      }
    }
    if (context.state === 'suspended') void context.resume();
    return context;
  }

  function sound(audio: AudioContext, note: Note): void {
    const start = audio.currentTime + note.at;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(PEAK, start);
    gain.gain.exponentialRampToValueAtTime(FLOOR, start + note.length);
    gain.connect(audio.destination);

    const oscillator = audio.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = note.frequency;
    oscillator.connect(gain);
    oscillator.start(start);
    oscillator.stop(start + note.length);
  }

  return {
    play(cue) {
      if (!on) return;
      const audio = ensureContext();
      if (audio === null) return;
      for (const note of PHRASES[cue]) sound(audio, note);
    },
    enabled: () => on,
    setEnabled(next) {
      on = next;
      writeStored(storage, next);
    },
  };
}
