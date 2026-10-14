export type View = "2d" | "3d";

export function ViewToggle({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}) {
  return (
    <div className="view-toggle" role="radiogroup" aria-label="View">
      <button
        role="radio"
        aria-checked={view === "2d"}
        onClick={() => onChange("2d")}
        className={view === "2d" ? "active" : ""}
      >
        2D
      </button>
      <button
        role="radio"
        aria-checked={view === "3d"}
        onClick={() => onChange("3d")}
        className={view === "3d" ? "active" : ""}
      >
        3D
      </button>
    </div>
  );
}
