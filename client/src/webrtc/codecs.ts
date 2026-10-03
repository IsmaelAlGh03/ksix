export const PREFERRED_VIDEO = 'video/VP9';

export function orderCodecs(codecs: RTCRtpCodec[], preferred: string): RTCRtpCodec[] {
  const wanted = preferred.toLowerCase();
  const first = codecs.filter((codec) => codec.mimeType.toLowerCase() === wanted);
  const rest = codecs.filter((codec) => codec.mimeType.toLowerCase() !== wanted);
  return [...first, ...rest];
}

export function preferVideoCodec(connection: RTCPeerConnection): void {
  if (typeof RTCRtpReceiver === 'undefined' || typeof RTCRtpTransceiver === 'undefined') return;
  if (!('setCodecPreferences' in RTCRtpTransceiver.prototype)) return;

  const capabilities = RTCRtpReceiver.getCapabilities('video');
  if (capabilities === null) return;

  const codecs = orderCodecs(capabilities.codecs, PREFERRED_VIDEO);
  for (const transceiver of connection.getTransceivers()) {
    if (transceiver.receiver.track.kind !== 'video') continue;
    try {
      transceiver.setCodecPreferences(codecs);
    } catch {
      continue;
    }
  }
}
