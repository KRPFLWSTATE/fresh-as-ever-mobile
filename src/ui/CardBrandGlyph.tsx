import React from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

/**
 * Brand glyphs for Stitch `customer_payments` parity. Rendered as inline SVG so
 * the bundle stays free of third-party brand assets / license overhead while
 * keeping the cards visually distinct from a plain text chip.
 *
 * `viewBox="0 0 48 32"` matches the `brandMark` (48×32) tile in
 * `ProfilePaymentsScreen`.
 */
export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'unknown';

export function normalizeCardBrand(input: string | null | undefined): CardBrand {
  const s = (input ?? '').trim().toLowerCase();
  if (!s) return 'unknown';
  if (s.startsWith('vi')) return 'visa';
  if (s.startsWith('mc') || s.startsWith('master')) return 'mastercard';
  if (s.startsWith('am') || s === 'amex') return 'amex';
  return 'unknown';
}

const TILE_W = 48;
const TILE_H = 32;

type Props = {
  brand: string | null | undefined;
  /** Background color of the tile rect. */
  background?: string;
  /** Fallback text color (when the brand isn't recognized). */
  textColor?: string;
  style?: ViewStyle;
};

export function CardBrandGlyph({ brand, background = '#0b1d4d', textColor = '#1a1a1a', style }: Props): React.ReactElement {
  const normalized = normalizeCardBrand(brand);

  if (normalized === 'visa') {
    return (
      <View style={style}>
        <Svg width={TILE_W} height={TILE_H} viewBox="0 0 48 32">
          <Rect x="0" y="0" width="48" height="32" rx="4" fill="#1A1F71" />
          <SvgText
            x="24"
            y="22"
            fill="#FFFFFF"
            fontSize="13"
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="System"
          >
            VISA
          </SvgText>
        </Svg>
      </View>
    );
  }

  if (normalized === 'mastercard') {
    return (
      <View style={style}>
        <Svg width={TILE_W} height={TILE_H} viewBox="0 0 48 32">
          <Rect x="0" y="0" width="48" height="32" rx="4" fill="#FFFFFF" />
          <G>
            <Circle cx="20" cy="16" r="9" fill="#EB001B" />
            <Circle cx="28" cy="16" r="9" fill="#F79E1B" />
            <Path
              d="M24 9.5 a9 9 0 0 1 0 13 a9 9 0 0 1 0 -13z"
              fill="#FF5F00"
            />
          </G>
        </Svg>
      </View>
    );
  }

  if (normalized === 'amex') {
    return (
      <View style={style}>
        <Svg width={TILE_W} height={TILE_H} viewBox="0 0 48 32">
          <Rect x="0" y="0" width="48" height="32" rx="4" fill="#2E77BC" />
          <SvgText
            x="24"
            y="20"
            fill="#FFFFFF"
            fontSize="9"
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="System"
            letterSpacing="0.5"
          >
            AMEX
          </SvgText>
        </Svg>
      </View>
    );
  }

  // Unknown brand: render a 4-char text chip on the supplied background.
  const label = (brand ?? '').slice(0, 4).toUpperCase() || 'CARD';
  return (
    <View style={style}>
      <Svg width={TILE_W} height={TILE_H} viewBox="0 0 48 32">
        <Rect x="0" y="0" width="48" height="32" rx="4" fill={background} />
        <SvgText
          x="24"
          y="20"
          fill={textColor}
          fontSize="10"
          fontWeight="bold"
          textAnchor="middle"
          fontFamily="System"
        >
          {label}
        </SvgText>
      </Svg>
    </View>
  );
}
