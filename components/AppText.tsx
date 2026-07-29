// components/AppText.tsx
//
// Drop-in replacement for RN's <Text>, so the JetBrains Mono font choice
// lives in one place instead of being repeated on every style object.
// Every screen imports Text from here, not from 'react-native'.

import React from 'react';
import { Text, TextProps } from 'react-native';

export const FONT_FAMILY = {
  header: 'JetBrainsMono_800ExtraBold',
  body: 'JetBrainsMono_400Regular',
};

interface AppTextProps extends TextProps {
  /** 'header' = Extra Bold, for titles/section headers. 'body' (default) = Regular, for everything else. */
  variant?: 'header' | 'body';
}

export default function AppText({ variant = 'body', style, ...rest }: AppTextProps) {
  return <Text style={[{ fontFamily: FONT_FAMILY[variant] }, style]} {...rest} />;
}
