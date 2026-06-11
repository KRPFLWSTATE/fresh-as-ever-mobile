import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useLocationSearch } from '@/hooks/useLocationSearch';
import { fetchLocationSearch } from '@/lib/locationApi';

jest.mock('@/lib/locationApi', () => ({
  fetchLocationSearch: jest.fn(),
}));

const env = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  apiBaseUrl: '',
  payHereReturnHost: '',
};

let latest: ReturnType<typeof useLocationSearch> | null = null;

function Harness({ query, enabled = true }: { query: string; enabled?: boolean }) {
  latest = useLocationSearch(env, query, { debounceMs: 400, minChars: 2, enabled });
  return null;
}

describe('useLocationSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    latest = null;
    (fetchLocationSearch as jest.Mock).mockResolvedValue({
      results: [{ label: 'Colombo 07, Sri Lanka', lat: 6.91, lng: 79.86 }],
      apiBaseUrlMissing: true,
      usedClientFallback: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces search until debounceMs elapses', async () => {
    await act(async () => {
      TestRenderer.create(<Harness query="co" />);
    });

    expect(fetchLocationSearch).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expect(fetchLocationSearch).toHaveBeenCalledWith(env, 'co');
    expect(latest?.suggestions).toHaveLength(1);
  });

  it('hides stale suggestions until the active query is fetched', async () => {
    (fetchLocationSearch as jest.Mock).mockResolvedValueOnce({
      results: [{ label: 'Colombo 07, Sri Lanka', lat: 6.91, lng: 79.86 }],
      apiBaseUrlMissing: true,
      usedClientFallback: true,
    });

    await act(async () => {
      TestRenderer.create(<Harness query="colombo 07" />);
    });
    await act(async () => {
      jest.advanceTimersByTime(400);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(latest?.suggestions).toHaveLength(1);

    await act(async () => {
      TestRenderer.create(<Harness query="ward place" />);
      await Promise.resolve();
    });
    expect(latest?.suggestions).toHaveLength(0);
  });

  it('skips search when disabled', async () => {
    await act(async () => {
      TestRenderer.create(<Harness query="colombo" enabled={false} />);
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(fetchLocationSearch).not.toHaveBeenCalled();
  });
});
