export type MediaMode = 'full' | 'audio-only' | 'view-only';

export type MediaPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface MediaWanted {
  video: boolean | MediaTrackConstraints;
  audio: boolean | MediaTrackConstraints;
}

export interface MediaResult {
  stream: MediaStream | null;
  mode: MediaMode;
  error: string | null;
}

type MediaRequest = (constraints: MediaStreamConstraints) => Promise<MediaStream>;

type PermissionReader = () => Promise<MediaPermission>;

const BOTH: MediaWanted = { video: true, audio: true };

export async function readMediaPermission(): Promise<MediaPermission> {
  try {
    const states = await Promise.all(
      ['camera', 'microphone'].map(async (name) => {
        const status = await navigator.permissions.query({ name: name as PermissionName });
        return status.state;
      }),
    );

    if (states.includes('denied')) return 'denied';
    if (states.includes('prompt')) return 'prompt';
    return 'granted';
  } catch {
    return 'unknown';
  }
}

function blockedBySystem(error: unknown): boolean {
  return error instanceof DOMException && error.message.toLowerCase().includes('system');
}

export function describeMediaError(
  error: unknown,
  secureContext: boolean = window.isSecureContext,
  permission: MediaPermission = 'unknown',
): string {
  const name = error instanceof DOMException ? error.name : '';

  if (!secureContext) {
    return 'The camera and microphone need a secure connection. Open this page over HTTPS.';
  }
  if (name === 'NotAllowedError') {
    if (blockedBySystem(error)) {
      return 'Your computer is blocking the browser from using the camera and microphone. Allow the browser in your privacy settings, then try again.';
    }
    if (permission === 'prompt') {
      return 'You have not answered the camera and microphone prompt yet. Try again, then choose Allow.';
    }
    if (permission === 'denied') {
      return 'Your browser is blocking the camera and microphone. Allow them from the lock icon beside the address, then try again.';
    }
    return 'Your browser is blocking the camera and microphone. Allow them in the settings for this site, then try again.';
  }
  if (name === 'NotReadableError') {
    return 'Another app is using your camera. Close it, then try again.';
  }
  if (name === 'NotFoundError') {
    return 'No camera or microphone found. Connect one, then try again.';
  }
  return 'The camera and microphone would not start. Try again, or reload the page.';
}

export async function openMedia(
  request: MediaRequest,
  wanted: MediaWanted = BOTH,
  secureContext: boolean = window.isSecureContext,
  readPermission: PermissionReader = readMediaPermission,
): Promise<MediaResult> {
  try {
    const stream = await request({ video: wanted.video, audio: wanted.audio });
    return { stream, mode: 'full', error: null };
  } catch (error) {
    if (!secureContext) {
      return { stream: null, mode: 'view-only', error: describeMediaError(error, false) };
    }

    const permission = await readPermission();
    const message = describeMediaError(error, true, permission);

    try {
      const stream = await request({ audio: wanted.audio });
      return { stream, mode: 'audio-only', error: message };
    } catch (fallbackError) {
      return {
        stream: null,
        mode: 'view-only',
        error: describeMediaError(fallbackError, true, permission),
      };
    }
  }
}
