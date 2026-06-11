import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { LocationSearchField } from '@/components/LocationSearchField';
import { useLocationSearch } from '@/hooks/useLocationSearch';

jest.mock('@/hooks/useLocationSearch', () => ({
  useLocationSearch: jest.fn(),
}));

jest.mock('@/theme/StitchThemeContext', () => ({
  useStitchTheme: () => ({
    colors: {
      surface: '#fff',
      outlineVariant: '#ccc',
      text: '#111',
      textFaint: '#999',
      primaryContainer: '#0a0',
      error: '#f00',
      textMuted: '#666',
      onSurface: '#111',
    },
    spacing: { xs: 4, sm: 8, md: 12 },
  }),
}));

jest.mock('@/ui/stitch', () => ({
  StitchIcon: () => null,
  StitchText: ({ children }: { children: React.ReactNode }) => children,
}));

const env = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  apiBaseUrl: '',
  payHereReturnHost: '',
};

describe('LocationSearchField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useLocationSearch as jest.Mock).mockReturnValue({
      suggestions: [],
      busy: false,
      error: null,
      clearSuggestions: jest.fn(),
      clearError: jest.fn(),
    });
  });

  it('defers external value sync while focused', async () => {
    const onChange = jest.fn();
    const onEditing = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <LocationSearchField
          env={env}
          value="Colombo 07"
          onChangeText={onChange}
          onSelectHit={jest.fn()}
          onEditingChange={onEditing}
        />,
      );
    });

    const input = renderer!.root.findByType(TextInput);
    expect(input.props.value).toBe('Colombo 07');

    await act(async () => {
      input.props.onFocus();
    });
    expect(onEditing).toHaveBeenCalledWith(true);

    const inputEditing = renderer!.root.findByType(TextInput);
    await act(async () => {
      inputEditing.props.onChangeText('12 Ward Place, Colombo 07');
    });
    expect(renderer!.root.findByType(TextInput).props.value).toBe(
      '12 Ward Place, Colombo 07',
    );

    await act(async () => {
      renderer!.update(
        <LocationSearchField
          env={env}
          value="Colombo 07, Sri Lanka"
          onChangeText={onChange}
          onSelectHit={jest.fn()}
          onEditingChange={onEditing}
        />,
      );
    });

    const inputWhileFocused = renderer!.root.findByType(TextInput);
    expect(inputWhileFocused.props.value).toBe('12 Ward Place, Colombo 07');

    await act(async () => {
      inputWhileFocused.props.onBlur();
    });
    expect(onEditing).toHaveBeenCalledWith(false);

    await act(async () => {
      renderer!.update(
        <LocationSearchField
          env={env}
          value="Colombo 07, Sri Lanka"
          onChangeText={onChange}
          onSelectHit={jest.fn()}
          onEditingChange={onEditing}
        />,
      );
    });

    const inputAfterBlur = renderer!.root.findByType(TextInput);
    expect(inputAfterBlur.props.value).toBe('Colombo 07, Sri Lanka');
  });
});
