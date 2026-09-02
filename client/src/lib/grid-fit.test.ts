import { describe, expect, it } from 'vitest';
import { fitGrid } from './grid-fit';

const box = { width: 1104, height: 224, columns: 2, count: 4, caption: 58, gap: 24 };

describe('fitGrid', () => {
  it('reports the height two rows need at the smallest usable tile', () => {
    expect(fitGrid(box).required).toBe(2 * (96 + 58) + 24);
  });

  it('needs no more than one row of height for a headcount that fits across', () => {
    expect(fitGrid({ ...box, columns: 3, count: 3 }).required).toBe(96 + 58);
  });

  it('caps the width so rows fit the box when there is room to shrink into', () => {
    const { maxWidth } = fitGrid({ ...box, height: 500 });
    expect(maxWidth).not.toBeNull();
    expect(maxWidth!).toBeLessThan(box.width);
  });

  it('leaves the width alone when the cap would be wider than the box', () => {
    expect(fitGrid({ ...box, width: 300, height: 900 }).maxWidth).toBeNull();
  });

  it('never sizes a tile below the floor, so the caller can see it does not fit', () => {
    const tight = fitGrid(box);
    expect(tight.required).toBeGreaterThan(box.height);
    expect(tight.maxWidth).toBe(365);
  });

  it('counts the caption against the budget, not just the video', () => {
    const short = fitGrid({ ...box, caption: 0 });
    expect(short.required).toBeLessThan(fitGrid(box).required);
  });
});
