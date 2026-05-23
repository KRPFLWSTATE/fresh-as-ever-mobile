import React from 'react';
import Svg, { Path } from 'react-native-svg';

/**
 * Approximation of the Phosphor `ph-person-heart` glyph used in Stitch
 * `favourites/code.html`. Material Icons has no direct analogue, so we render an
 * inline SVG (person bust + small heart overlay) using only `react-native-svg`,
 * which is already a dependency.
 */
export function PersonHeartIcon({
  size = 22,
  color = '#01696f',
}: {
  size?: number;
  color?: string;
}): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M9 4a4 4 0 1 1 0 8a4 4 0 0 1 0-8zm0 10c-3.31 0-6 1.94-6 4.33V20a1 1 0 0 0 1 1h7.7a4.8 4.8 0 0 1-.7-2.5c0-1.55.74-2.94 1.89-3.85A8.66 8.66 0 0 0 9 14z"
      />
      <Path
        fill={color}
        d="M17.95 13.05c-1.05-1-2.85-1-3.9 0c-1.05 1-1.05 2.6 0 3.6L17 19.5l2.95-2.85c1.05-1 1.05-2.6 0-3.6c-1.05-1-2.85-1-3.9 0z"
      />
    </Svg>
  );
}
