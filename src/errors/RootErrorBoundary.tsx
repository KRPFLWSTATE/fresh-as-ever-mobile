import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ERROR } from '@/lib/messages/errors';

type Props = { children: ReactNode };
type State = { err: Error | null };

/** Cross-root recovery surface (plan § vx-error-boundaries-per-nav-root-instrumented). */
export class RootErrorBoundary extends Component<Props, State> {
  override state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (__DEV__) {
      console.warn('[RootErrorBoundary]', error.message, info.componentStack);
    }
  }

  handleReset = (): void => {
    this.setState({ err: null });
  };

  override render(): ReactNode {
    if (this.state.err) {
      return (
        <View style={styles.box}>
          <Text style={styles.title}>{ERROR.common.fallback}</Text>
          <Text style={styles.detail}>
            {__DEV__ && this.state.err.message
              ? this.state.err.message
              : 'Tap try again to recover.'}
          </Text>
          <Pressable style={styles.btn} onPress={this.handleReset}>
            <Text style={styles.btnTxt}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#fff',
    gap: 14,
  },
  title: { fontSize: 22, fontWeight: '800' },
  detail: { opacity: 0.76, fontSize: 15, lineHeight: 21 },
  btn: {
    marginTop: 10,
    backgroundColor: '#01696f',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnTxt: { color: '#fff', fontWeight: '800' },
});
