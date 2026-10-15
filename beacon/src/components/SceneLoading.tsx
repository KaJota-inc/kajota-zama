/**
 * Suspense fallback for the three lazy-loaded 3D scenes. Keeps the same
 * `.scene-wrap` chrome the loaded scene uses, so the toggle-to-3D flash
 * doesn't jump the page layout. One line of status text; no spinner —
 * the chunk is ~240 kB gzipped and lands in a tick on modern links, so a
 * spinner is more noise than signal.
 */
export function SceneLoading() {
  return (
    <div className="scene-wrap scene-loading">
      <div className="scene scene-loading-body">
        <span>loading 3D scene…</span>
      </div>
    </div>
  );
}
