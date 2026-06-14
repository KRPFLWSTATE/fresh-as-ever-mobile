import { Share } from 'react-native';
import { shareCardGraphic } from '@/lib/shareCard';

jest.mock('react-native', () => ({
  Share: {
    share: jest.fn(() => Promise.resolve({ action: 'sharedAction' })),
    dismissedAction: 'dismissedAction',
  },
  Platform: { select: (o: Record<string, unknown>) => o.default },
}));

describe('shareCard', () => {
  it('shares message-only payload safely', async () => {
    const result = await shareCardGraphic({
      title: 'Impact',
      message: 'Hello',
    });
    expect(result).toBe('shared');
    expect(Share.share).toHaveBeenCalled();
  });
});
