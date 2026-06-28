export default function Logo({ size = 20, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="1" y="1" width="30" height="30" rx="8" fill={color} opacity="0.15" />
      <rect x="1" y="1" width="30" height="30" rx="8" stroke={color} strokeWidth="1.5" opacity="0.3" />
      <path d="M16 8v16M8 16h16" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
