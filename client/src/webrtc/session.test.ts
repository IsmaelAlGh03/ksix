import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { createMeshSession } from './session';

type Listener = (...args: never[]) => void;

function createFakeSocket() {
  const listeners = new Map<string, Set<Listener>>();

  const socket = {
    id: 'local-socket',
    connected: false,
    emit: vi.fn(),
    on(event: string, handler: Listener) {
      const existing = listeners.get(event) ?? new Set<Listener>();
      existing.add(handler);
      listeners.set(event, existing);
      return socket;
    },
    off(event: string, handler: Listener) {
      listeners.get(event)?.delete(handler);
      return socket;
    },
    connect() {
      if (socket.connected) return socket;
      socket.connected = true;
      socket.fire('connect');
      return socket;
    },
    disconnect: vi.fn(),
    fire(event: string, ...args: unknown[]) {
      for (const handler of listeners.get(event) ?? []) {
        (handler as (...values: unknown[]) => void)(...args);
      }
    },
  };

  return socket;
}

function createStubDataChannel() {
  const listeners = new Map<string, Set<Listener>>();

  const channel = {
    readyState: 'connecting' as RTCDataChannelState,
    send: vi.fn(),
    close: vi.fn(),
    addEventListener(event: string, handler: Listener) {
      const existing = listeners.get(event) ?? new Set<Listener>();
      existing.add(handler);
      listeners.set(event, existing);
    },
    open() {
      channel.readyState = 'open';
      for (const handler of listeners.get('open') ?? []) {
        (handler as (value: unknown) => void)({});
      }
    },
    receive(message: unknown) {
      for (const handler of listeners.get('message') ?? []) {
        (handler as (value: unknown) => void)({ data: JSON.stringify(message) });
      }
    },
  };

  return channel;
}

function createStubConnection() {
  const channel = createStubDataChannel();

  return {
    connectionState: 'new',
    signalingState: 'stable',
    localDescription: null,
    channel,
    addTrack: vi.fn(),
    addTransceiver: vi.fn(),
    addEventListener: vi.fn(),
    createDataChannel: vi.fn(() => channel),
    setLocalDescription: vi.fn(),
    setRemoteDescription: vi.fn(),
    addIceCandidate: vi.fn(),
    close: vi.fn(),
  };
}

const emptyStream = {
  getTracks: () => [],
  getVideoTracks: () => [],
  getAudioTracks: () => [],
} as unknown as MediaStream;

function trackedStream() {
  const video = { kind: 'video', enabled: true, stop: vi.fn() };
  const audio = { kind: 'audio', enabled: true, stop: vi.fn() };
  const stream = {
    getTracks: () => [video, audio],
    getVideoTracks: () => [video],
    getAudioTracks: () => [audio],
  } as unknown as MediaStream;
  return { stream, video, audio };
}

describe('joining with media already resolved', () => {
  it('uses the stream it was handed instead of asking for another', async () => {
    const getMedia = vi.fn();
    const { stream } = trackedStream();
    const session = createMeshSession({
      roomId: 'alpha',
      getSocket: () => createFakeSocket() as unknown as Socket,
      getMedia,
      createConnection: () => createStubConnection() as unknown as RTCPeerConnection,
    });

    await session.join({ displayName: 'Ada', stream });

    expect(getMedia).not.toHaveBeenCalled();
    expect(session.getState().localStream).toBe(stream);
  });

  it('announces the name it was given at join time', async () => {
    const socket = createFakeSocket();
    const { stream } = trackedStream();
    const session = createMeshSession({
      roomId: 'alpha',
      getSocket: () => socket as unknown as Socket,
      createConnection: () => createStubConnection() as unknown as RTCPeerConnection,
    });

    await session.join({ displayName: 'Ada', stream });

    expect(socket.emit).toHaveBeenCalledWith('join-room', { roomId: 'alpha', displayName: 'Ada' });
  });

  it('enters the room with the pre-toggles the green room was left in', async () => {
    const { stream, video, audio } = trackedStream();
    const session = createMeshSession({
      roomId: 'alpha',
      getSocket: () => createFakeSocket() as unknown as Socket,
      createConnection: () => createStubConnection() as unknown as RTCPeerConnection,
    });

    await session.join({ displayName: 'Ada', stream, micOn: false, cameraOn: true });

    expect(audio.enabled).toBe(false);
    expect(video.enabled).toBe(true);
    expect(session.getState().micOn).toBe(false);
    expect(session.getState().cameraOn).toBe(true);
  });

  it('announces itself on a socket the green room already connected', async () => {
    const socket = createFakeSocket();
    socket.connected = true;
    const { stream } = trackedStream();
    const session = createMeshSession({
      roomId: 'alpha',
      getSocket: () => socket as unknown as Socket,
      createConnection: () => createStubConnection() as unknown as RTCPeerConnection,
    });

    await session.join({ displayName: 'Ada', stream });

    expect(socket.emit).toHaveBeenCalledWith('join-room', { roomId: 'alpha', displayName: 'Ada' });
  });

  it('keeps the mode and the reason the green room resolved', async () => {
    const { stream } = trackedStream();
    const session = createMeshSession({
      roomId: 'alpha',
      getSocket: () => createFakeSocket() as unknown as Socket,
      createConnection: () => createStubConnection() as unknown as RTCPeerConnection,
    });

    await session.join({
      displayName: 'Ada',
      stream,
      mode: 'audio-only',
      error: 'Another app is using your camera. Close it, then try again.',
    });

    expect(session.getState().mediaMode).toBe('audio-only');
    expect(session.getState().mediaError).toBe(
      'Another app is using your camera. Close it, then try again.',
    );
  });

  it('treats a bare stream as full media, as a direct join has no green room to ask', async () => {
    const { stream } = trackedStream();
    const session = createMeshSession({
      roomId: 'alpha',
      getSocket: () => createFakeSocket() as unknown as Socket,
      createConnection: () => createStubConnection() as unknown as RTCPeerConnection,
    });

    await session.join({ displayName: 'Ada', stream });

    expect(session.getState().mediaMode).toBe('full');
    expect(session.getState().mediaError).toBeNull();
  });

  it('still falls back to getMedia when no stream is supplied', async () => {
    const getMedia = vi.fn(async (_constraints: MediaStreamConstraints) => emptyStream);
    const session = createMeshSession({
      roomId: 'alpha',
      getSocket: () => createFakeSocket() as unknown as Socket,
      getMedia,
      createConnection: () => createStubConnection() as unknown as RTCPeerConnection,
    });

    await session.join();

    expect(getMedia).toHaveBeenCalled();
  });
});

describe('createMeshSession', () => {
  it('tears down only the departing peer', async () => {
    const socket = createFakeSocket();
    const connections: ReturnType<typeof createStubConnection>[] = [];

    const session = createMeshSession({
      roomId: 'test-room',
      getSocket: () => socket as unknown as Socket,
      getMedia: async () => emptyStream,
      createConnection: () => {
        const connection = createStubConnection();
        connections.push(connection);
        return connection as unknown as RTCPeerConnection;
      },
    });

    await session.join();
    socket.fire('existing-peers', [
      { socketId: 'peer-1', displayName: 'One' },
      { socketId: 'peer-2', displayName: 'Two' },
      { socketId: 'peer-3', displayName: 'Three' },
    ]);

    socket.fire('peer-left', { socketId: 'peer-2' });

    const [first, second, third] = connections;
    expect(second?.close).toHaveBeenCalledTimes(1);
    expect(first?.close).not.toHaveBeenCalled();
    expect(third?.close).not.toHaveBeenCalled();
    expect(session.getState().participants.map((peer) => peer.socketId)).toEqual([
      'peer-1',
      'peer-3',
    ]);
  });

  it('holds chat until every peer channel opens, and echoes it locally at once', async () => {
    const socket = createFakeSocket();
    const connections: ReturnType<typeof createStubConnection>[] = [];

    const session = createMeshSession({
      roomId: 'test-room',
      getSocket: () => socket as unknown as Socket,
      getMedia: async () => emptyStream,
      createConnection: () => {
        const connection = createStubConnection();
        connections.push(connection);
        return connection as unknown as RTCPeerConnection;
      },
    });

    await session.join({ displayName: 'Ada' });
    socket.fire('existing-peers', [
      { socketId: 'peer-1', displayName: 'One' },
      { socketId: 'peer-2', displayName: 'Two' },
    ]);

    session.sendChat('before the channels are up');

    const [first, second] = connections;
    expect(first?.channel.send).not.toHaveBeenCalled();
    expect(second?.channel.send).not.toHaveBeenCalled();

    const echoed = session.getState().messages;
    expect(echoed).toHaveLength(1);
    expect(echoed[0]?.text).toBe('before the channels are up');
    expect(echoed[0]?.mine).toBe(true);
    expect(echoed[0]?.authorName).toBe('Ada');

    first?.channel.open();

    const queued = first?.channel.send.mock.calls[0]?.[0] as string;
    expect(JSON.parse(queued)).toMatchObject({ type: 'chat', text: 'before the channels are up' });
    expect(second?.channel.send).not.toHaveBeenCalled();
  });
});

function fakeCues() {
  let on = true;
  return {
    play: vi.fn(),
    enabled: () => on,
    setEnabled: vi.fn((next: boolean) => {
      on = next;
    }),
  };
}

async function joinedWithPeers(names: string[]) {
  const socket = createFakeSocket();
  const cues = fakeCues();
  const connections: ReturnType<typeof createStubConnection>[] = [];
  const session = createMeshSession({
    roomId: 'test-room',
    getSocket: () => socket as unknown as Socket,
    getMedia: async () => emptyStream,
    cues,
    createConnection: () => {
      const connection = createStubConnection();
      connections.push(connection);
      return connection as unknown as RTCPeerConnection;
    },
  });

  await session.join({ displayName: 'Ada' });
  socket.fire(
    'existing-peers',
    names.map((displayName, index) => ({ socketId: `peer-${index + 1}`, displayName })),
  );
  for (const connection of connections) connection.channel.open();

  return { session, socket, cues, connections };
}

describe('sound cues', () => {
  it('stays quiet for the peers already in the room', async () => {
    const { cues } = await joinedWithPeers(['One', 'Two']);

    expect(cues.play).not.toHaveBeenCalled();
  });

  it('plays join when someone arrives after you', async () => {
    const { socket, cues } = await joinedWithPeers([]);

    socket.fire('peer-joined', { socketId: 'peer-9', displayName: 'Nine' });

    expect(cues.play).toHaveBeenCalledWith('join');
  });

  it('plays leave when someone goes', async () => {
    const { socket, cues } = await joinedWithPeers(['One']);

    socket.fire('peer-left', { socketId: 'peer-1' });

    expect(cues.play).toHaveBeenCalledWith('leave');
  });

  it('plays message for a peer chat, not for your own', async () => {
    const { session, cues, connections } = await joinedWithPeers(['One']);

    session.sendChat('mine');
    expect(cues.play).not.toHaveBeenCalled();

    connections[0]?.channel.receive({ type: 'chat', id: 'p1-1', text: 'theirs', at: 1 });
    expect(cues.play).toHaveBeenCalledWith('message');
  });

  it('exposes and flips the sounds preference', async () => {
    const { session, cues } = await joinedWithPeers([]);

    expect(session.getState().soundsOn).toBe(true);

    session.toggleSounds();

    expect(cues.setEnabled).toHaveBeenCalledWith(false);
    expect(session.getState().soundsOn).toBe(false);
  });
});

describe('writing', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks a peer as writing when their typing message arrives', async () => {
    const { session, connections } = await joinedWithPeers(['One']);

    connections[0]?.channel.receive({ type: 'typing', active: true });

    expect(session.getState().participants[0]?.writing).toBe(true);
  });

  it('clears writing when the peer says so', async () => {
    const { session, connections } = await joinedWithPeers(['One']);

    connections[0]?.channel.receive({ type: 'typing', active: true });
    connections[0]?.channel.receive({ type: 'typing', active: false });

    expect(session.getState().participants[0]?.writing).toBe(false);
  });

  it('clears writing when their message lands', async () => {
    const { session, connections } = await joinedWithPeers(['One']);

    connections[0]?.channel.receive({ type: 'typing', active: true });
    connections[0]?.channel.receive({ type: 'chat', id: 'p1-1', text: 'done', at: 1 });

    expect(session.getState().participants[0]?.writing).toBe(false);
  });

  it('gives up on a writer who goes silent', async () => {
    vi.useFakeTimers();
    const { session, connections } = await joinedWithPeers(['One']);

    connections[0]?.channel.receive({ type: 'typing', active: true });
    vi.advanceTimersByTime(6_000);

    expect(session.getState().participants[0]?.writing).toBe(false);
  });

  it('broadcasts a change of writing state once', async () => {
    const { session, connections } = await joinedWithPeers(['One']);
    const send = connections[0]?.channel.send;
    send?.mockClear();

    session.setWriting(true);
    session.setWriting(true);
    session.setWriting(false);

    const sent = send?.mock.calls.map(([raw]) => JSON.parse(raw as string));
    expect(sent).toEqual([
      { type: 'typing', active: true },
      { type: 'typing', active: false },
    ]);
  });
});
