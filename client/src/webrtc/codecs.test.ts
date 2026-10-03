import { describe, expect, it } from 'vitest';
import { orderCodecs, PREFERRED_VIDEO } from './codecs';

const codec = (mimeType: string, sdpFmtpLine?: string): RTCRtpCodec => ({
  mimeType,
  clockRate: 90000,
  ...(sdpFmtpLine === undefined ? {} : { sdpFmtpLine }),
});

const chrome = [
  codec('video/VP8'),
  codec('video/rtx'),
  codec('video/VP9', 'profile-id=0'),
  codec('video/H264', 'profile-level-id=42e01f'),
  codec('video/VP9', 'profile-id=2'),
  codec('video/AV1'),
  codec('video/red'),
  codec('video/ulpfec'),
];

describe('orderCodecs', () => {
  it('puts every VP9 profile first', () => {
    const ordered = orderCodecs(chrome, PREFERRED_VIDEO);

    expect(ordered.slice(0, 2).map((entry) => entry.sdpFmtpLine)).toEqual([
      'profile-id=0',
      'profile-id=2',
    ]);
  });

  it('keeps the rest in the order the browser gave', () => {
    const rest = orderCodecs(chrome, PREFERRED_VIDEO).slice(2).map((entry) => entry.mimeType);

    expect(rest).toEqual(['video/VP8', 'video/rtx', 'video/H264', 'video/AV1', 'video/red', 'video/ulpfec']);
  });

  it('keeps retransmission and error correction entries', () => {
    expect(orderCodecs(chrome, PREFERRED_VIDEO)).toHaveLength(chrome.length);
  });

  it('matches the MIME type without regard to case', () => {
    expect(orderCodecs([codec('video/VP8'), codec('video/vp9')], PREFERRED_VIDEO)[0]?.mimeType).toBe(
      'video/vp9',
    );
  });

  it('leaves a list without VP9 as it was', () => {
    const plain = [codec('video/VP8'), codec('video/rtx'), codec('video/H264')];

    expect(orderCodecs(plain, PREFERRED_VIDEO)).toEqual(plain);
  });
});
