import { describe, expect, it } from 'vitest';
import { describeWriters } from './writers';

describe('describeWriters', () => {
  it('says nothing when nobody is writing', () => {
    expect(describeWriters([])).toBeNull();
  });

  it('names one writer', () => {
    expect(describeWriters(['Ada'])).toBe('Ada is writing');
  });

  it('joins two writers with and', () => {
    expect(describeWriters(['Ada', 'Ben'])).toBe('Ada and Ben are writing');
  });

  it('lists three writers with a comma and an and', () => {
    expect(describeWriters(['Ada', 'Ben', 'Cai'])).toBe('Ada, Ben and Cai are writing');
  });

  it('stops naming people past three', () => {
    expect(describeWriters(['Ada', 'Ben', 'Cai', 'Dee'])).toBe('Several people are writing');
  });
});
