import React from 'react';
import { StitchSurface } from '@/ui/stitch/StitchSurface';

/** Opinionated card: surface + ambient shadow + padding (Stitch login / discover cards). */
export function StitchCard(
  props: React.ComponentProps<typeof StitchSurface>,
): React.ReactElement {
  return <StitchSurface elevated padding="md" {...props} />;
}
