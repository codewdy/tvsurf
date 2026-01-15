import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/tv-list.tsx"),
  route("add-tv", "routes/add-tv.tsx"),
  route("series-list", "routes/series-list.tsx"),
  route("series/:id", "routes/series-details.tsx"),
  route("tv/:id", "routes/tv-details.tsx"),
  route("downloads", "routes/downloads.tsx"),
  route("errors", "routes/errors.tsx"),
  route("config", "routes/config.tsx"),
  route("system-setup", "routes/system-setup.tsx"),
  route("login", "routes/login.tsx"),
  route("user", "routes/user.tsx"),
] satisfies RouteConfig;
