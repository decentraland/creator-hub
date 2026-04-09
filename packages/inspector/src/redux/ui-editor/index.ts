import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { RootState } from '../store'
import type {
  UiEditorDocument,
  UiElementNode,
  UiElementType,
  UiTransformData,
  UiBackgroundData,
  UiEventsData,
  UiElementData,
} from '../../components/UiEditor/types'

export interface UiEditorState {
  documents: Record<string, UiEditorDocument>
  activeDocumentPath: string | null
  selectedElementId: string | null
  hoveredElementId: string | null
  isDirty: boolean
  undoStack: UiEditorDocument[]
  redoStack: UiEditorDocument[]
}

export const initialState: UiEditorState = {
  documents: {},
  activeDocumentPath: null,
  selectedElementId: null,
  hoveredElementId: null,
  isDirty: false,
  undoStack: [],
  redoStack: [],
}

function getActiveDocument(state: UiEditorState): UiEditorDocument | null {
  if (!state.activeDocumentPath) return null
  return state.documents[state.activeDocumentPath] ?? null
}

function pushUndo(state: UiEditorState, doc: UiEditorDocument) {
  state.undoStack.push(JSON.parse(JSON.stringify(doc)))
  state.redoStack = []
  if (state.undoStack.length > 50) {
    state.undoStack.shift()
  }
}

const uiEditorSlice = createSlice({
  name: 'uiEditor',
  initialState,
  reducers: {
    loadDocuments(state, { payload }: PayloadAction<Record<string, UiEditorDocument>>) {
      state.documents = { ...state.documents, ...payload }
    },
    setActiveDocument(state, { payload }: PayloadAction<string | null>) {
      state.activeDocumentPath = payload
      state.selectedElementId = null
      state.hoveredElementId = null
      state.undoStack = []
      state.redoStack = []
    },
    selectElement(state, { payload }: PayloadAction<string | null>) {
      state.selectedElementId = payload
    },
    hoverElement(state, { payload }: PayloadAction<string | null>) {
      state.hoveredElementId = payload
    },
    addElement(
      state,
      { payload }: PayloadAction<{ parentId: string; element: UiElementNode; index?: number }>,
    ) {
      const doc = getActiveDocument(state)
      if (!doc) return
      pushUndo(state, doc)
      const { parentId, element, index } = payload
      doc.elements[element.id] = element
      const parent = doc.elements[parentId]
      if (parent) {
        if (index !== undefined && index >= 0 && index <= parent.children.length) {
          parent.children.splice(index, 0, element.id)
        } else {
          parent.children.push(element.id)
        }
      }
      state.isDirty = true
    },
    removeElement(state, { payload }: PayloadAction<string>) {
      const doc = getActiveDocument(state)
      if (!doc) return
      if (payload === doc.rootId) return
      pushUndo(state, doc)
      const removeRecursive = (id: string) => {
        const el = doc.elements[id]
        if (!el) return
        for (const childId of el.children) {
          removeRecursive(childId)
        }
        if (el.parentId && doc.elements[el.parentId]) {
          doc.elements[el.parentId].children = doc.elements[el.parentId].children.filter(
            (c) => c !== id,
          )
        }
        delete doc.elements[id]
      }
      removeRecursive(payload)
      if (state.selectedElementId === payload) {
        state.selectedElementId = null
      }
      state.isDirty = true
    },
    moveElement(
      state,
      { payload }: PayloadAction<{ elementId: string; newParentId: string; index?: number }>,
    ) {
      const doc = getActiveDocument(state)
      if (!doc) return
      const el = doc.elements[payload.elementId]
      if (!el || payload.elementId === doc.rootId) return
      pushUndo(state, doc)
      if (el.parentId && doc.elements[el.parentId]) {
        doc.elements[el.parentId].children = doc.elements[el.parentId].children.filter(
          (c) => c !== payload.elementId,
        )
      }
      el.parentId = payload.newParentId
      const newParent = doc.elements[payload.newParentId]
      if (newParent) {
        if (
          payload.index !== undefined &&
          payload.index >= 0 &&
          payload.index <= newParent.children.length
        ) {
          newParent.children.splice(payload.index, 0, payload.elementId)
        } else {
          newParent.children.push(payload.elementId)
        }
      }
      state.isDirty = true
    },
    updateElementTransform(
      state,
      { payload }: PayloadAction<{ elementId: string; transform: Partial<UiTransformData> }>,
    ) {
      const doc = getActiveDocument(state)
      if (!doc) return
      const el = doc.elements[payload.elementId]
      if (!el) return
      pushUndo(state, doc)
      el.transform = { ...el.transform, ...payload.transform }
      state.isDirty = true
    },
    updateElementBackground(
      state,
      { payload }: PayloadAction<{ elementId: string; background: Partial<UiBackgroundData> }>,
    ) {
      const doc = getActiveDocument(state)
      if (!doc) return
      const el = doc.elements[payload.elementId]
      if (!el) return
      pushUndo(state, doc)
      el.background = { ...el.background, ...payload.background }
      state.isDirty = true
    },
    updateElementEvents(
      state,
      { payload }: PayloadAction<{ elementId: string; events: Partial<UiEventsData> }>,
    ) {
      const doc = getActiveDocument(state)
      if (!doc) return
      const el = doc.elements[payload.elementId]
      if (!el) return
      pushUndo(state, doc)
      el.events = { ...el.events, ...payload.events }
      state.isDirty = true
    },
    updateElementData(
      state,
      { payload }: PayloadAction<{ elementId: string; data: Partial<UiElementData> }>,
    ) {
      const doc = getActiveDocument(state)
      if (!doc) return
      const el = doc.elements[payload.elementId]
      if (!el) return
      pushUndo(state, doc)
      el.elementData = { ...el.elementData, ...payload.data } as UiElementData
      state.isDirty = true
    },
    renameElement(state, { payload }: PayloadAction<{ elementId: string; name: string }>) {
      const doc = getActiveDocument(state)
      if (!doc) return
      const el = doc.elements[payload.elementId]
      if (!el) return
      pushUndo(state, doc)
      el.name = payload.name
      state.isDirty = true
    },
    reorderChildren(
      state,
      { payload }: PayloadAction<{ parentId: string; childIds: string[] }>,
    ) {
      const doc = getActiveDocument(state)
      if (!doc) return
      const parent = doc.elements[payload.parentId]
      if (!parent) return
      pushUndo(state, doc)
      parent.children = payload.childIds
      state.isDirty = true
    },
    createDocument(state, { payload }: PayloadAction<{ path: string; document: UiEditorDocument }>) {
      state.documents[payload.path] = payload.document
      state.isDirty = true
    },
    deleteDocument(state, { payload }: PayloadAction<string>) {
      delete state.documents[payload]
      if (state.activeDocumentPath === payload) {
        state.activeDocumentPath = null
        state.selectedElementId = null
        state.hoveredElementId = null
      }
      state.isDirty = true
    },
    undo(state) {
      if (state.undoStack.length === 0 || !state.activeDocumentPath) return
      const doc = getActiveDocument(state)
      if (!doc) return
      state.redoStack.push(JSON.parse(JSON.stringify(doc)))
      const prev = state.undoStack.pop()!
      state.documents[state.activeDocumentPath] = prev
      state.isDirty = true
    },
    redo(state) {
      if (state.redoStack.length === 0 || !state.activeDocumentPath) return
      const doc = getActiveDocument(state)
      if (!doc) return
      state.undoStack.push(JSON.parse(JSON.stringify(doc)))
      const next = state.redoStack.pop()!
      state.documents[state.activeDocumentPath] = next
      state.isDirty = true
    },
    markClean(state) {
      state.isDirty = false
    },
  },
})

export const {
  loadDocuments,
  setActiveDocument,
  selectElement,
  hoverElement,
  addElement,
  removeElement,
  moveElement,
  updateElementTransform,
  updateElementBackground,
  updateElementEvents,
  updateElementData,
  renameElement,
  reorderChildren,
  createDocument,
  deleteDocument,
  undo,
  redo,
  markClean,
} = uiEditorSlice.actions

export const selectUiEditorState = (state: RootState): UiEditorState => state.uiEditor
export const selectUiEditorDocuments = (state: RootState) => state.uiEditor.documents
export const selectActiveDocumentPath = (state: RootState) => state.uiEditor.activeDocumentPath
export const selectSelectedElementId = (state: RootState) => state.uiEditor.selectedElementId
export const selectHoveredElementId = (state: RootState) => state.uiEditor.hoveredElementId
export const selectIsUiEditorDirty = (state: RootState) => state.uiEditor.isDirty
export const selectCanUiEditorUndo = (state: RootState) => state.uiEditor.undoStack.length > 0
export const selectCanUiEditorRedo = (state: RootState) => state.uiEditor.redoStack.length > 0

export const selectIsUiEditorActive = (state: RootState): boolean => {
  return state.uiEditor.activeDocumentPath !== null
}

export const selectActiveDocument = (state: RootState): UiEditorDocument | null => {
  const path = state.uiEditor.activeDocumentPath
  if (!path) return null
  return state.uiEditor.documents[path] ?? null
}

export const selectSelectedElement = (state: RootState): UiElementNode | null => {
  const doc = selectActiveDocument(state)
  const id = state.uiEditor.selectedElementId
  if (!doc || !id) return null
  return doc.elements[id] ?? null
}

export default uiEditorSlice.reducer
