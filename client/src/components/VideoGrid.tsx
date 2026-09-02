import { useEffect, useRef, useState } from 'react';
import { ConnectionOverlay } from './ConnectionOverlay';
import { ParticipantTile, type TileState } from './ParticipantTile';
import { fitGrid } from '../lib/grid-fit';
import { ringNodes, type NodePoint } from '../lib/mesh-layout';
import { formatFields, healthFor } from '../webrtc/quality';
import { LOCAL_ID, type MeshLink } from '../webrtc/mesh-links';
import type { PeerParticipant } from '../types';

interface VideoGridProps {
  localStream: MediaStream | null;
  participants: PeerParticipant[];
  micOn?: boolean;
  cameraOn?: boolean;
  links?: MeshLink[];
  showLinks?: boolean;
  strip?: boolean;
  onRequiredHeight?: (height: number) => void;
}

const COLUMNS = [1, 1, 2, 3, 2, 3, 3];

const COLUMN_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3',
};

const CAPTION_FALLBACK = 58;
const GAP = 24;

function tileState(connectionState: RTCPeerConnectionState): TileState {
  if (connectionState === 'connected') return 'connected';
  if (connectionState === 'disconnected' || connectionState === 'failed') return 'reconnecting';
  return 'connecting';
}

function captionHeight(grid: HTMLElement): number {
  const tile = grid.firstElementChild;
  const media = tile?.firstElementChild;
  if (tile === null || tile === undefined || media === null || media === undefined) {
    return CAPTION_FALLBACK;
  }

  const rest = tile.clientHeight - media.clientHeight;
  return rest > 0 ? rest : CAPTION_FALLBACK;
}

export function VideoGrid({
  localStream,
  participants,
  micOn = true,
  cameraOn = true,
  links = [],
  showLinks = false,
  strip = false,
  onRequiredHeight,
}: VideoGridProps): JSX.Element {
  const box = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const report = useRef(onRequiredHeight);
  const [maxWidth, setMaxWidth] = useState<number | null>(null);
  const [fits, setFits] = useState(true);
  const [nodes, setNodes] = useState<NodePoint[]>([]);
  const [frame, setFrame] = useState({ width: 0, height: 0, ring: false });

  const headcount = participants.length + 1;
  const columns = COLUMNS[Math.min(headcount, 6)] ?? 3;
  const ids = [LOCAL_ID, ...participants.map((participant) => participant.socketId)];
  const idKey = ids.join(',');

  report.current = onRequiredHeight;

  useEffect(() => {
    const element = box.current;
    if (element === null) return;

    const measure = (): void => {
      const container = grid.current;
      if (container === null) return;

      if (strip || window.innerWidth < 640) {
        setMaxWidth(null);
        setFits(container.getBoundingClientRect().height <= element.clientHeight);
      } else {
        const fit = fitGrid({
          width: element.clientWidth,
          height: element.clientHeight,
          columns,
          count: headcount,
          caption: captionHeight(container),
          gap: GAP,
        });

        setMaxWidth(fit.maxWidth);
        setFits(fit.required <= element.clientHeight);
        report.current?.(fit.required);
      }

      const members = idKey.split(',');
      const origin = container.getBoundingClientRect();

      if (window.innerWidth < 640) {
        const band = element.parentElement?.getBoundingClientRect() ?? origin;
        setFrame({ width: band.width, height: band.height, ring: true });
        setNodes(ringNodes(members, { width: band.width, height: band.height }));
        return;
      }

      setFrame({ width: origin.width, height: origin.height, ring: false });
      setNodes(
        Array.from(container.children).flatMap((child, index) => {
          const media = child.firstElementChild?.getBoundingClientRect();
          const id = members[index];
          if (media === undefined || id === undefined) return [];

          return [
            {
              id,
              x: media.left - origin.left + media.width / 2,
              y: media.top - origin.top + media.height / 2,
            },
          ];
        }),
      );
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (grid.current !== null) observer.observe(grid.current);
    return () => observer.disconnect();
  }, [columns, headcount, idKey, showLinks, strip]);

  const overlay = (
    <ConnectionOverlay
      nodes={nodes}
      links={links}
      names={{
        [LOCAL_ID]: 'You',
        ...Object.fromEntries(
          participants.map((participant) => [participant.socketId, participant.displayName]),
        ),
      }}
      width={frame.width}
      height={frame.height}
      labelled={frame.ring}
    />
  );

  return (
    <div
      ref={box}
      className={
        strip
          ? 'flex shrink-0 justify-center overflow-x-auto'
          : `flex min-h-0 flex-1 justify-center ${fits ? 'items-center' : 'items-start'}`
      }
    >
      <div
        className={strip ? 'relative' : 'relative mx-auto w-full'}
        style={maxWidth === null ? undefined : { maxWidth }}
      >
        {showLinks && frame.ring && (
          <div className="pointer-events-none sticky top-0 z-10 h-0">
            <div className="relative" style={{ height: frame.height }}>
              {overlay}
            </div>
          </div>
        )}

        <div
          ref={grid}
          data-columns={strip ? 0 : columns}
          data-strip={strip || undefined}
          className={
            strip
              ? 'flex gap-4 [&>figure]:w-36 [&>figure]:shrink-0'
              : `grid w-full gap-4 sm:gap-gutter ${COLUMN_CLASS[columns] ?? COLUMN_CLASS[3]}`
          }
        >
          <ParticipantTile
            displayName="You"
            stream={localStream}
            state="connected"
            isLocal
            micOn={micOn}
            cameraOn={cameraOn}
            dimmed={showLinks}
            compact={strip}
          />
          {participants.map((peer) => (
            <ParticipantTile
              key={peer.socketId}
              displayName={peer.displayName}
              stream={peer.stream}
              state={tileState(peer.connectionState)}
              micOn={peer.micOn}
              cameraOn={peer.cameraOn}
              dimmed={showLinks}
              compact={strip}
              relayed={peer.quality?.relayed ?? false}
              degraded={peer.quality?.bucket === 'poor'}
              lost={peer.lost}
              fields={peer.quality === null ? undefined : formatFields(peer.quality)}
              health={peer.quality === null ? null : healthFor(peer.quality.bucket)}
            />
          ))}
        </div>

        {showLinks && !frame.ring && (
          <div className="pointer-events-none absolute inset-0">{overlay}</div>
        )}
      </div>
    </div>
  );
}
