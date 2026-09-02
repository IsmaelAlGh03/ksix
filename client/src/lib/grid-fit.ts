export interface FitBox {
  width: number;
  height: number;
  columns: number;
  count: number;
  caption: number;
  gap: number;
}

export interface Fit {
  maxWidth: number | null;
  required: number;
}

const MIN_MEDIA_HEIGHT = 96;

export function fitGrid({ width, height, columns, count, caption, gap }: FitBox): Fit {
  const rows = Math.ceil(count / columns);
  const gaps = gap * (rows - 1);
  const perRow = (height - gaps) / rows;
  const media = Math.max(perRow - caption, MIN_MEDIA_HEIGHT);
  const capped = ((media * 16) / 9) * columns + gap * (columns - 1);

  return {
    maxWidth: capped < width ? Math.round(capped) : null,
    required: rows * (MIN_MEDIA_HEIGHT + caption) + gaps,
  };
}
