import Image from 'next/image';

export function PlaceholderImage() {
  return (
    <div className="relative w-full h-full bg-muted flex items-center justify-center">
      <svg
        className="w-12 h-12 text-muted-foreground"
        fill="none"
        height="24"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      </svg>
    </div>
  );
} 