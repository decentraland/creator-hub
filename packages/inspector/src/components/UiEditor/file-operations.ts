import type { UiEditorDocument, SdkEventName } from './types'
import { ELEMENT_EVENT_SUPPORT } from './types'
import { generateTsx } from './codegen/generate-tsx'
import { DEFAULT_EVENTS } from './element-defaults'
import { getDataLayerInterface } from '../../redux/data-layer'

export async function saveUiDocument(path: string, document: UiEditorDocument): Promise<void> {
  const dataLayer = getDataLayerInterface()
  if (!dataLayer) throw new Error('Data layer not available')

  const jsonContent = JSON.stringify(document, null, 2)
  const jsonBuffer = new Uint8Array(Buffer.from(jsonContent, 'utf-8'))
  await (dataLayer as any).saveFile({ path, content: jsonBuffer })

  const tsxContent = generateTsx(document)
  const tsxBuffer = new Uint8Array(Buffer.from(tsxContent, 'utf-8'))
  await (dataLayer as any).saveFile({ path: document.metadata.outputPath, content: tsxBuffer })
}

export async function loadUiDocument(path: string): Promise<UiEditorDocument> {
  const dataLayer = getDataLayerInterface()
  if (!dataLayer) throw new Error('Data layer not available')

  const response = await (dataLayer as any).getFile({ path })
  const content = Buffer.from(response.content).toString('utf-8')
  const doc = JSON.parse(content) as UiEditorDocument

  for (const el of Object.values(doc.elements)) {
    if (!el.events) {
      el.events = { ...DEFAULT_EVENTS }
    }
  }

  return doc
}

export async function discoverUiDocuments(): Promise<Record<string, UiEditorDocument>> {
  const dataLayer = getDataLayerInterface()
  if (!dataLayer) return {}

  try {
    const result = await (dataLayer as any).getFilesSizes({ path: 'assets/scene/ui', ignore: [] })
    const files: Array<{ path: string; size: number }> = result.files ?? []
    const uiJsonFiles = files.filter((f: { path: string }) => f.path.endsWith('.ui.json'))

    const documents: Record<string, UiEditorDocument> = {}
    for (const file of uiJsonFiles) {
      try {
        const doc = await loadUiDocument(file.path)
        documents[file.path] = doc
      } catch {
        console.warn(`Failed to load UI document: ${file.path}`)
      }
    }
    return documents
  } catch {
    return {}
  }
}

export function getIntegrationCode(document: UiEditorDocument): string {
  const funcName = document.metadata.name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')

  const importPath = document.metadata.outputPath
    .replace(/^src\//, './')
    .replace(/\.tsx$/, '')

  const eventPropNames: string[] = []
  for (const el of Object.values(document.elements)) {
    const support = ELEMENT_EVENT_SUPPORT[el.elementData.type]
    for (const eventName of Object.keys(support) as SdkEventName[]) {
      const propName = el.events?.[eventName]
      if (propName) eventPropNames.push(propName)
    }
  }

  if (eventPropNames.length === 0) {
    return `import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'
import { ${funcName} } from '${importPath}'

ReactEcsRenderer.setUiRenderer(() => <${funcName} />)`
  }

  const callbackProps = eventPropNames
    .sort()
    .map(name => `\n    ${name}={() => console.log('${name}')}`)
    .join('')

  return `import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'
import { ${funcName} } from '${importPath}'

ReactEcsRenderer.setUiRenderer(() => (
  <${funcName}${callbackProps}
  />
))`
}
