export const ROUTES = ['/train', '/timer', '/cases', '/stats', '/settings'] as const;
export type Route = (typeof ROUTES)[number];

export function normalizeRoute(hash: string): Route {
  const path = hash.replace(/^#/, '');
  return (ROUTES as readonly string[]).includes(path) ? (path as Route) : '/train';
}

const state = $state({ route: '/train' as Route });

if (typeof window !== 'undefined') {
  state.route = normalizeRoute(window.location.hash);
  window.addEventListener('hashchange', () => {
    state.route = normalizeRoute(window.location.hash);
  });
}

export function currentRoute(): Route {
  return state.route;
}

export function navigate(path: Route): void {
  window.location.hash = path;
}
