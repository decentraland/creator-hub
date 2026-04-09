import React, { useCallback, useRef } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import { useAppDispatch, useAppSelector } from '../../../redux/hooks'
import {
  selectSelectedElementId,
  selectHoveredElementId,
  selectElement,
  hoverElement,
  addElement,
  moveElement,
} from '../../../redux/ui-editor'
import { DropTypesEnum } from '../../../lib/sdk/drag-drop'
import { canRearrangeDrop } from '../utils/drag-drop-utils'
import type { UiEditorDocument, UiElementType } from '../types'
import { createDefaultElement } from '../element-defaults'
import { transformToCSS, backgroundToCSS, colorToCSS } from './transform-to-css'
import SelectionOverlay from './SelectionOverlay'

interface Props {
  elementId: string
  document: UiEditorDocument
}

const UiCanvasElement: React.FC<Props> = ({ elementId, document }) => {
  const element = document.elements[elementId]
  const selectedId = useAppSelector(selectSelectedElementId)
  const hoveredId = useAppSelector(selectHoveredElementId)
  const dispatch = useAppDispatch()
  const ref = useRef<HTMLDivElement>(null)

  const isContainer = element?.elementData.type === 'container'
  const isRoot = element ? document.rootId === elementId : false
  const isSelected = selectedId === elementId
  const isHovered = hoveredId === elementId

  const [{ isDragging }, drag] = useDrag(() => ({
    type: DropTypesEnum.UiElementRearrange,
    item: { type: DropTypesEnum.UiElementRearrange, elementId },
    canDrag: () => !isRoot,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [elementId, isRoot])

  const [{ isOver, canDrop: canDropHere }, drop] = useDrop(() => ({
    accept: [DropTypesEnum.UiElement, DropTypesEnum.UiElementRearrange],
    canDrop: (item: { elementType?: UiElementType; elementId?: string }, monitor) => {
      if (!monitor.isOver({ shallow: true })) return false
      if (item.elementType) return isContainer
      if (item.elementId) return isContainer && canRearrangeDrop(item.elementId, elementId, document.rootId, document.elements)
      return false
    },
    drop: (item: { elementType?: UiElementType; elementId?: string }, monitor) => {
      if (!monitor.isOver({ shallow: true })) return undefined
      if (item.elementType) {
        const newEl = createDefaultElement(item.elementType, elementId)
        dispatch(addElement({ parentId: elementId, element: newEl }))
      } else if (item.elementId) {
        dispatch(moveElement({ elementId: item.elementId, newParentId: elementId }))
      }
      return { handled: true }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  }), [elementId, isContainer, document, dispatch])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch(selectElement(elementId))
  }, [dispatch, elementId])

  const handleMouseEnter = useCallback(() => {
    dispatch(hoverElement(elementId))
  }, [dispatch, elementId])

  const handleMouseLeave = useCallback(() => {
    dispatch(hoverElement(null))
  }, [dispatch])

  if (!element) return null

  drag(drop(ref))

  const transformStyle = transformToCSS(element.transform)
  const bgStyle = backgroundToCSS(element.background)
  const showDropHighlight = isOver && canDropHere
  const combinedStyle: React.CSSProperties = {
    ...transformStyle,
    ...bgStyle,
    position: element.transform.positionType === 'absolute' ? 'absolute' : 'relative',
    outline: showDropHighlight ? '2px dashed #4285f4' : undefined,
    minHeight: isContainer && element.children.length === 0 ? 32 : undefined,
    opacity: isDragging ? 0.4 : undefined,
    cursor: isRoot ? undefined : 'grab',
  }

  const renderContent = () => {
    const { elementData } = element
    switch (elementData.type) {
      case 'label':
        return (
          <span style={{
            fontSize: elementData.fontSize,
            color: colorToCSS(elementData.color),
            fontFamily: elementData.font,
            whiteSpace: elementData.textWrap === 'nowrap' ? 'nowrap' : 'normal',
            pointerEvents: 'none',
          }}>
            {elementData.value}
          </span>
        )
      case 'button':
        return (
          <span style={{
            fontSize: elementData.fontSize,
            color: colorToCSS(elementData.color),
            fontFamily: elementData.font,
            opacity: elementData.disabled ? 0.5 : 1,
            pointerEvents: 'none',
          }}>
            {elementData.value}
          </span>
        )
      case 'input':
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            height: '100%',
            fontSize: elementData.fontSize,
            color: elementData.value ? colorToCSS(elementData.color) : colorToCSS(elementData.placeholderColor),
            fontFamily: elementData.font,
            padding: '0 8px',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.15)',
            opacity: elementData.disabled ? 0.5 : 1,
            pointerEvents: 'none',
          }}>
            {elementData.value || elementData.placeholder}
          </div>
        )
      case 'dropdown':
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            height: '100%',
            fontSize: elementData.fontSize,
            color: colorToCSS(elementData.color),
            fontFamily: elementData.font,
            padding: '0 8px',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.15)',
            opacity: elementData.disabled ? 0.5 : 1,
            pointerEvents: 'none',
          }}>
            <span>{elementData.options[elementData.selectedIndex] ?? elementData.emptyLabel}</span>
            <span>&#9662;</span>
          </div>
        )
      case 'container':
      default:
        return null
    }
  }

  return (
    <div
      ref={ref}
      style={combinedStyle}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SelectionOverlay isSelected={isSelected} isHovered={isHovered && !isSelected} />
      {renderContent()}
      {element.children.map(childId => (
        <UiCanvasElement key={childId} elementId={childId} document={document} />
      ))}
    </div>
  )
}

export default React.memo(UiCanvasElement)
