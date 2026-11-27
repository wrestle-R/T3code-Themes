'use client';

import { createContext } from 'react';

export const PreviewStyles = createContext('');

export function PreviewStylesProvider({ css, children }) {
  return <PreviewStyles.Provider value={css}>{children}</PreviewStyles.Provider>;
}
