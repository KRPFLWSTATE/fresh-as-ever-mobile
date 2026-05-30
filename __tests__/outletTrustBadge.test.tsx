/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { OutletTrustBadge } from '../src/components/OutletTrustBadge';
import { StitchThemeProvider } from '../src/theme/StitchThemeContext';

function renderBadge(props: React.ComponentProps<typeof OutletTrustBadge>) {
  let tree: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <StitchThemeProvider>
        <OutletTrustBadge {...props} />
      </StitchThemeProvider>,
    );
  });
  return tree!;
}

function findText(tree: ReactTestRenderer.ReactTestRenderer, text: string): boolean {
  const json = tree.toJSON();
  if (!json) return false;
  const walk = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false;
    const n = node as { children?: unknown[]; props?: { children?: unknown } };
    if (Array.isArray(n.children)) {
      return n.children.some((child) => {
        if (typeof child === 'string') return child.includes(text);
        return walk(child);
      });
    }
    if (typeof n.props?.children === 'string') {
      return n.props.children.includes(text);
    }
    return false;
  };
  return walk(json);
}

describe('OutletTrustBadge', () => {
  it('renders New outlet when trust score is null', () => {
    const tree = renderBadge({ trustScore: null, showInfo: false });
    expect(findText(tree, 'New outlet')).toBe(true);
  });

  it('renders formatted score when trust is set', () => {
    const tree = renderBadge({ trustScore: 4.2, showInfo: false });
    expect(findText(tree, '4.2')).toBe(true);
  });

  it('shows info affordance when trust score is set', () => {
    const tree = renderBadge({
      trustScore: 4.5,
      averageRating: 4.5,
      totalReviews: 12,
      collectionRatePct: 95,
    });
    const pressables = tree.root.findAll(
      (node) => typeof node.props?.onPress === 'function',
    );
    expect(pressables.length).toBeGreaterThan(0);
  });
});
