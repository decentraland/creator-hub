import React from 'react'

interface Props {
  isSelected: boolean
  isHovered: boolean
}

const SelectionOverlay: React.FC<Props> = ({ isSelected, isHovered }) => {
  if (!isSelected && !isHovered) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        border: isSelected ? '2px solid #4285f4' : '1px dashed rgba(66, 133, 244, 0.6)',
        borderRadius: 2,
        zIndex: 9999,
      }}
    />
  )
}

export default React.memo(SelectionOverlay)
