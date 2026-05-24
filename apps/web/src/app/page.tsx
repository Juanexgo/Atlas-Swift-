import { AtlasShell } from '@/features/atlas-shell/AtlasShell';

/**
 * The single canvas page. Atlas is intentionally a one-route app — the
 * canvas is the home. Detail views render as overlays, not routes.
 *
 * (We could split this into `/graph` vs `/projects` later, but the
 * spatial model is the navigation primitive.)
 */
export default function Page() {
  return <AtlasShell />;
}
