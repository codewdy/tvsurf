import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/tv-list.tsx"),
  route("add-tv", "routes/add-tv.tsx"),
  route("series-list", "routes/series-list.tsx"),
  route("downloads", "routes/downloads.tsx"),
  route("errors", "routes/errors.tsx"),
  route("system-setup", "routes/system-setup.tsx"),
  route("login", "routes/login.tsx"),
] satisfies RouteConfig;
