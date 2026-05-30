import {
  outletCategoryMismatchWarning,
  outletCategoryModeWarning,
  outletCategoryWarnings,
} from '@/lib/outletCategoryWarning';

describe('outletCategoryModeWarning', () => {
  it('warns supermarket is shelves only', () => {
    expect(outletCategoryModeWarning('supermarket')).toMatch(/Clearance shelves only/);
  });

  it('warns bakery is bags only', () => {
    expect(outletCategoryModeWarning('bakery')).toMatch(/Rescue bags only/);
  });

  it('warns hybrid shows both', () => {
    expect(outletCategoryModeWarning('hybrid')).toMatch(/Both rescue bags/);
    expect(outletCategoryModeWarning('hotel')).toMatch(/Both rescue bags/);
  });

  it('warns cafe and restaurant', () => {
    expect(outletCategoryModeWarning('cafe')).toMatch(/Rescue bags only/);
    expect(outletCategoryModeWarning('restaurant')).toMatch(/Rescue bags only/);
  });

  it('warns other category', () => {
    expect(outletCategoryModeWarning('other')).toMatch(/Rescue bags only/);
  });
});

describe('outletCategoryMismatchWarning', () => {
  it('warns when bakery name uses supermarket category', () => {
    expect(outletCategoryMismatchWarning('Bakehouse Kollupitiya', 'supermarket')).toMatch(
      /bakery or café/,
    );
  });

  it('warns when supermarket in name uses bakery category', () => {
    expect(outletCategoryMismatchWarning('City Supermarket Cafe', 'bakery')).toMatch(
      /supermarket/,
    );
  });

  it('returns null when name and category align', () => {
    expect(outletCategoryMismatchWarning('Green Grocers', 'supermarket')).toBeNull();
    expect(outletCategoryMismatchWarning('Corner Cafe', 'cafe')).toBeNull();
  });
});

describe('outletCategoryWarnings', () => {
  it('includes mode warning for every category chip', () => {
    for (const cat of ['supermarket', 'bakery', 'cafe', 'restaurant', 'hybrid', 'other']) {
      expect(outletCategoryWarnings('Test Outlet', cat).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('stacks mismatch on top of mode for Bakehouse supermarket', () => {
    const msgs = outletCategoryWarnings('Bakehouse Kollupitiya', 'supermarket');
    expect(msgs.length).toBe(2);
    expect(msgs[0]).toMatch(/Clearance shelves only/);
    expect(msgs[1]).toMatch(/bakery or café/);
  });
});
