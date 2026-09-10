import type { MeshMessage, PeerStat, SignalData } from '../types';
import type { Bucket } from './quality';

const BUCKETS = new Set<Bucket>(['good', 'fair', 'poor']);
const DESCRIPTION_TYPES = new Set(['offer', 'answer', 'pranswer', 'rollback']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

export function parseSignalData(value: unknown): SignalData | null {
  if (!isRecord(value)) return null;

  if ('description' in value) {
    const { description } = value;
    if (!isRecord(description)) return null;
    if (typeof description.type !== 'string' || !DESCRIPTION_TYPES.has(description.type)) return null;
    if (description.sdp !== undefined && typeof description.sdp !== 'string') return null;
    return {
      description: {
        type: description.type as RTCSdpType,
        sdp: description.sdp as string | undefined,
      },
    };
  }

  if ('candidate' in value) {
    const { candidate } = value;
    if (!isRecord(candidate)) return null;
    if (typeof candidate.candidate !== 'string') return null;
    if (candidate.sdpMid !== undefined && candidate.sdpMid !== null && typeof candidate.sdpMid !== 'string') {
      return null;
    }
    if (
      candidate.sdpMLineIndex !== undefined &&
      candidate.sdpMLineIndex !== null &&
      !isFiniteNumber(candidate.sdpMLineIndex)
    ) {
      return null;
    }
    return {
      candidate: {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid as string | null | undefined,
        sdpMLineIndex: candidate.sdpMLineIndex as number | null | undefined,
        usernameFragment: typeof candidate.usernameFragment === 'string' ? candidate.usernameFragment : undefined,
      },
    };
  }

  return null;
}

function parsePeerStat(value: unknown): PeerStat | null {
  if (!isRecord(value)) return null;
  if (typeof value.peerId !== 'string' || value.peerId === '') return null;
  if (typeof value.bucket !== 'string' || !BUCKETS.has(value.bucket as Bucket)) return null;
  if (!isNullableNumber(value.rtt) || !isNullableNumber(value.loss)) return null;
  if (typeof value.relayed !== 'boolean') return null;

  return {
    peerId: value.peerId,
    bucket: value.bucket as Bucket,
    rtt: value.rtt,
    loss: value.loss,
    relayed: value.relayed,
  };
}

export function parseMeshMessage(value: unknown): MeshMessage | null {
  if (!isRecord(value)) return null;

  switch (value.type) {
    case 'chat':
      if (typeof value.id !== 'string' || typeof value.text !== 'string') return null;
      if (!isFiniteNumber(value.at)) return null;
      return { type: 'chat', id: value.id, text: value.text, at: value.at };

    case 'presence': {
      if (typeof value.micOn !== 'boolean' || typeof value.cameraOn !== 'boolean') return null;
      const { sharing } = value;
      if (sharing !== undefined && sharing !== null && typeof sharing !== 'string') return null;
      return { type: 'presence', micOn: value.micOn, cameraOn: value.cameraOn, sharing };
    }

    case 'stats': {
      if (!isFiniteNumber(value.at) || !Array.isArray(value.links)) return null;
      const links = value.links.map(parsePeerStat);
      if (links.some((link) => link === null)) return null;
      return { type: 'stats', at: value.at, links: links as PeerStat[] };
    }

    case 'file-meta':
      if (typeof value.id !== 'string' || typeof value.name !== 'string') return null;
      if (typeof value.mime !== 'string') return null;
      if (!isFiniteNumber(value.size) || !isFiniteNumber(value.chunks)) return null;
      if (!isFiniteNumber(value.at)) return null;
      return {
        type: 'file-meta',
        id: value.id,
        name: value.name,
        mime: value.mime,
        size: value.size,
        chunks: value.chunks,
        at: value.at,
      };

    case 'file-chunk':
      if (typeof value.id !== 'string' || typeof value.data !== 'string') return null;
      if (!isFiniteNumber(value.index)) return null;
      return { type: 'file-chunk', id: value.id, index: value.index, data: value.data };

    case 'file-end':
      if (typeof value.id !== 'string') return null;
      return { type: 'file-end', id: value.id };

    default:
      return null;
  }
}
