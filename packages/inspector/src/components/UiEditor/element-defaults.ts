import type {
  UiElementType,
  UiElementNode,
  UiTransformData,
  UiBackgroundData,
  UiEventsData,
  UiElementData,
  UiEditorDocument,
} from './types'

let nextId = 1

export function generateElementId(): string {
  return `ui-el-${nextId++}-${Date.now().toString(36)}`
}

export const DEFAULT_TRANSFORM: UiTransformData = {
  flexDirection: 'column',
  justifyContent: 'flex-start',
  alignItems: 'stretch',
  flexWrap: 'nowrap',
  width: 'auto',
  height: 'auto',
  minWidth: 'auto',
  maxWidth: 'auto',
  minHeight: 'auto',
  maxHeight: 'auto',
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  marginTop: 0,
  marginRight: 0,
  marginBottom: 0,
  marginLeft: 0,
  positionType: 'relative',
  positionTop: 'auto',
  positionRight: 'auto',
  positionBottom: 'auto',
  positionLeft: 'auto',
  overflow: 'visible',
  opacity: 1,
  zIndex: 0,
  flexGrow: 0,
  flexShrink: 0,
  flexBasis: 'auto',
  pointerFilter: 'none',
}

export const DEFAULT_BACKGROUND: UiBackgroundData = {
  color: null,
  textureSrc: '',
  textureWrapMode: 'clamp',
  textureFilterMode: 'bi-linear',
  textureMode: 'stretch',
}

export const DEFAULT_EVENTS: UiEventsData = {
  onMouseDown: '',
  onMouseUp: '',
  onMouseEnter: '',
  onMouseLeave: '',
  onChange: '',
  onSubmit: '',
}

const WHITE = { r: 1, g: 1, b: 1, a: 1 }
const BLACK = { r: 0, g: 0, b: 0, a: 1 }
const GREY = { r: 0.5, g: 0.5, b: 0.5, a: 1 }

function getDefaultElementData(type: UiElementType): UiElementData {
  switch (type) {
    case 'container':
      return { type: 'container' }
    case 'label':
      return {
        type: 'label',
        value: 'Label',
        fontSize: 14,
        color: WHITE,
        font: 'sans-serif',
        textAlign: 'middle-left',
        textWrap: 'nowrap',
      }
    case 'button':
      return {
        type: 'button',
        value: 'Button',
        fontSize: 14,
        color: WHITE,
        font: 'sans-serif',
        variant: 'primary',
        disabled: false,
      }
    case 'input':
      return {
        type: 'input',
        placeholder: 'Type here...',
        value: '',
        fontSize: 14,
        color: WHITE,
        placeholderColor: GREY,
        font: 'sans-serif',
        disabled: false,
      }
    case 'dropdown':
      return {
        type: 'dropdown',
        options: ['Option 1', 'Option 2', 'Option 3'],
        selectedIndex: 0,
        acceptEmpty: false,
        emptyLabel: '',
        disabled: false,
        fontSize: 14,
        color: WHITE,
        font: 'sans-serif',
      }
  }
}

function getDefaultTransformForType(type: UiElementType): UiTransformData {
  switch (type) {
    case 'container':
      return {
        ...DEFAULT_TRANSFORM,
        width: '100%',
        height: 'auto',
        paddingTop: 8,
        paddingRight: 8,
        paddingBottom: 8,
        paddingLeft: 8,
      }
    case 'label':
      return {
        ...DEFAULT_TRANSFORM,
        width: 'auto',
        height: 30,
      }
    case 'button':
      return {
        ...DEFAULT_TRANSFORM,
        width: 100,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
      }
    case 'input':
      return {
        ...DEFAULT_TRANSFORM,
        width: '100%',
        height: 36,
      }
    case 'dropdown':
      return {
        ...DEFAULT_TRANSFORM,
        width: '100%',
        height: 36,
      }
  }
}

function getDefaultBackgroundForType(type: UiElementType): UiBackgroundData {
  switch (type) {
    case 'container':
      return { ...DEFAULT_BACKGROUND, color: { r: 0, g: 0, b: 0, a: 0.3 } }
    case 'button':
      return { ...DEFAULT_BACKGROUND, color: { r: 0.2, g: 0.4, b: 0.8, a: 1 } }
    case 'input':
      return { ...DEFAULT_BACKGROUND, color: { r: 0.15, g: 0.15, b: 0.15, a: 1 } }
    case 'dropdown':
      return { ...DEFAULT_BACKGROUND, color: { r: 0.15, g: 0.15, b: 0.15, a: 1 } }
    default:
      return { ...DEFAULT_BACKGROUND }
  }
}

export function createDefaultElement(type: UiElementType, parentId: string): UiElementNode {
  const id = generateElementId()
  const names: Record<UiElementType, string> = {
    container: 'Container',
    label: 'Label',
    button: 'Button',
    input: 'Input',
    dropdown: 'Dropdown',
  }
  return {
    id,
    name: names[type],
    elementData: getDefaultElementData(type),
    transform: getDefaultTransformForType(type),
    background: getDefaultBackgroundForType(type),
    events: { ...DEFAULT_EVENTS },
    children: [],
    parentId,
  }
}

export function createDefaultDocument(name: string): UiEditorDocument {
  const rootId = generateElementId()
  const root: UiElementNode = {
    id: rootId,
    name: 'Root',
    elementData: { type: 'container' },
    transform: {
      ...DEFAULT_TRANSFORM,
      width: '100%',
      height: '100%',
      flexDirection: 'column',
    },
    background: { ...DEFAULT_BACKGROUND },
    events: { ...DEFAULT_EVENTS },
    children: [],
    parentId: null,
  }
  return {
    version: 1,
    rootId,
    elements: { [rootId]: root },
    metadata: {
      name,
      outputPath: `src/ui/${name.toLowerCase().replace(/\s+/g, '-')}.tsx`,
      canvasWidth: 1280,
      canvasHeight: 720,
    },
  }
}
