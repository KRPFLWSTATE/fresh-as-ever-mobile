import {
  buildShelfDeepLink,
  buildShelfWhatsAppMessage,
  buildWhatsAppShareUrl,
} from '@/lib/shelfShare';

describe('shelfShare', () => {
  it('builds deep link and WhatsApp message', () => {
    expect(buildShelfDeepLink('abc-123')).toBe('freshasever://shelves/abc-123');
    const msg = buildShelfWhatsAppMessage({
      shelfId: 'abc-123',
      outletName: 'Bakehouse',
      itemCount: 3,
    });
    expect(msg).toContain('Bakehouse');
    expect(msg).toContain('abc-123');
    expect(buildWhatsAppShareUrl(msg)).toContain('wa.me');
  });
});
