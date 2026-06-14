import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  type MetaFunction,
  type LinksFunction,
} from 'react-router';

import '../styles.css';
import { ThemeProvider } from '@klank/ui';
import { useKlankStore } from '@klank/store'
import { ErrorBoundary } from './components/ErrorBoundary';
import { useEffect } from 'react';

export const meta: MetaFunction = () => [
  {
    title: 'Klank',
  },
];

export const links: LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,100..700;1,100..700&display=swap',
  },
];

// Export HydrateFallback for SPA mode loading
export function HydrateFallback() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontFamily: 'Roboto Mono, monospace'
    }}>
      Loading...
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const activeTheme = useKlankStore().theme
  const themeColor = activeTheme === 'Dark' ? '#020202' : '#fdfdfd'

  useEffect(() => {
    let tag = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!tag) {
      tag = document.createElement('meta')
      tag.name = 'theme-color'
      document.head.appendChild(tag)
    }
    tag.content = themeColor
  }, [themeColor])

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-visual" />
        <meta name="theme-color" content={themeColor} />
        <Meta />
        <Links />
      </head>
      <ThemeProvider theme={activeTheme}>
        {children}
        <ScrollRestoration />
        <Scripts />
      </ThemeProvider>
    </html>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Outlet />
    </ErrorBoundary>
  );
}
