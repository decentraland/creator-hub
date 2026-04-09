import React, { useCallback } from 'react'
import { useDrop } from 'react-dnd'
import { useAppDispatch, useAppSelector } from '../../../redux/hooks'
import {
  selectActiveDocument,
  selectSelectedElementId,
  selectElement,
  addElement,
  removeElement,
  moveElement,
} from '../../../redux/ui-editor'
import { DELETE, BACKSPACE, useHotkey } from '../../../hooks/useHotkey'
import { DropTypesEnum } from '../../../lib/sdk/drag-drop'
import type { UiElementType } from '../types'
import { createDefaultElement } from '../element-defaults'
import UiCanvasElement from './UiCanvasElement'
import './UiCanvas.css'

const UiCanvas: React.FC = () => {
  const document = useAppSelector(selectActiveDocument)
  const selectedElementId = useAppSelector(selectSelectedElementId)
  const dispatch = useAppDispatch()

  const handleDelete = useCallback(() => {
    if (selectedElementId && document && selectedElementId !== document.rootId) {
      dispatch(removeElement(selectedElementId))
    }
  }, [dispatch, selectedElementId, document])

  useHotkey([DELETE, BACKSPACE], handleDelete)

  const [{ isOver }, drop] = useDrop(() => ({
    accept: [DropTypesEnum.UiElement, DropTypesEnum.UiElementRearrange],
    drop: (item: { elementType?: UiElementType; elementId?: string }, monitor) => {
      if (monitor.didDrop()) return
      if (!document) return
      if (item.elementType) {
        const newEl = createDefaultElement(item.elementType, document.rootId)
        dispatch(addElement({ parentId: document.rootId, element: newEl }))
      } else if (item.elementId) {
        dispatch(moveElement({ elementId: item.elementId, newParentId: document.rootId }))
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  }), [document, dispatch])

  const handleCanvasClick = useCallback(() => {
    if (document) {
      dispatch(selectElement(document.rootId))
    }
  }, [dispatch, document])

  if (!document) {
    return (
      <div className="UiCanvas empty">
        <span>No UI document selected</span>
      </div>
    )
  }

  const { canvasWidth, canvasHeight } = document.metadata

  return (
    <div className="UiCanvas" onClick={handleCanvasClick}>
      <div className="canvas-viewport-wrapper">
        <div
          ref={drop}
          className={`canvas-viewport ${isOver ? 'drop-active' : ''}`}
          style={{
            width: canvasWidth,
            height: canvasHeight,
          }}
        >
          <UiCanvasElement elementId={document.rootId} document={document} />
        </div>
      </div>
    </div>
  )
}

export default React.memo(UiCanvas)
