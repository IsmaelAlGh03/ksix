import { useEffect, useRef, useState } from 'react';
import { DeviceSelect } from './DeviceSelect';
import { DeviceIcon } from './icons';
import { ParticipantTile } from './ParticipantTile';
import { RoomCount } from './RoomCount';
import { openMedia, type MediaMode } from '../webrtc/media';
import { useServerStatus } from '../webrtc/useServerStatus';
import type { JoinDetails } from '../webrtc/session';

interface PreJoinProps {
  roomId: string;
  count: number | null;
  capacity: number;
  onJoin: (details: JoinDetails) => void;
}

const TOGGLE_BASE =
  'flex items-center gap-2 border-[1.5px] border-ink px-4 py-2.5 text-sm font-medium transition-colors duration-150';

const MISSING: Record<MediaMode, string> = {
  full: '',
  'audio-only': ' without a camera',
  'view-only': ' without camera or mic',
};

function toggleClass(on: boolean): string {
  return on
    ? `${TOGGLE_BASE} bg-transparent hover:bg-ink/10`
    : `${TOGGLE_BASE} bg-ink text-substrate hover:bg-ink/90`;
}

export function PreJoin({ roomId, count, capacity, onJoin }: PreJoinProps): JSX.Element {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mode, setMode] = useState<MediaMode>('full');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState('');
  const [microphoneId, setMicrophoneId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(true);
  const [attempt, setAttempt] = useState(0);

  const held = useRef<MediaStream | null>(null);
  const handedOver = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);

    async function acquire(): Promise<void> {
      const opened = await openMedia(
        (constraints) => navigator.mediaDevices.getUserMedia(constraints),
        {
          video: cameraId === '' ? true : { deviceId: { exact: cameraId } },
          audio: microphoneId === '' ? true : { deviceId: { exact: microphoneId } },
        },
      );

      if (cancelled) {
        opened.stream?.getTracks().forEach((track) => track.stop());
        return;
      }

      held.current?.getTracks().forEach((track) => track.stop());
      held.current = opened.stream;
      setStream(opened.stream);
      setMode(opened.mode);
      setMediaError(opened.error);

      const devices: MediaDevices | undefined = navigator.mediaDevices;
      const found =
        devices === undefined ? [] : await devices.enumerateDevices().catch(() => []);
      if (cancelled) return;
      setCameras(found.filter((device) => device.kind === 'videoinput'));
      setMicrophones(found.filter((device) => device.kind === 'audioinput'));
      setReady(true);
      setBusy(false);
    }

    void acquire();
    return () => {
      cancelled = true;
    };
  }, [cameraId, microphoneId, attempt]);

  useEffect(
    () => () => {
      if (!handedOver.current) held.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  useEffect(() => {
    stream?.getAudioTracks().forEach((track) => (track.enabled = micOn));
    stream?.getVideoTracks().forEach((track) => (track.enabled = cameraOn));
  }, [stream, micOn, cameraOn]);

  const server = useServerStatus();
  const named = displayName.trim() !== '';
  const full = count !== null && count >= capacity;

  return (
    <div className="grid flex-1 content-center gap-8 py-8 md:grid-cols-[1.15fr_1fr] md:items-start">
      <div>
        <ParticipantTile
          displayName={named ? displayName.trim() : 'You'}
          stream={stream}
          state="connected"
          isLocal
          micOn={micOn}
          cameraOn={cameraOn}
        />
        {mediaError !== null && (
          <div
            role="alert"
            className="mt-3 flex max-w-[46ch] flex-col items-start gap-3 border-[1.5px] border-alert p-3.5"
          >
            <p className="text-[13px] leading-relaxed text-alert">{mediaError}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => setAttempt((n) => n + 1)}
              className="border-[1.5px] border-alert px-4 py-2 text-sm font-medium text-alert transition-colors duration-150 hover:bg-alert/10 disabled:opacity-40"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <RoomCount count={count} capacity={capacity} />

        <div>
          <label
            htmlFor="display-name"
            className="mb-1.5 block font-mono text-[10px] tracking-[0.08em] uppercase opacity-60"
          >
            Your name
          </label>
          <input
            id="display-name"
            name="displayName"
            value={displayName}
            maxLength={24}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setDisplayName(event.target.value)}
            className="w-full border-[1.5px] border-ink bg-transparent px-3 py-2.5 text-sm"
          />
        </div>

        <DeviceSelect
          id="camera-device"
          label="Camera"
          devices={cameras}
          value={cameraId === '' ? (cameras[0]?.deviceId ?? '') : cameraId}
          onChange={setCameraId}
        />
        <DeviceSelect
          id="microphone-device"
          label="Microphone"
          devices={microphones}
          value={microphoneId === '' ? (microphones[0]?.deviceId ?? '') : microphoneId}
          onChange={setMicrophoneId}
        />

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            aria-pressed={micOn}
            onClick={() => setMicOn((on) => !on)}
            className={toggleClass(micOn)}
          >
            <DeviceIcon device="mic" on={micOn} />
            Mic {micOn ? 'on' : 'off'}
          </button>
          <button
            type="button"
            aria-pressed={cameraOn}
            onClick={() => setCameraOn((on) => !on)}
            className={toggleClass(cameraOn)}
          >
            <DeviceIcon device="camera" on={cameraOn} />
            Camera {cameraOn ? 'on' : 'off'}
          </button>
        </div>

        {server.waking && !server.connected && (
          <p className="font-mono text-[10px] tracking-[0.08em] uppercase opacity-70">
            Waking the server up — this can take up to a minute
          </p>
        )}

        <button
          type="button"
          disabled={!ready || busy || !named || full || !server.connected}
          onClick={() => {
            handedOver.current = stream !== null;
            onJoin({
              displayName: displayName.trim(),
              stream: stream ?? undefined,
              mode,
              error: mediaError,
              micOn,
              cameraOn,
            });
          }}
          className="bg-ink px-6 py-3.5 text-sm font-bold text-substrate transition-colors duration-150 hover:bg-ink/90 disabled:bg-transparent disabled:text-ink disabled:opacity-35 disabled:outline disabled:outline-[1.5px] disabled:outline-ink"
        >
          {full ? 'Join the room' : `Join ${roomId}${MISSING[mode]}`}
        </button>
      </div>
    </div>
  );
}
