import React from 'react'
import { useDrag } from 'react-dnd'
import { BiSquare } from 'react-icons/bi'
import { MdTextFields, MdSmartButton, MdInput, MdArrowDropDownCircle } from 'react-icons/md'
import { DropTypesEnum } from '../../../lib/sdk/drag-drop'
import type { UiElementType } from '../types'
import './UiElementPalette.css'

interface PaletteItem {
  type: UiElementType
  label: string
  icon: React.ReactNode
}

const PALETTE_ITEMS: PaletteItem[] = [
  { type: 'container', label: 'Container', icon: <BiSquare /> },
  { type: 'label', label: 'Label', icon: <MdTextFields /> },
  { type: 'button', label: 'Button', icon: <MdSmartButton /> },
  { type: 'input', label: 'Input', icon: <MdInput /> },
  { type: 'dropdown', label: 'Dropdown', icon: <MdArrowDropDownCircle /> },
]

const DraggablePaletteItem: React.FC<{ item: PaletteItem }> = ({ item }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: DropTypesEnum.UiElement,
    item: { elementType: item.type },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [item.type])

  return (
    <div
      ref={drag}
      className={`palette-item ${isDragging ? 'dragging' : ''}`}
    >
      <span className="palette-icon">{item.icon}</span>
      <span className="palette-label">{item.label}</span>
    </div>
  )
}

const UiElementPalette: React.FC = () => {
  return (
    <div className="UiElementPalette">
      <div className="palette-header">Elements</div>
      <div className="palette-grid">
        {PALETTE_ITEMS.map((item) => (
          <DraggablePaletteItem key={item.type} item={item} />
        ))}
      </div>
    </div>
  )
}

export default React.memo(UiElementPalette)
