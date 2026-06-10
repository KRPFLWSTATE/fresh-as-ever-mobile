import { discoverCategoryMatchesChip } from '@/lib/discoverCategoryChip';

describe('discoverCategoryMatchesChip', () => {
  it('maps hybrid outlets to groceries and supermarket chips', () => {
    expect(discoverCategoryMatchesChip('hybrid', 'groceries')).toBe(true);
    expect(discoverCategoryMatchesChip('hybrid', 'supermarket')).toBe(true);
    expect(discoverCategoryMatchesChip('hybrid', 'bakery')).toBe(false);
  });

  it('maps supermarket enum to grocery chips', () => {
    expect(discoverCategoryMatchesChip('supermarket', 'groceries')).toBe(true);
    expect(discoverCategoryMatchesChip('supermarket', 'supermarket')).toBe(true);
  });

  it('keeps bakery chip on bakery category only', () => {
    expect(discoverCategoryMatchesChip('bakery', 'bakery')).toBe(true);
    expect(discoverCategoryMatchesChip('hybrid', 'bakery')).toBe(false);
  });
});
