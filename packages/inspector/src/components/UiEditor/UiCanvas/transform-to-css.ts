import type { UiTransformData, UiBackgroundData, Color4Data } from '../types'

export function colorToCSS(color: Color4Data): string {
  const r = Math.round(color.r * 255)
  const g = Math.round(color.g * 255)
  const b = Math.round(color.b * 255)
  return `rgba(${r}, ${g}, ${b}, ${color.a})`
}

function sizeToCSS(value: number | string): string | number | undefined {
  if (value === 'auto') return undefined
  if (typeof value === 'string') return value
  return value
}

export function transformToCSS(transform: UiTransformData): React.CSSProperties {
  const style: React.CSSProperties = {
    display: 'flex',
    flexDirection: transform.flexDirection,
    justifyContent: transform.justifyContent,
    alignItems: transform.alignItems,
    flexWrap: transform.flexWrap,
    overflow: transform.overflow,
    opacity: transform.opacity,
    zIndex: transform.zIndex,
    flexGrow: transform.flexGrow,
    flexShrink: transform.flexShrink,
    position: transform.positionType === 'absolute' ? 'absolute' : 'relative',
    boxSizing: 'border-box',
  }

  const w = sizeToCSS(transform.width)
  if (w !== undefined) style.width = w
  const h = sizeToCSS(transform.height)
  if (h !== undefined) style.height = h

  const minW = sizeToCSS(transform.minWidth)
  if (minW !== undefined) style.minWidth = minW
  const maxW = sizeToCSS(transform.maxWidth)
  if (maxW !== undefined) style.maxWidth = maxW
  const minH = sizeToCSS(transform.minHeight)
  if (minH !== undefined) style.minHeight = minH
  const maxH = sizeToCSS(transform.maxHeight)
  if (maxH !== undefined) style.maxHeight = maxH

  const fb = sizeToCSS(transform.flexBasis)
  if (fb !== undefined) style.flexBasis = fb

  if (transform.paddingTop || transform.paddingRight || transform.paddingBottom || transform.paddingLeft) {
    style.padding = `${transform.paddingTop}px ${transform.paddingRight}px ${transform.paddingBottom}px ${transform.paddingLeft}px`
  }

  if (transform.marginTop || transform.marginRight || transform.marginBottom || transform.marginLeft) {
    style.margin = `${transform.marginTop}px ${transform.marginRight}px ${transform.marginBottom}px ${transform.marginLeft}px`
  }

  if (transform.positionType === 'absolute') {
    const top = sizeToCSS(transform.positionTop)
    if (top !== undefined) style.top = top
    const right = sizeToCSS(transform.positionRight)
    if (right !== undefined) style.right = right
    const bottom = sizeToCSS(transform.positionBottom)
    if (bottom !== undefined) style.bottom = bottom
    const left = sizeToCSS(transform.positionLeft)
    if (left !== undefined) style.left = left
  }

  return style
}

export function backgroundToCSS(bg: UiBackgroundData): React.CSSProperties {
  const style: React.CSSProperties = {}
  if (bg.color) {
    style.backgroundColor = colorToCSS(bg.color)
  }
  if (bg.textureSrc) {
    style.backgroundImage = `url(${bg.textureSrc})`
    style.backgroundSize = bg.textureMode === 'stretch' ? '100% 100%' : bg.textureMode === 'center' ? 'contain' : undefined
    style.backgroundPosition = 'center'
    style.backgroundRepeat = bg.textureWrapMode === 'repeat' ? 'repeat' : 'no-repeat'
  }
  return style
}
