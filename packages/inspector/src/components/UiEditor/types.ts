export type UiElementType = 'container' | 'label' | 'button' | 'input' | 'dropdown'

export type FlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse'
export type JustifyContent = 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'
export type AlignItems = 'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'
export type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse'
export type PositionType = 'relative' | 'absolute'
export type Overflow = 'visible' | 'hidden' | 'scroll'
export type PointerFilter = 'none' | 'block'
export type TextAlign = 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
export type TextWrap = 'nowrap' | 'wrap'
export type FontType = 'sans-serif' | 'serif' | 'monospace'
export type TextureWrapMode = 'repeat' | 'clamp' | 'mirror'
export type TextureFilterMode = 'point' | 'bi-linear' | 'tri-linear'
export type TextureMode = 'nine-slices' | 'center' | 'stretch'
export type ButtonVariant = 'primary' | 'secondary'

export interface Color4Data {
  r: number
  g: number
  b: number
  a: number
}

export interface UiTransformData {
  flexDirection: FlexDirection
  justifyContent: JustifyContent
  alignItems: AlignItems
  flexWrap: FlexWrap
  width: number | string
  height: number | string
  minWidth: number | string
  maxWidth: number | string
  minHeight: number | string
  maxHeight: number | string
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  positionType: PositionType
  positionTop: number | string
  positionRight: number | string
  positionBottom: number | string
  positionLeft: number | string
  overflow: Overflow
  opacity: number
  zIndex: number
  flexGrow: number
  flexShrink: number
  flexBasis: number | string
  pointerFilter: PointerFilter
}

export interface UiBackgroundData {
  color: Color4Data | null
  textureSrc: string
  textureWrapMode: TextureWrapMode
  textureFilterMode: TextureFilterMode
  textureMode: TextureMode
}

export interface UiTextData {
  type: 'label'
  value: string
  fontSize: number
  color: Color4Data
  font: FontType
  textAlign: TextAlign
  textWrap: TextWrap
}

export interface UiButtonData {
  type: 'button'
  value: string
  fontSize: number
  color: Color4Data
  font: FontType
  variant: ButtonVariant
  disabled: boolean
}

export interface UiInputData {
  type: 'input'
  placeholder: string
  value: string
  fontSize: number
  color: Color4Data
  placeholderColor: Color4Data
  font: FontType
  disabled: boolean
}

export interface UiDropdownData {
  type: 'dropdown'
  options: string[]
  selectedIndex: number
  acceptEmpty: boolean
  emptyLabel: string
  disabled: boolean
  fontSize: number
  color: Color4Data
  font: FontType
}

export interface UiEventsData {
  onMouseDown: string
  onMouseUp: string
  onMouseEnter: string
  onMouseLeave: string
  onChange: string
  onSubmit: string
}

export type EventSignature = '() => void' | '(value: string) => void' | '(value: number) => void'
export type SdkEventName = keyof UiEventsData

export const ELEMENT_EVENT_SUPPORT: Record<UiElementType, Partial<Record<SdkEventName, EventSignature>>> = {
  container: { onMouseDown: '() => void', onMouseUp: '() => void', onMouseEnter: '() => void', onMouseLeave: '() => void' },
  label: {},
  button: { onMouseDown: '() => void', onMouseUp: '() => void', onMouseEnter: '() => void', onMouseLeave: '() => void' },
  input: { onChange: '(value: string) => void', onSubmit: '(value: string) => void' },
  dropdown: { onChange: '(value: number) => void', onMouseDown: '() => void', onMouseUp: '() => void', onMouseEnter: '() => void', onMouseLeave: '() => void' },
}

export interface UiContainerData {
  type: 'container'
}

export type UiElementData = UiContainerData | UiTextData | UiButtonData | UiInputData | UiDropdownData

export interface UiElementNode {
  id: string
  name: string
  elementData: UiElementData
  transform: UiTransformData
  background: UiBackgroundData
  events: UiEventsData
  children: string[]
  parentId: string | null
}

export interface UiDocumentMetadata {
  name: string
  outputPath: string
  canvasWidth: number
  canvasHeight: number
}

export interface UiEditorDocument {
  version: 1
  rootId: string
  elements: Record<string, UiElementNode>
  metadata: UiDocumentMetadata
}
