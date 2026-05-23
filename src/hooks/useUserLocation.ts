import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation, {
  type GeolocationError,
  type GeolocationResponse,
} from '@react-native-community/geolocation';
import { logError } from '@/observability/logError';
import { FALLBACK_COORDS } from '@/lib/fallbackCoords';
import { haversineKm } from '@/lib/haversine';
import { isRunningInSimulator } from '@/lib/isRunningInSimulator';
import { normalizeUserCoords } from '@/lib/normalizeUserCoords';

/**
 * Colombo Fort — used when location services are denied, unavailable, or
 * pending. Re-exported from `@/lib/fallbackCoords` so existing imports of
 * `FALLBACK_COORDS` from this hook keep working, while screens that only need
 * the static value can import from `@/lib/fallbackCoords` directly and skip
 * the geolocation native-module dependency.
 */
export { FALLBACK_COORDS };

const CACHE_KEY = 'fae.userLocation.lastKnown.v1';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
/** Drop stale cache when a live fix is this far from the hydrated cache (km). */
const CACHE_INVALIDATE_DRIFT_KM = 5;

/**
 * Permission lifecycle:
 *   pending      — we haven't asked yet, or are awaiting the user's response.
 *   granted      — foreground access granted (we never request Always).
 *   denied       — user actively denied or simulator has services off.
 *   unavailable  — Location services disabled at the OS level or the bridge threw.
 */
export type LocationStatus = 'pending' | 'granted' | 'denied' | 'unavailable';

export type UserLocation = {
  lat: number;
  lng: number;
  accuracy: number | null;
  /** Metres / second from the OS, or null when not moving / unsupported. */
  speed: number | null;
  /** Bearing in degrees, 0–360. Null when not moving. */
  heading: number | null;
  /** Epoch ms the fix was produced (OS-reported, not arrival time). */
  timestamp: number;
};

export type UseUserLocationOptions = {
  /** When false, skips permission prompts and watchPosition (e.g. Discover tab unfocused). */
  enabled?: boolean;
};

export type UseUserLocationResult = {
  /** Current best coordinates. Falls back to Colombo when status !== 'granted'. */
  location: UserLocation;
  /** True when `location` is the FALLBACK or the cached value, not a live fix. */
  isUsingFallback: boolean;
  /** Permission + service availability. Drives the explainer UI. */
  status: LocationStatus;
  /** True while the initial fix is in flight. */
  loading: boolean;
  /** Re-request permission. No-op on `granted`. */
  requestPermission: () => Promise<LocationStatus>;
  /** Force a one-shot high-accuracy fix (e.g. "Recenter on me"). */
  refresh: () => Promise<UserLocation | null>;
};

type CachedFix = {
  lat: number;
  lng: number;
  accuracy: number | null;
  timestamp: number;
};

/**
 * `@react-native-community/geolocation` error codes (W3C-style).
 *   1: PERMISSION_DENIED
 *   2: POSITION_UNAVAILABLE  (services off, no signal)
 *   3: TIMEOUT
 */
const ERR_PERMISSION_DENIED = 1;
const ERR_POSITION_UNAVAILABLE = 2;

let configured = false;
function ensureConfigured() {
  if (configured) return;
  configured = true;
  // iOS-only fields are silently ignored on Android. We never want background
  // updates — foreground-only is the Apple-recommended posture for a discovery
  // feed, matches Too Good To Go's behaviour, and avoids the Always prompt.
  Geolocation.setRNConfiguration({
    skipPermissionRequests: false,
    authorizationLevel: 'whenInUse',
    enableBackgroundLocationUpdates: false,
  });
}

async function readCachedFix(): Promise<CachedFix | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedFix>;
    if (
      typeof parsed.lat !== 'number' ||
      typeof parsed.lng !== 'number' ||
      typeof parsed.timestamp !== 'number'
    ) {
      return null;
    }
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      return null;
    }
    const normalized = normalizeUserCoords(parsed.lat, parsed.lng);
    if (!normalized) {
      void AsyncStorage.removeItem(CACHE_KEY);
      return null;
    }
    return {
      lat: normalized.lat,
      lng: normalized.lng,
      accuracy: typeof parsed.accuracy === 'number' ? parsed.accuracy : null,
      timestamp: parsed.timestamp,
    };
  } catch (err) {
    logError(err, { context: 'useUserLocation.readCachedFix' });
    return null;
  }
}

function writeCachedFix(fix: UserLocation): void {
  const payload: CachedFix = {
    lat: fix.lat,
    lng: fix.lng,
    accuracy: fix.accuracy,
    timestamp: fix.timestamp,
  };
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload)).catch((err) => {
    logError(err, { context: 'useUserLocation.writeCachedFix' });
  });
}

function fromResponse(res: GeolocationResponse): UserLocation | null {
  const rawLat = res.coords.latitude;
  const rawLng = res.coords.longitude;
  const normalized = normalizeUserCoords(rawLat, rawLng);
  if (!normalized) {
    if (__DEV__) {
      logError(new Error('normalizeUserCoords rejected fix'), {
        context: 'useUserLocation.fromResponse',
        extra: { rawLat, rawLng },
      });
    }
    return null;
  }
  return {
    lat: normalized.lat,
    lng: normalized.lng,
    accuracy:
      typeof res.coords.accuracy === 'number' ? res.coords.accuracy : null,
    // Geolocation reports speed in m/s, or -1 on iOS when unknown. Treat any
    // negative as null so callers don't reason about phantom motion.
    speed:
      typeof res.coords.speed === 'number' && res.coords.speed >= 0
        ? res.coords.speed
        : null,
    heading:
      typeof res.coords.heading === 'number' && res.coords.heading >= 0
        ? res.coords.heading
        : null,
    timestamp:
      typeof res.timestamp === 'number' ? res.timestamp : Date.now(),
  };
}

function getCurrentPositionAsync(highAccuracy: boolean): Promise<UserLocation> {
  const simulator = isRunningInSimulator();
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (res) => {
        const fix = fromResponse(res);
        if (fix) {
          resolve(fix);
        } else {
          reject(new Error('normalizeUserCoords rejected fix'));
        }
      },
      (err) => reject(err),
      {
        enableHighAccuracy: highAccuracy || simulator,
        timeout: 15_000,
        maximumAge: simulator ? 0 : highAccuracy ? 5_000 : 10_000,
      },
    );
  });
}

/**
 * Simulator / emulator: tight watch so Xcode Location (GPX, City Run) and
 * `simctl location` deltas reach JS. Physical device: 100 m filter + significant
 * changes for battery.
 */
function watchPositionOptions(): Parameters<typeof Geolocation.watchPosition>[2] {
  if (isRunningInSimulator()) {
    return {
      enableHighAccuracy: true,
      distanceFilter: 0,
      maximumAge: 0,
      interval: 2_000,
      fastestInterval: 500,
      useSignificantChanges: false,
    };
  }
  return {
    enableHighAccuracy: false,
    distanceFilter: 100,
    interval: 30_000,
    fastestInterval: 30_000,
    useSignificantChanges: Platform.OS === 'ios',
  };
}

function requestAuthorizationAsync(): Promise<LocationStatus> {
  return new Promise((resolve) => {
    Geolocation.requestAuthorization(
      () => resolve('granted'),
      (err: GeolocationError) => {
        if (err?.code === ERR_PERMISSION_DENIED) {
          resolve('denied');
        } else if (err?.code === ERR_POSITION_UNAVAILABLE) {
          resolve('unavailable');
        } else {
          resolve('denied');
        }
      },
    );
  });
}

/**
 * Foreground-only live location hook.
 *
 * Behaviour:
 *   1. Hydrates from AsyncStorage cache on mount so cold starts don't snap to Colombo.
 *   2. Requests `whenInUse` authorization (never `always`).
 *   3. On grant, takes one fix and subscribes to updates with a 100 m distance
 *      filter (battery-friendly, in line with TGTG / Deliveroo idle).
 *   4. Exposes the raw `speed` so the screen can tier its re-query thresholds.
 *
 * Callers should treat `isUsingFallback === true` as "feed is best-effort" and may
 * want to surface a CTA that calls `requestPermission()`.
 */
export function useUserLocation(
  options: UseUserLocationOptions = {},
): UseUserLocationResult {
  const enabled = options.enabled !== false;
  const [location, setLocation] = useState<UserLocation>(() => ({
    lat: FALLBACK_COORDS.lat,
    lng: FALLBACK_COORDS.lng,
    accuracy: null,
    speed: null,
    heading: null,
    timestamp: 0,
  }));
  const [status, setStatus] = useState<LocationStatus>('pending');
  const [isUsingFallback, setIsUsingFallback] = useState(true);
  const [loading, setLoading] = useState(true);

  const watcherIdRef = useRef<number | null>(null);
  const simulatorPollCleanupRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);
  /** Coords hydrated from AsyncStorage before the first live fix this session. */
  const hydratedCacheRef = useRef<CachedFix | null>(null);

  const applyFix = useCallback((fix: UserLocation, fromLive: boolean) => {
    if (!isMountedRef.current) return;

    if (fromLive && hydratedCacheRef.current) {
      const drift = haversineKm(
        hydratedCacheRef.current.lat,
        hydratedCacheRef.current.lng,
        fix.lat,
        fix.lng,
      );
      if (
        Number.isFinite(drift) &&
        drift >= CACHE_INVALIDATE_DRIFT_KM
      ) {
        hydratedCacheRef.current = null;
        void AsyncStorage.removeItem(CACHE_KEY);
      }
    }

    setLocation(fix);
    setIsUsingFallback(!fromLive);
    if (fromLive) {
      writeCachedFix(fix);
      if (__DEV__) {
        // eslint-disable-next-line no-console -- dev-only location trace for simulator QA
        console.log('[useUserLocation] live fix', {
          lat: fix.lat,
          lng: fix.lng,
          isUsingFallback: false,
          accuracy: fix.accuracy,
        });
      }
    }
  }, []);

  const startWatcher = useCallback(() => {
    // Bail if the component already unmounted between the awaited bootstrap
    // steps (requestAuthorizationAsync / fetchOnce). Without this guard the
    // resumed promise can register a fresh `watchPosition` after cleanup has
    // already cleared `watcherIdRef`, leaking the subscription forever.
    if (!isMountedRef.current) return;
    if (watcherIdRef.current != null) return;
    try {
      watcherIdRef.current = Geolocation.watchPosition(
        (res) => {
          const fix = fromResponse(res);
          if (fix) {
            applyFix(fix, true);
          }
        },
        (err) => {
          // Don't kill status on transient timeouts; the existing fix is still
          // good. PERMISSION_DENIED is the only "real" terminal error here.
          if (err?.code === ERR_PERMISSION_DENIED && isMountedRef.current) {
            setStatus('denied');
            setIsUsingFallback(true);
          } else {
            logError(err, { context: 'useUserLocation.watchPosition' });
          }
        },
        watchPositionOptions(),
      );
    } catch (err) {
      logError(err, { context: 'useUserLocation.watchPositionStart' });
    }
  }, [applyFix]);

  const fetchOnce = useCallback(
    async (highAccuracy: boolean): Promise<UserLocation | null> => {
      try {
        const fix = await getCurrentPositionAsync(highAccuracy);
        applyFix(fix, true);
        return fix;
      } catch (err) {
        const code = (err as GeolocationError | undefined)?.code;
        if (code === ERR_PERMISSION_DENIED && isMountedRef.current) {
          setStatus('denied');
        } else if (code === ERR_POSITION_UNAVAILABLE && isMountedRef.current) {
          setStatus('unavailable');
        }
        return null;
      }
    },
    [applyFix],
  );

  const startSimulatorPoll = useCallback(() => {
    if (!isRunningInSimulator()) return () => {};
    const id = setInterval(() => {
      if (!isMountedRef.current) return;
      void fetchOnce(true);
    }, 3_000);
    return () => clearInterval(id);
  }, [fetchOnce]);

  const requestPermission = useCallback(async (): Promise<LocationStatus> => {
    ensureConfigured();
    const next = await requestAuthorizationAsync();
    if (!isMountedRef.current) return next;
    setStatus(next);
    if (next === 'granted') {
      setLoading(true);
      await fetchOnce(true);
      // Re-check mount state after the awaited fix; without this we could
      // still call startWatcher() (which now also bails on unmount, but the
      // explicit guard makes the intent obvious and avoids the spurious
      // setLoading(false) below if we already tore down).
      if (!isMountedRef.current) return next;
      startWatcher();
      simulatorPollCleanupRef.current?.();
      simulatorPollCleanupRef.current = startSimulatorPoll();
      setLoading(false);
    } else {
      setIsUsingFallback(true);
      setLoading(false);
    }
    return next;
  }, [fetchOnce, startSimulatorPoll, startWatcher]);

  const refresh = useCallback(async (): Promise<UserLocation | null> => {
    if (status !== 'granted') return null;
    const result = await fetchOnce(true);
    // `fetchOnce` transitions status to 'denied' / 'unavailable' internally if
    // the OS revoked permission mid-fetch (e.g. user toggled Settings while
    // we were awaiting the bridge). Guard against handing a stale fix back to
    // callers in that case.
    if (!isMountedRef.current) return null;
    return result;
  }, [fetchOnce, status]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return () => {
        isMountedRef.current = false;
        simulatorPollCleanupRef.current?.();
        simulatorPollCleanupRef.current = null;
        if (watcherIdRef.current != null) {
          Geolocation.clearWatch(watcherIdRef.current);
          watcherIdRef.current = null;
        }
      };
    }

    isMountedRef.current = true;
    ensureConfigured();

    void (async () => {
      // 1) Hydrate from cache so the map paints something useful immediately.
      const cached = await readCachedFix();
      if (cached && isMountedRef.current) {
        hydratedCacheRef.current = cached;
        // Cache is display-only until a live fix; keeps isUsingFallback true so
        // Discover does not move the map / feed off Colombo prematurely.
        setLocation({
          lat: cached.lat,
          lng: cached.lng,
          accuracy: cached.accuracy,
          speed: null,
          heading: null,
          timestamp: cached.timestamp,
        });
        setIsUsingFallback(true);
      }

      // 2) Prompt for permission and start the watcher. The library will no-op
      //    the prompt if the user has already granted/denied in a prior session,
      //    so this is safe to call unconditionally.
      const result = await requestAuthorizationAsync();
      if (!isMountedRef.current) return;
      setStatus(result);
      if (result === 'granted') {
        await fetchOnce(true);
        // Re-check mount state after the awaited fix landed — the component
        // may have unmounted between the prompt and the first fix arriving,
        // in which case `startWatcher()` would otherwise register a watcher
        // we have no path to clear (cleanup already ran on the prior tick).
        if (!isMountedRef.current) return;
        startWatcher();
        simulatorPollCleanupRef.current = startSimulatorPoll();
      } else {
        setIsUsingFallback(true);
      }
      if (isMountedRef.current) setLoading(false);
    })();

    return () => {
      isMountedRef.current = false;
      simulatorPollCleanupRef.current?.();
      simulatorPollCleanupRef.current = null;
      if (watcherIdRef.current != null) {
        Geolocation.clearWatch(watcherIdRef.current);
        watcherIdRef.current = null;
      }
    };
    // requestPermission / fetchOnce / startWatcher are stable callbacks; the effect
    // only runs once on mount and tears down on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    location,
    isUsingFallback,
    status,
    loading,
    requestPermission,
    refresh,
  };
}
