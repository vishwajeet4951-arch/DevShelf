import { createContext } from 'react';

export const ThemeContext = createContext({
  theme: 'dark',
  setTheme: () => {},
  resolvedTheme: 'dark',
});
