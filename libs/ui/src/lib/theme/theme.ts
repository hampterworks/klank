export type Theme = 'Light' | 'Dark';

type CSSCustomProperties = {
  [key: `--${string}`]: string | number
}

export const getThemeVariables = (theme: Theme = 'Light'): CSSCustomProperties => {
  const themes = {
    Light: {
      '--klank-color-background': '#fdfdfd',
      '--klank-color-secondary-background': '#e3e3e3',
      '--klank-color-text': '#020202',
      '--klank-color-border': '#c1c1c1',
      '--klank-color-highlight': '#f3f3f3',
      '--klank-color-selected': '#ededed',
      '--klank-color-success': '#36b15d',
      '--klank-color-fail': '#b13636',
    },
    Dark: {
      '--klank-color-background': '#020202',
      '--klank-color-secondary-background': '#272727',
      '--klank-color-text': '#f6f6f6',
      '--klank-color-border': '#272727',
      '--klank-color-highlight': '#454545',
      '--klank-color-selected': '#616161',
      '--klank-color-success': '#36b15d',
      '--klank-color-fail': '#b13636',
    }
  }

  return themes[theme]
}
