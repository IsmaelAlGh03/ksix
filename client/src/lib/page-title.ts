const NAME = 'ksix';

export const LOBBY_TITLE = `${NAME} · peer-to-peer video rooms`;

export function roomTitle(roomId: string): string {
  const named = roomId.trim();
  return named === '' ? NAME : `${named} · ${NAME}`;
}
