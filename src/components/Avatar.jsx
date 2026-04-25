import { useState } from 'react';

/**
 * Returns initials from a full name (e.g., "John Doe" -> "JD")
 */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Generates a consistent background color based on string
 */
function getBgColor(name) {
  if (!name) return 'bg-zinc-800';
  const colors = [
    'bg-primary/20 text-primary',
    'bg-blue-500/20 text-blue-400',
    'bg-emerald-500/20 text-emerald-400',
    'bg-purple-500/20 text-purple-400',
    'bg-pink-500/20 text-pink-400',
    'bg-amber-500/20 text-amber-400'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-[10px]',
  md: 'w-10 h-10 text-xs',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-2xl'
};

export default function Avatar({ photoURL, name, size = 'md', className = '' }) {
  const [imageError, setImageError] = useState(false);
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  if (photoURL && !imageError) {
    return (
      <div className={`relative rounded-full overflow-hidden shrink-0 border border-white/10 ${sizeClass} ${className}`}>
        <img
          src={photoURL}
          alt={`${name}'s avatar`}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  const initials = getInitials(name);
  const colorClass = getBgColor(name);

  return (
    <div className={`rounded-full shrink-0 flex items-center justify-center font-black tracking-wider border border-white/5 ${sizeClass} ${colorClass} ${className}`}>
      {initials}
    </div>
  );
}
