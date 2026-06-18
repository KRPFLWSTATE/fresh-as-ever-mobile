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
      rescuePriceFrom: 180,
      pickupStart: '2026-06-18T12:00:00.000Z',
      pickupEnd: '2026-06-18T14:00:00.000Z',
    });
    expect(msg).toContain('Bakehouse');
    expect(msg).toContain('abc-123');
    expect(msg).toContain('LKR 180');
    expect(msg).toContain('Pickup');
    expect(buildWhatsAppShareUrl(msg)).toContain('wa.me');
  });
});
