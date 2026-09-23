export interface MicLevelOptions {
  context?: () => AudioContext;
  every?: (tick: () => void) => () => void;
}

const FLOOR_DB = -60;
const FFT_SIZE = 1024;
const INTERVAL_MS = 33;
const CALM_INTERVAL_MS = 250;

export function levelFromSamples(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  const rms = Math.sqrt(sum / samples.length);
  if (rms === 0) return 0;

  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db - FLOOR_DB) / -FLOOR_DB));
}

function calm(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function schedule(tick: () => void): () => void {
  const timer = setInterval(tick, calm() ? CALM_INTERVAL_MS : INTERVAL_MS);
  return () => clearInterval(timer);
}

export function watchMicLevel(
  stream: MediaStream,
  onLevel: (level: number) => void,
  options: MicLevelOptions = {},
): () => void {
  const { context: openContext = () => new AudioContext(), every = schedule } = options;

  let context: AudioContext;
  try {
    context = openContext();
  } catch {
    return () => {};
  }

  const analyser = context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  context.createMediaStreamSource(stream).connect(analyser);
  if (context.state === 'suspended') void context.resume();

  const buffer = new Float32Array(FFT_SIZE);
  const cancel = every(() => {
    analyser.getFloatTimeDomainData(buffer);
    onLevel(levelFromSamples(buffer));
  });

  return () => {
    cancel();
    void context.close();
  };
}
