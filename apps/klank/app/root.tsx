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
import { useKlankStore } from '@klank/store';

export const meta: MetaFunction = () => [
  {
    title: 'New Nx React Router App',
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

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
  return <Outlet />;
}
