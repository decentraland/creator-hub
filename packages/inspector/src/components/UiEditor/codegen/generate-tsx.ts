import type { UiEditorDocument, UiElementNode, EventSignature, SdkEventName } from '../types'
import { ELEMENT_EVENT_SUPPORT } from '../types'
import { renderColor4, renderTransformProps, renderBackgroundProps, renderObjectLiteral } from './prop-serializers'

function toPascalCase(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
}

function collectImports(doc: UiEditorDocument): { components: Set<string>; needsColor4: boolean } {
  const components = new Set<string>()
  let needsColor4 = false

  for (const el of Object.values(doc.elements)) {
    switch (el.elementData.type) {
      case 'container':
        components.add('UiEntity')
        break
      case 'label':
        components.add('Label')
        needsColor4 = true
        break
      case 'button':
        components.add('Button')
        needsColor4 = true
        break
      case 'input':
        components.add('Input')
        needsColor4 = true
        break
      case 'dropdown':
        components.add('Dropdown')
        break
    }
    if (el.background.color) needsColor4 = true
  }

  // UiEntity is always needed for containers
  components.add('UiEntity')

  return { components, needsColor4 }
}

interface EventPropDef {
  propName: string
  signature: EventSignature
}

function renderEventProps(el: UiElementNode): string[] {
  const support = ELEMENT_EVENT_SUPPORT[el.elementData.type]
  const result: string[] = []
  for (const eventName of Object.keys(support) as SdkEventName[]) {
    const propName = el.events?.[eventName]
    if (propName) {
      result.push(`${eventName}={${propName}}`)
    }
  }
  return result
}

function collectEventProps(doc: UiEditorDocument): Map<string, EventPropDef> {
  const props = new Map<string, EventPropDef>()
  for (const el of Object.values(doc.elements)) {
    const support = ELEMENT_EVENT_SUPPORT[el.elementData.type]
    for (const [eventName, signature] of Object.entries(support) as [SdkEventName, EventSignature][]) {
      const propName = el.events?.[eventName]
      if (propName) {
        props.set(propName, { propName, signature })
      }
    }
  }
  return props
}

function renderElement(el: UiElementNode, doc: UiEditorDocument, indent: string): string {
  const transformProps = renderTransformProps(el.transform)
  const bgProps = renderBackgroundProps(el.background)

  const lines: string[] = []
  const { elementData } = el

  const transformStr = Object.keys(transformProps).length > 0
    ? ` uiTransform={${renderObjectLiteral(transformProps, indent + '  ')}}`
    : ''

  const bgStr = bgProps
    ? ` uiBackground={${renderObjectLiteral(bgProps, indent + '  ')}}`
    : ''

  switch (elementData.type) {
    case 'container': {
      const eventProps = renderEventProps(el)
      const eventStr = eventProps.map(p => ` ${p}`).join('')
      if (el.children.length === 0) {
        lines.push(`${indent}<UiEntity${transformStr}${bgStr}${eventStr} />`)
      } else {
        lines.push(`${indent}<UiEntity${transformStr}${bgStr}${eventStr}>`)
        for (const childId of el.children) {
          const child = doc.elements[childId]
          if (child) lines.push(renderElement(child, doc, indent + '  '))
        }
        lines.push(`${indent}</UiEntity>`)
      }
      break
    }
    case 'label': {
      const props: string[] = []
      props.push(`value="${escapeString(elementData.value)}"`)
      if (elementData.fontSize !== 14) props.push(`fontSize={${elementData.fontSize}}`)
      props.push(`color={${renderColor4(elementData.color)}}`)
      if (elementData.font !== 'sans-serif') props.push(`font="${elementData.font}"`)
      if (elementData.textAlign !== 'middle-left') props.push(`textAlign="${elementData.textAlign}"`)
      if (elementData.textWrap !== 'nowrap') props.push(`textWrap="${elementData.textWrap}"`)
      const propsStr = props.map(p => ` ${p}`).join('')
      lines.push(`${indent}<Label${transformStr}${bgStr}${propsStr} />`)
      break
    }
    case 'button': {
      const props: string[] = []
      props.push(`value="${escapeString(elementData.value)}"`)
      if (elementData.fontSize !== 14) props.push(`fontSize={${elementData.fontSize}}`)
      props.push(`color={${renderColor4(elementData.color)}}`)
      if (elementData.font !== 'sans-serif') props.push(`font="${elementData.font}"`)
      if (elementData.variant !== 'primary') props.push(`variant="${elementData.variant}"`)
      if (elementData.disabled) props.push(`disabled={true}`)
      props.push(...renderEventProps(el))
      const propsStr = props.map(p => ` ${p}`).join('')
      lines.push(`${indent}<Button${transformStr}${bgStr}${propsStr} />`)
      break
    }
    case 'input': {
      const props: string[] = []
      if (elementData.placeholder) props.push(`placeholder="${escapeString(elementData.placeholder)}"`)
      if (elementData.value) props.push(`value="${escapeString(elementData.value)}"`)
      if (elementData.fontSize !== 14) props.push(`fontSize={${elementData.fontSize}}`)
      props.push(`color={${renderColor4(elementData.color)}}`)
      props.push(`placeholderColor={${renderColor4(elementData.placeholderColor)}}`)
      if (elementData.font !== 'sans-serif') props.push(`font="${elementData.font}"`)
      if (elementData.disabled) props.push(`disabled={true}`)
      props.push(...renderEventProps(el))
      const propsStr = props.map(p => ` ${p}`).join('')
      lines.push(`${indent}<Input${transformStr}${bgStr}${propsStr} />`)
      break
    }
    case 'dropdown': {
      const props: string[] = []
      const optionsStr = `[${elementData.options.map(o => `'${escapeString(o)}'`).join(', ')}]`
      props.push(`options={${optionsStr}}`)
      props.push(`selectedIndex={${elementData.selectedIndex}}`)
      if (elementData.acceptEmpty) props.push(`acceptEmpty={true}`)
      if (elementData.emptyLabel) props.push(`emptyLabel="${escapeString(elementData.emptyLabel)}"`)
      if (elementData.fontSize !== 14) props.push(`fontSize={${elementData.fontSize}}`)
      if (elementData.disabled) props.push(`disabled={true}`)
      props.push(...renderEventProps(el))
      const propsStr = props.map(p => ` ${p}`).join('')
      lines.push(`${indent}<Dropdown${transformStr}${bgStr}${propsStr} />`)
      break
    }
  }

  return lines.join('\n')
}

function escapeString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'").replace(/\n/g, '\\n')
}

export function generateTsx(document: UiEditorDocument): string {
  const { components, needsColor4 } = collectImports(document)
  const funcName = toPascalCase(document.metadata.name)
  const eventProps = collectEventProps(document)

  const componentList = Array.from(components).sort().join(', ')

  const imports: string[] = []
  imports.push(`import ReactEcs, { ${componentList} } from '@dcl/react-ecs'`)
  if (needsColor4) {
    imports.push(`import { Color4 } from '@dcl/sdk/math'`)
  }

  const root = document.elements[document.rootId]
  const body = root ? renderElement(root, document, '    ') : '    <UiEntity />'

  let interfaceBlock = ''
  let funcSignature = `export function ${funcName}()`
  if (eventProps.size > 0) {
    const propsTypeName = `${funcName}Props`
    const propEntries = Array.from(eventProps.values())
      .sort((a, b) => a.propName.localeCompare(b.propName))
    const interfaceLines = propEntries.map(p => `  ${p.propName}?: ${p.signature}`)
    interfaceBlock = `interface ${propsTypeName} {\n${interfaceLines.join('\n')}\n}\n\n`
    const destructured = propEntries.map(p => p.propName).join(', ')
    funcSignature = `export function ${funcName}({ ${destructured} }: ${propsTypeName})`
  }

  return `${imports.join('\n')}

${interfaceBlock}${funcSignature} {
  return (
${body}
  )
}
`
}
