// Material Symbols render via ligature: the icon name is real text content, so
// without aria-hidden a screen reader announces controls as "stethoscope 2
// Doctors". Icons here are always decorative — the control carries its own
// label — so they are hidden from assistive technology.
export default function Icon({ name, size = 20, style }) {
  return (
    <span
      className="material-symbols-outlined"
      aria-hidden="true"
      translate="no"
      style={{ fontSize: size, ...style }}
    >
      {name}
    </span>
  );
}
