export function describeWriters(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length > 3) return 'Several people are writing';
  if (names.length === 1) return `${names[0]} is writing`;

  const head = names.slice(0, -1).join(', ');
  return `${head} and ${names[names.length - 1]} are writing`;
}
