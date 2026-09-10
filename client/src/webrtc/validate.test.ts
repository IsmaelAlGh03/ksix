import { describe, expect, it } from 'vitest';
import { parseMeshMessage, parseSignalData } from './validate';

const stat = { peerId: 'socket-a', bucket: 'good', rtt: 42, loss: 0, relayed: false };

describe('parseSignalData', () => {
  it('accepts an offer carrying an sdp string', () => {
    expect(parseSignalData({ description: { type: 'offer', sdp: 'v=0' } })).toEqual({
      description: { type: 'offer', sdp: 'v=0' },
    });
  });

  it('rejects a description that is not an object', () => {
    expect(parseSignalData({ description: null })).toBeNull();
    expect(parseSignalData({ description: 'offer' })).toBeNull();
  });

  it('rejects a description with an unknown type', () => {
    expect(parseSignalData({ description: { type: 'garbage', sdp: 'v=0' } })).toBeNull();
  });

  it('rejects a description whose sdp is not a string', () => {
    expect(parseSignalData({ description: { type: 'offer', sdp: 7 } })).toBeNull();
  });

  it('accepts a well-formed candidate', () => {
    const parsed = parseSignalData({
      candidate: { candidate: 'candidate:1 1 udp', sdpMid: '0', sdpMLineIndex: 0 },
    });

    expect(parsed).toEqual({
      candidate: {
        candidate: 'candidate:1 1 udp',
        sdpMid: '0',
        sdpMLineIndex: 0,
        usernameFragment: undefined,
      },
    });
  });

  it('rejects a candidate with the wrong field types', () => {
    expect(parseSignalData({ candidate: { candidate: 7 } })).toBeNull();
    expect(parseSignalData({ candidate: { candidate: 'x', sdpMLineIndex: 'nope' } })).toBeNull();
  });

  it('rejects anything that is neither a description nor a candidate', () => {
    expect(parseSignalData(null)).toBeNull();
    expect(parseSignalData({})).toBeNull();
    expect(parseSignalData('offer')).toBeNull();
  });
});

describe('parseMeshMessage', () => {
  it('accepts a chat message', () => {
    const message = { type: 'chat', id: 'm1', text: 'hello', at: 1 };

    expect(parseMeshMessage(message)).toEqual(message);
  });

  it('rejects a chat message whose text is not a string', () => {
    expect(parseMeshMessage({ type: 'chat', id: 'm1', text: { a: 1 }, at: 1 })).toBeNull();
  });

  it('rejects an unknown message type', () => {
    expect(parseMeshMessage({ type: 'exec', id: 'm1' })).toBeNull();
  });

  it('accepts stats with well-formed links', () => {
    const message = { type: 'stats', at: 1, links: [stat] };

    expect(parseMeshMessage(message)).toEqual(message);
  });

  it('rejects stats whose figures are not numbers', () => {
    expect(parseMeshMessage({ type: 'stats', at: 1, links: [{ ...stat, rtt: 'slow' }] })).toBeNull();
    expect(parseMeshMessage({ type: 'stats', at: 1, links: [{ ...stat, loss: '100%' }] })).toBeNull();
  });

  it('rejects stats with an invented bucket', () => {
    expect(parseMeshMessage({ type: 'stats', at: 1, links: [{ ...stat, bucket: 'awful' }] })).toBeNull();
  });

  it('accepts a null rtt because a link can be unmeasured', () => {
    const message = { type: 'stats', at: 1, links: [{ ...stat, rtt: null, loss: null }] };

    expect(parseMeshMessage(message)).toEqual(message);
  });

  it('rejects presence with non-boolean toggles', () => {
    expect(parseMeshMessage({ type: 'presence', micOn: 'yes', cameraOn: true })).toBeNull();
  });

  it('rejects a file-meta missing its chunk count', () => {
    expect(
      parseMeshMessage({ type: 'file-meta', id: 'a', name: 'a.png', mime: 'image/png', size: 10, at: 1 }),
    ).toBeNull();
  });
});
