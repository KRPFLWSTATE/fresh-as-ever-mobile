import {
  buildBagDeepLink,
  buildBagWhatsAppMessage,
  buildShelfDeepLink,
  buildShelfWhatsAppMessage,
  buildWhatsAppShareUrl,
  formatListingLkr,
  formatListingPickupLine,
} from '@/lib/listingShare';

describe('listingShare', () => {
  const pickupStart = '2026-06-18T12:00:00.000Z';
  const pickupEnd = '2026-06-18T14:00:00.000Z';

  it('formats LKR price for Sri Lanka locale', () => {
    expect(formatListingLkr(450)).toBe('LKR 450');
    expect(formatListingLkr(1250)).toMatch(/^LKR 1,?250$/);
  });

  it('formats pickup window line', () => {
    const line = formatListingPickupLine(pickupStart, pickupEnd);
    expect(line).toMatch(/^Pickup /);
    expect(line).toContain('–');
  });

  it('builds bag WhatsApp message with price, window, and deeplink', () => {
    const msg = buildBagWhatsAppMessage({
      bagId: 'bag-abc',
      title: 'Morning Bakery Box',
      outletName: 'Bakehouse',
      rescuePrice: 450,
      pickupStart,
      pickupEnd,
      webBaseUrl: 'https://freshasever.com',
    });
    expect(msg).toContain('Bakehouse');
    expect(msg).toContain('Morning Bakery Box');
    expect(msg).toContain('LKR 450');
    expect(msg).toContain('Pickup');
    expect(msg).toContain('https://freshasever.com/bags/bag-abc');
    expect(msg).toContain(buildBagDeepLink('bag-abc'));
    expect(buildWhatsAppShareUrl(msg)).toContain('wa.me');
  });

  it('builds shelf WhatsApp message with price, window, and deeplink', () => {
    const msg = buildShelfWhatsAppMessage({
      shelfId: 'shelf-xyz',
      outletName: 'Kumbuk Kitchen',
      itemCount: 3,
      rescuePriceFrom: 180,
      pickupStart,
      pickupEnd,
      webBaseUrl: 'https://freshasever.com',
    });
    expect(msg).toContain('Kumbuk Kitchen');
    expect(msg).toContain('3 clearance items');
    expect(msg).toContain('From LKR 180');
    expect(msg).toContain('Pickup');
    expect(msg).toContain('https://freshasever.com/shelves/shelf-xyz');
    expect(msg).toContain(buildShelfDeepLink('shelf-xyz'));
    expect(buildWhatsAppShareUrl(msg)).toContain('wa.me/?text=');
  });
});
