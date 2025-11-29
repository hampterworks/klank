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

  return <body
    className={className ?? ''}
    style={{
      ...themeVariables,
      ...style
    } as React.CSSProperties & Record<string, string | number>}

  >
  {children}
  </body>;
}

export default ThemeProvider
