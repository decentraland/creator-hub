import React from 'react';

// Figma "FolderOpen" glyph from the 3D Editor Bottom Panel (folder tree rows and folder cards,
// which scale it through their own CSS size). Painted with the row's colour.
function Folder() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M11.6667 3.5H7L6.1775 2.6775C5.95583 2.45583 5.65833 2.33333 5.34917 2.33333H2.33333C1.69167 2.33333 1.1725 2.85833 1.1725 3.5L1.16667 10.5C1.16667 11.1417 1.69167 11.6667 2.33333 11.6667H11.6667C12.3083 11.6667 12.8333 11.1417 12.8333 10.5V4.66667C12.8333 4.025 12.3083 3.5 11.6667 3.5ZM11.0833 10.5H2.91667C2.59583 10.5 2.33333 10.2375 2.33333 9.91667V5.25C2.33333 4.92917 2.59583 4.66667 2.91667 4.66667H11.0833C11.4042 4.66667 11.6667 4.92917 11.6667 5.25V9.91667C11.6667 10.2375 11.4042 10.5 11.0833 10.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default Folder;
