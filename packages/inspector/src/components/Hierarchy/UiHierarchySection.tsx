import React, { useCallback, useRef, useState } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import { IoIosArrowDown, IoIosArrowForward } from 'react-icons/io'
import { VscAdd, VscTrash } from 'react-icons/vsc'
import { useAppDispatch, useAppSelector } from '../../redux/hooks'
import {
  selectUiEditorDocuments,
  selectActiveDocumentPath,
  selectSelectedElementId,
  setActiveDocument,
  selectElement,
  createDocument,
  deleteDocument,
  removeElement,
  moveElement,
} from '../../redux/ui-editor'
import { DropTypesEnum } from '../../lib/sdk/drag-drop'
import { canRearrangeDrop } from '../UiEditor/utils/drag-drop-utils'
import type { UiEditorDocument, UiElementNode } from '../UiEditor/types'
import { createDefaultDocument } from '../UiEditor/element-defaults'
import './UiHierarchySection.css'

interface TreeNodeState {
  open: Set<string>
}

type DropZone = 'before' | 'after' | 'inside' | null

interface RearrangeDragItem {
  type: typeof DropTypesEnum.UiElementRearrange
  elementId: string
  parentId: string | null
}

const UiElementTreeNode: React.FC<{
  element: UiElementNode
  document: UiEditorDocument
  selectedElementId: string | null
  activeDocumentPath: string | null
  docPath: string
  treeState: TreeNodeState
  onToggle: (id: string) => void
  onSelect: (docPath: string, elementId: string) => void
  onRemove: (elementId: string) => void
  onMove: (elementId: string, newParentId: string, index?: number) => void
  level: number
}> = ({ element, document, selectedElementId, activeDocumentPath, docPath, treeState, onToggle, onSelect, onRemove, onMove, level }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [dropZone, setDropZone] = useState<DropZone>(null)
  const isSelected = activeDocumentPath === docPath && selectedElementId === element.id
  const isOpen = treeState.open.has(element.id)
  const hasChildren = element.children.length > 0
  const isRoot = document.rootId === element.id
  const isContainer = element.elementData.type === 'container'

  const [{ isDragging }, drag] = useDrag(() => ({
    type: DropTypesEnum.UiElementRearrange,
    item: { type: DropTypesEnum.UiElementRearrange, elementId: element.id, parentId: element.parentId } as RearrangeDragItem,
    canDrag: () => !isRoot,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [element.id, element.parentId, isRoot])

  const [{ isOver }, drop] = useDrop(() => ({
    accept: DropTypesEnum.UiElementRearrange,
    canDrop: (item: RearrangeDragItem) =>
      canRearrangeDrop(item.elementId, element.id, document.rootId, document.elements),
    hover: (item: RearrangeDragItem, monitor) => {
      if (!ref.current || !monitor.canDrop()) {
        setDropZone(null)
        return
      }
      const rect = ref.current.getBoundingClientRect()
      const y = monitor.getClientOffset()!.y - rect.top
      if (isContainer) {
        const third = rect.height / 3
        if (y < third) setDropZone('before')
        else if (y > third * 2) setDropZone('after')
        else setDropZone('inside')
      } else {
        const half = rect.height / 2
        if (y < half) setDropZone('before')
        else setDropZone('after')
      }
    },
    drop: (item: RearrangeDragItem, monitor) => {
      if (monitor.didDrop()) return
      if (!element.parentId && dropZone !== 'inside') return
      const parent = element.parentId ? document.elements[element.parentId] : null
      const siblingIndex = parent ? parent.children.indexOf(element.id) : -1
      if (dropZone === 'before' && element.parentId) {
        onMove(item.elementId, element.parentId, siblingIndex)
      } else if (dropZone === 'after' && element.parentId) {
        onMove(item.elementId, element.parentId, siblingIndex + 1)
      } else if (dropZone === 'inside') {
        onMove(item.elementId, element.id)
      }
      setDropZone(null)
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  }), [element, document, dropZone, onMove])

  // Clear drop zone when not hovering
  React.useEffect(() => {
    if (!isOver) setDropZone(null)
  }, [isOver])

  drag(drop(ref))

  const dropClass = isOver && dropZone ? `drop-${dropZone}` : ''

  return (
    <div className="ui-tree-node">
      <div
        ref={ref}
        className={`ui-tree-item ${isSelected ? 'selected' : ''} ${dropClass}`}
        style={{
          paddingLeft: level * 16,
          opacity: isDragging ? 0.4 : 1,
          cursor: isRoot ? 'default' : 'grab',
        }}
        onClick={() => onSelect(docPath, element.id)}
      >
        {hasChildren ? (
          <span
            className="ui-tree-toggle"
            onClick={(e) => {
              e.stopPropagation()
              onToggle(element.id)
            }}
          >
            {isOpen ? <IoIosArrowDown /> : <IoIosArrowForward />}
          </span>
        ) : (
          <span className="ui-tree-toggle-placeholder" />
        )}
        <span className="ui-tree-type-badge">{element.elementData.type[0].toUpperCase()}</span>
        <span className="ui-tree-label">{element.name}</span>
        {!isRoot && (
          <span
            className="ui-tree-action"
            onClick={(e) => {
              e.stopPropagation()
              onRemove(element.id)
            }}
          >
            <VscTrash />
          </span>
        )}
      </div>
      {isOpen && hasChildren && (
        <div className="ui-tree-children">
          {element.children.map(childId => {
            const child = document.elements[childId]
            if (!child) return null
            return (
              <UiElementTreeNode
                key={childId}
                element={child}
                document={document}
                selectedElementId={selectedElementId}
                activeDocumentPath={activeDocumentPath}
                docPath={docPath}
                treeState={treeState}
                onToggle={onToggle}
                onSelect={onSelect}
                onRemove={onRemove}
                onMove={onMove}
                level={level + 1}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

const UiHierarchySection: React.FC = () => {
  const documents = useAppSelector(selectUiEditorDocuments)
  const activeDocumentPath = useAppSelector(selectActiveDocumentPath)
  const selectedElementId = useAppSelector(selectSelectedElementId)
  const dispatch = useAppDispatch()
  const [sectionOpen, setSectionOpen] = useState(true)
  const [openDocs, setOpenDocs] = useState<Set<string>>(new Set())
  const [openElements, setOpenElements] = useState<Set<string>>(new Set())

  const docEntries = Object.entries(documents)

  const handleToggleDoc = useCallback((path: string) => {
    setOpenDocs(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const handleToggleElement = useCallback((id: string) => {
    setOpenElements(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelectElement = useCallback((docPath: string, elementId: string) => {
    dispatch(setActiveDocument(docPath))
    dispatch(selectElement(elementId))
  }, [dispatch])

  const handleRemoveElement = useCallback((elementId: string) => {
    dispatch(removeElement(elementId))
  }, [dispatch])

  const handleMoveElement = useCallback((elementId: string, newParentId: string, index?: number) => {
    dispatch(moveElement({ elementId, newParentId, index }))
  }, [dispatch])

  const handleCreateDocument = useCallback(() => {
    const name = `MyUI${docEntries.length + 1}`
    const doc = createDefaultDocument(name)
    const path = `assets/scene/ui/${name.toLowerCase().replace(/\s+/g, '-')}.ui.json`
    dispatch(createDocument({ path, document: doc }))
    setOpenDocs(prev => new Set(prev).add(path))
  }, [dispatch, docEntries.length])

  const handleDeleteDocument = useCallback((e: React.MouseEvent, path: string) => {
    e.stopPropagation()
    dispatch(deleteDocument(path))
  }, [dispatch])

  const treeState: TreeNodeState = { open: openElements }

  return (
    <div className="UiHierarchySection">
      <div
        className="ui-section-header"
        onClick={() => setSectionOpen(!sectionOpen)}
      >
        {sectionOpen ? <IoIosArrowDown /> : <IoIosArrowForward />}
        <span className="ui-section-title">UI</span>
        <span
          className="ui-section-action"
          onClick={(e) => {
            e.stopPropagation()
            handleCreateDocument()
          }}
          title="Create UI"
        >
          <VscAdd />
        </span>
      </div>
      {sectionOpen && (
        <div className="ui-section-content">
          {docEntries.length === 0 && (
            <div className="ui-empty-message">No UI documents. Click + to create one.</div>
          )}
          {docEntries.map(([path, doc]) => {
            const isDocOpen = openDocs.has(path)
            return (
              <div key={path} className="ui-doc-node">
                <div
                  className={`ui-doc-header ${activeDocumentPath === path ? 'active' : ''}`}
                  onClick={() => {
                    handleToggleDoc(path)
                    dispatch(setActiveDocument(path))
                    dispatch(selectElement(doc.rootId))
                  }}
                >
                  {isDocOpen ? <IoIosArrowDown /> : <IoIosArrowForward />}
                  <span className="ui-doc-name">{doc.metadata.name}</span>
                  <span
                    className="ui-tree-action"
                    onClick={(e) => handleDeleteDocument(e, path)}
                  >
                    <VscTrash />
                  </span>
                </div>
                {isDocOpen && (
                  <UiElementTreeNode
                    element={doc.elements[doc.rootId]}
                    document={doc}
                    selectedElementId={selectedElementId}
                    activeDocumentPath={activeDocumentPath}
                    docPath={path}
                    treeState={treeState}
                    onToggle={handleToggleElement}
                    onSelect={handleSelectElement}
                    onRemove={handleRemoveElement}
                    onMove={handleMoveElement}
                    level={2}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default React.memo(UiHierarchySection)
