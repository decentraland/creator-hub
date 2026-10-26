import React from 'react';

// Drawn to the Figma spec: react-icons 4.x has no list-with-chevrons icon.
function ListChevronsIcon({ chevrons }: { chevrons: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={`M3 6.6h10M3 11.6h10M3 16.6h10${chevrons}`} />
    </svg>
  );
}

export function ListChevronsDownUpIcon() {
  return <ListChevronsIcon chevrons="M16.5 6.6l2 2 2-2M16.5 16.6l2-2 2 2" />;
}

export function ListChevronsUpDownIcon() {
  return <ListChevronsIcon chevrons="M16.5 8.6l2-2 2 2M16.5 14.6l2 2 2-2" />;
}
