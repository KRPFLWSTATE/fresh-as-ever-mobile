import { fetchScopedNearbyBags } from '@/hooks/useNearbyBags';

function mockSupabase(options: {
  rpcBags?: Record<string, unknown>[];
  shelfRows?: Record<string, unknown>[];
  outletBags?: Record<string, unknown>[];
}) {
  const rpcBags = options.rpcBags ?? [];
  const shelfRows = options.shelfRows ?? [];
  const outletBags = options.outletBags ?? [];

  return {
    rpc: jest.fn(async () => ({ data: rpcBags, error: null })),
    from: jest.fn((table: string) => {
      if (table === 'clearance_shelves') {
        return {
          select: () => ({
            eq: () => ({
              gt: async () => ({ data: shelfRows, error: null }),
            }),
          }),
        };
      }
      if (table === 'rescue_bags') {
        return {
          select: () => ({
            in: () => ({
              in: () => ({
                gt: () => ({
                  order: async () => ({ data: outletBags, error: null }),
                }),
                order: async () => ({ data: outletBags, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'outlets') {
        return {
          select: () => ({
            in: async () => ({ data: [], error: null }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  } as unknown as ReturnType<typeof import('@/lib/supabase').getSupabase>;
}

describe('fetchScopedNearbyBags', () => {
  it('supplements live bags for hybrid outlets that publish shelves but miss the RPC radius', async () => {
    const hybridOutletId = '00000000-0000-0000-0000-000000000003';
    const sb = mockSupabase({
      rpcBags: [
        {
          id: 'nearby-1',
          title: 'Cafe bag',
          rescue_price: 500,
          outlet_id: 'cafe-outlet',
          outlet_name: 'Cafe',
          outlet_category: 'cafe',
        },
      ],
      shelfRows: [
        {
          id: 'shelf-1',
          outlet_id: hybridOutletId,
          pickup_start: new Date().toISOString(),
          pickup_end: new Date(Date.now() + 86_400_000).toISOString(),
          status: 'published',
          items: [{ status: 'live', quantity_remaining: 2, rescue_price: 100 }],
          outlet: {
            id: hybridOutletId,
            name: 'Bakehouse',
            category: 'hybrid',
            is_active: true,
            merchant: { status: 'approved' },
          },
        },
      ],
      outletBags: [
        {
          id: 'hybrid-bag-1',
          title: 'Pastry Rescue',
          category: 'bakery',
          rescue_price: 750,
          quantity_remaining: 1,
          outlet_id: hybridOutletId,
          outlet: {
            id: hybridOutletId,
            name: 'Bakehouse',
            category: 'hybrid',
          },
        },
      ],
    });

    const bags = await fetchScopedNearbyBags(sb, 6.9271, 79.8612);
    expect(bags.map((b) => b.id).sort()).toEqual(['hybrid-bag-1', 'nearby-1']);
  });
});
