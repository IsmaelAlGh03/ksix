import type { Server as IOServer } from 'socket.io';
import { createRoomStore, MAX_ROOM_SIZE, type RoomStore } from '../rooms';
import {
  createConnectionCounter,
  createTokenBucket,
  MAX_WATCH_CHANNELS,
  type ConnectionCounter,
} from './limits';

interface JoinRoomPayload {
  roomId?: unknown;
  displayName?: unknown;
}

interface SignalPayload {
  to?: unknown;
  data?: unknown;
}

interface WatchRoomPayload {
  roomId?: unknown;
}

const ROOM_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_ROOM_ID_LENGTH = 64;

const watchChannel = (roomId: string): string => `watch:${roomId}`;

function isRoomId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_ROOM_ID_LENGTH && ROOM_ID_PATTERN.test(value);
}

export function registerSignaling(
  io: IOServer,
  store: RoomStore = createRoomStore(),
  connections: ConnectionCounter = createConnectionCounter(),
): RoomStore {
  function publishCount(roomId: string): void {
    io.to(watchChannel(roomId)).emit('room-count', {
      count: store.size(roomId),
      capacity: MAX_ROOM_SIZE,
    });
  }

  io.use((socket, next) => {
    const ip = socket.handshake.address;
    if (!connections.admit(ip)) {
      next(new Error('too many connections'));
      return;
    }
    socket.once('disconnect', () => connections.release(ip));
    next();
  });

  io.on('connection', (socket) => {
    const bucket = createTokenBucket();
    const watching = new Set<string>();

    socket.on('watch-room', ({ roomId }: WatchRoomPayload = {}) => {
      if (!isRoomId(roomId) || !bucket.take()) return;
      if (!watching.has(roomId) && watching.size >= MAX_WATCH_CHANNELS) return;

      watching.add(roomId);
      void socket.join(watchChannel(roomId));
      socket.emit('room-count', { count: store.size(roomId), capacity: MAX_ROOM_SIZE });
    });

    socket.on('unwatch-room', ({ roomId }: WatchRoomPayload = {}) => {
      if (!isRoomId(roomId)) return;
      watching.delete(roomId);
      void socket.leave(watchChannel(roomId));
    });

    socket.on('join-room', ({ roomId, displayName }: JoinRoomPayload = {}) => {
      if (!isRoomId(roomId) || !bucket.take()) return;

      const previousRoomId = store.roomOf(socket.id);
      const result = store.join(roomId, socket.id, typeof displayName === 'string' ? displayName : '');

      if (!result.ok) {
        socket.emit('room-full');
        return;
      }

      if (previousRoomId !== undefined && previousRoomId !== roomId) {
        void socket.leave(previousRoomId);
        io.to(previousRoomId).emit('peer-left', { socketId: socket.id });
        publishCount(previousRoomId);
      }

      watching.delete(roomId);
      void socket.leave(watchChannel(roomId));
      socket.join(roomId);
      socket.emit('existing-peers', result.peers);
      socket.to(roomId).emit('peer-joined', result.participant);
      publishCount(roomId);
    });

    socket.on('signal', ({ to, data }: SignalPayload = {}) => {
      if (typeof to !== 'string' || !bucket.take()) return;

      const room = store.roomOf(socket.id);
      if (room === undefined || store.roomOf(to) !== room) return;

      io.to(to).emit('signal', { from: socket.id, data });
    });

    socket.on('disconnect', () => {
      const departure = store.leave(socket.id);
      if (departure === null) return;
      io.to(departure.roomId).emit('peer-left', { socketId: socket.id });
      publishCount(departure.roomId);
    });
  });

  return store;
}
