import { createRoutesStub } from 'react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../../app/app';

test('renders the main app layout', async () => {
  const ReactRouterStub = createRoutesStub([
    {
      path: '/',
      Component: App,
    },
  ]);

  render(<ReactRouterStub />);

  await waitFor(() => screen.findByText('KLANK'));
});
