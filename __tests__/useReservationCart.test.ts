import { MAX_GROUP_BAGS } from '../src/hooks/useReservationCart';

describe('useReservationCart constants', () => {
  it('caps group size at five bags', () => {
    expect(MAX_GROUP_BAGS).toBe(5);
  });
});
