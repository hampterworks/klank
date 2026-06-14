import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index('./app.tsx'),
  route('about', './routes/about.tsx'),
  route('settings', './routes/settings.tsx'),
  route('harmony', './routes/harmony.tsx'),
  ] satisfies RouteConfig;