export default function Icon({ name, size = 20, style }) {
  return <span className="material-symbols-outlined" style={{ fontSize: size, ...style }}>{name}</span>;
}
