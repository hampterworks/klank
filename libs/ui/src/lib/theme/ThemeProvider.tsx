import { useEffect } from 'react';
import { getThemeVariables, Theme } from './theme';

type ThemeProviderProps = {
  theme: Theme;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  theme,
  style,
  className,
  children,
}) => {
  const themeVariables = getThemeVariables(theme)

  useEffect(() => {
    const variables = getThemeVariables(theme);
    for (const [key, value] of Object.entries(variables)) {
      document.body.style.setProperty(key, String(value));
    }
    document.body.style.colorScheme = theme === 'Dark' ? 'dark' : 'light';
  }, [theme]);

  return <body
    className={className ?? ''}
    style={{
      ...themeVariables,
      colorScheme: theme === 'Dark' ? 'dark' : 'light',
      ...style
    } as React.CSSProperties & Record<string, string | number>}

  >
  {children}
  </body>;
}
