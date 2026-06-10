import {
  parsePreviewQueryParam,
  resolveShelfPreviewMode,
} from '@/lib/shelfPreviewMode';

describe('parsePreviewQueryParam', () => {
  test('accepts boolean true', () => {
    expect(parsePreviewQueryParam(true)).toBe(true);
  });

  test('accepts string true/1', () => {
    expect(parsePreviewQueryParam('true')).toBe(true);
    expect(parsePreviewQueryParam('1')).toBe(true);
    expect(parsePreviewQueryParam(' TRUE ')).toBe(true);
  });

  test('rejects other values', () => {
    expect(parsePreviewQueryParam(false)).toBe(false);
    expect(parsePreviewQueryParam('false')).toBe(false);
    expect(parsePreviewQueryParam(undefined)).toBe(false);
  });
});

describe('resolveShelfPreviewMode', () => {
  test('merchant preview: banner + browse-only', () => {
    expect(resolveShelfPreviewMode(true, 'merchant')).toEqual({
      isMerchantPreview: true,
      isBrowseOnly: true,
    });
  });

  test('customer preview deeplink: browse-only without merchant banner', () => {
    expect(resolveShelfPreviewMode(true, 'customer')).toEqual({
      isMerchantPreview: false,
      isBrowseOnly: true,
    });
  });

  test('normal shelf: no preview flags', () => {
    expect(resolveShelfPreviewMode(false, 'customer')).toEqual({
      isMerchantPreview: false,
      isBrowseOnly: false,
    });
  });
});
