import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { isClearanceShelvesEnabled } from '@/config/clearanceShelves';
import { useAuthContext } from '@/context/AuthContext';
import { getSupabase } from '@/lib/supabase';
import { StitchScreen, StitchSurface, StitchText } from '@/ui/stitch';

export function AdminProductCatalogScreen(): React.ReactElement {
  const { env, resolvedRole } = useAuthContext();
  const navigation = useNavigation();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (resolvedRole !== 'admin' || !isClearanceShelvesEnabled()) {
      setLoading(false);
      return;
    }
    void (async () => {
      const { data } = await getSupabase(env)
        .from('product_catalog')
        .select('id, barcode, name, brand, source, is_disabled, lookup_count')
        .eq('is_disabled', false)
        .order('lookup_count', { ascending: false })
        .limit(50);
      setRows((data ?? []) as Record<string, unknown>[]);
      setLoading(false);
    })();
  }, [env, resolvedRole]);

  if (!isClearanceShelvesEnabled()) {
    return (
      <StitchScreen scroll>
        <StitchText variant="body-md" colorKey="textMuted">
          Product catalog is disabled.
        </StitchText>
      </StitchScreen>
    );
  }

  return (
    <StitchScreen scroll>
      <Pressable onPress={() => navigation.goBack()} style={{ marginBottom: 12 }}>
        <StitchText variant="label" colorKey="primaryContainer">
          ← Back
        </StitchText>
      </Pressable>
      <StitchText variant="h2" colorKey="text">
        Product catalog
      </StitchText>
      {loading ? (
        <StitchText variant="body-sm" colorKey="textMuted" style={{ marginTop: 16 }}>
          Loading…
        </StitchText>
      ) : (
        <ScrollView style={{ marginTop: 16 }}>
          {rows.map((row) => (
            <StitchSurface key={String(row.id)} elevated padding="md" style={{ marginBottom: 8 }}>
              <StitchText variant="body-md" colorKey="text">
                {String(row.name)}
              </StitchText>
              <StitchText variant="body-sm" colorKey="textMuted">
                {String(row.barcode)} · {String(row.source)} · lookups {String(row.lookup_count)}
              </StitchText>
            </StitchSurface>
          ))}
        </ScrollView>
      )}
    </StitchScreen>
  );
}
