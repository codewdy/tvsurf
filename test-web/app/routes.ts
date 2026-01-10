import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("search", "routes/search.tsx"),
  route("downloads", "routes/downloads.tsx"),
  route("errors", "routes/errors.tsx"),
  route("series", "routes/series.tsx"),
  route("tv-list", "routes/tv-list.tsx"),
  route("system_setup", "routes/system_setup.tsx"),
  route("login", "routes/login.tsx"),
  route("whoami", "routes/whoami.tsx"),
] satisfies RouteConfig;
