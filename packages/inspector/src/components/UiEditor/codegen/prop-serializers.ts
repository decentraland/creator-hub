import type { Color4Data, UiTransformData, UiBackgroundData } from '../types'
import { DEFAULT_TRANSFORM, DEFAULT_BACKGROUND } from '../element-defaults'

export function renderColor4(color: Color4Data): string {
  const r = Math.round(color.r * 1000) / 1000
  const g = Math.round(color.g * 1000) / 1000
  const b = Math.round(color.b * 1000) / 1000
  const a = Math.round(color.a * 1000) / 1000
  return `Color4.create(${r}, ${g}, ${b}, ${a})`
}

export function renderSizeValue(value: number | string): string {
  if (typeof value === 'string') return `'${value}'`
  return String(value)
}

export function renderTransformProps(transform: UiTransformData): Record<string, string> {
  const props: Record<string, string> = {}
  const d = DEFAULT_TRANSFORM

  if (transform.flexDirection !== d.flexDirection) props.flexDirection = `'${transform.flexDirection}'`
  if (transform.justifyContent !== d.justifyContent) props.justifyContent = `'${transform.justifyContent}'`
  if (transform.alignItems !== d.alignItems) props.alignItems = `'${transform.alignItems}'`
  if (transform.flexWrap !== d.flexWrap) props.flexWrap = `'${transform.flexWrap}'`
  if (transform.width !== d.width) props.width = renderSizeValue(transform.width)
  if (transform.height !== d.height) props.height = renderSizeValue(transform.height)
  if (transform.minWidth !== d.minWidth) props.minWidth = renderSizeValue(transform.minWidth)
  if (transform.maxWidth !== d.maxWidth) props.maxWidth = renderSizeValue(transform.maxWidth)
  if (transform.minHeight !== d.minHeight) props.minHeight = renderSizeValue(transform.minHeight)
  if (transform.maxHeight !== d.maxHeight) props.maxHeight = renderSizeValue(transform.maxHeight)
  if (transform.paddingTop !== d.paddingTop) props.paddingTop = String(transform.paddingTop)
  if (transform.paddingRight !== d.paddingRight) props.paddingRight = String(transform.paddingRight)
  if (transform.paddingBottom !== d.paddingBottom) props.paddingBottom = String(transform.paddingBottom)
  if (transform.paddingLeft !== d.paddingLeft) props.paddingLeft = String(transform.paddingLeft)
  if (transform.marginTop !== d.marginTop) props.marginTop = String(transform.marginTop)
  if (transform.marginRight !== d.marginRight) props.marginRight = String(transform.marginRight)
  if (transform.marginBottom !== d.marginBottom) props.marginBottom = String(transform.marginBottom)
  if (transform.marginLeft !== d.marginLeft) props.marginLeft = String(transform.marginLeft)
  if (transform.positionType !== d.positionType) props.positionType = `'${transform.positionType}'`
  if (transform.positionTop !== d.positionTop) props.positionTop = renderSizeValue(transform.positionTop)
  if (transform.positionRight !== d.positionRight) props.positionRight = renderSizeValue(transform.positionRight)
  if (transform.positionBottom !== d.positionBottom) props.positionBottom = renderSizeValue(transform.positionBottom)
  if (transform.positionLeft !== d.positionLeft) props.positionLeft = renderSizeValue(transform.positionLeft)
  if (transform.overflow !== d.overflow) props.overflow = `'${transform.overflow}'`
  if (transform.opacity !== d.opacity) props.opacity = String(transform.opacity)
  if (transform.zIndex !== d.zIndex) props.zIndex = String(transform.zIndex)
  if (transform.flexGrow !== d.flexGrow) props.flexGrow = String(transform.flexGrow)
  if (transform.flexShrink !== d.flexShrink) props.flexShrink = String(transform.flexShrink)
  if (transform.flexBasis !== d.flexBasis) props.flexBasis = renderSizeValue(transform.flexBasis)
  if (transform.pointerFilter !== d.pointerFilter) props.pointerFilter = `'${transform.pointerFilter}'`

  return props
}

export function renderBackgroundProps(bg: UiBackgroundData): Record<string, string> | null {
  const hasColor = bg.color !== null
  const hasTexture = bg.textureSrc !== ''
  if (!hasColor && !hasTexture) return null

  const props: Record<string, string> = {}
  if (bg.color) {
    props.color = renderColor4(bg.color)
  }
  if (bg.textureSrc) {
    props['texture.src'] = `'${bg.textureSrc}'`
    if (bg.textureMode !== DEFAULT_BACKGROUND.textureMode) {
      props['textureMode'] = `'${bg.textureMode}'`
    }
    if (bg.textureWrapMode !== DEFAULT_BACKGROUND.textureWrapMode) {
      props['texture.wrapMode'] = `'${bg.textureWrapMode}'`
    }
    if (bg.textureFilterMode !== DEFAULT_BACKGROUND.textureFilterMode) {
      props['texture.filterMode'] = `'${bg.textureFilterMode}'`
    }
  }
  return props
}

export function renderObjectLiteral(props: Record<string, string>, indent: string): string {
  const entries = Object.entries(props)
  if (entries.length === 0) return '{}'
  if (entries.length <= 3) {
    const inner = entries.map(([k, v]) => `${k}: ${v}`).join(', ')
    return `{ ${inner} }`
  }
  const lines = entries.map(([k, v]) => `${indent}  ${k}: ${v},`)
  return `{\n${lines.join('\n')}\n${indent}}`
}
