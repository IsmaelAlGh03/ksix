const ADJECTIVES: [string, ...string[]] = [
  'quiet', 'open', 'narrow', 'distant', 'shallow', 'amber', 'northern', 'hollow',
  'copper', 'still', 'passing', 'linen', 'winter', 'rough', 'plain', 'steady',
];

const NOUNS: [string, ...string[]] = [
  'harbor', 'signal', 'anchor', 'lantern', 'ferry', 'meadow', 'beacon', 'cabin',
  'thicket', 'current', 'orchard', 'bridge', 'shoreline', 'station', 'valley', 'kiln',
];

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
const SUFFIX_LENGTH = 8;

const ROOM_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_ROOM_ID_LENGTH = 64;

function randomBytes(count: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(count));
}

function pick(words: [string, ...string[]]): string {
  const [byte] = randomBytes(1);
  return words[(byte ?? 0) % words.length] ?? words[0];
}

function suffix(): string {
  return [...randomBytes(SUFFIX_LENGTH)]
    .map((byte) => ALPHABET[byte % ALPHABET.length])
    .join('');
}

export function createRoomId(): string {
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${suffix()}`;
}

export function parseRoomId(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === '') return null;

  const candidate = trimmed.match(/\/room\/([^/?#]+)/)?.[1] ?? trimmed;

  if (candidate.length > MAX_ROOM_ID_LENGTH) return null;
  return ROOM_ID_PATTERN.test(candidate) ? candidate : null;
}
