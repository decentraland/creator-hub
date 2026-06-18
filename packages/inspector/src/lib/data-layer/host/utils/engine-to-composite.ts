import type {
  ComponentData,
  Composite,
  CompositeComponent,
  DeepReadonly,
  Entity,
  IEngine,
  LastWriteWinElementSetComponentDefinition,
} from '@dcl/ecs';
import { ComponentType, PutComponentOperation, getCompositeRootComponent, Name } from '@dcl/ecs';
import { ReadWriteByteBuffer } from '@dcl/ecs/dist/serialization/ByteBuffer';
import { ComponentName } from '@dcl/asset-packs';
import type { UI, UIBindings } from '@dcl/asset-packs';
import { buildUiChildrenIndex, descendantsFromIndex } from '../../../sdk/operations/tree-walk';
import type { FileSystemInterface } from '../../types';

const UI_RENDER_COMPONENT_NAMES = new Set([
  'core::UiTransform',
  'core::UiText',
  'core::UiInput',
  'core::UiDropdown',
  'core::UiBackground',
]);

function componentToCompositeComponentData<T>(
  $case: 'json' | 'binary',
  value: DeepReadonly<T>,
  _component: LastWriteWinElementSetComponentDefinition<T>,
): ComponentData {
  if ($case === 'json') {
    return {
      data: {
        $case,
        json: value,
      },
    };
  } else {
    const byteBuffer = new ReadWriteByteBuffer();
    _component.schema.serialize(value, byteBuffer);
    return {
      data: {
        $case,
        binary: byteBuffer.toBinary(),
      },
    };
  }
}

export function dumpEngineToComposite(
  engine: IEngine,
  internalDataType: 'json' | 'binary',
): Composite {
  const ignoreEntities: Set<Entity> = new Set();
  const composite: Composite.Definition = {
    version: 1,
    components: [],
  };

  const CompositeRoot = getCompositeRootComponent(engine);
  const childrenComposite = Array.from(engine.getEntitiesWith(CompositeRoot));
  if (childrenComposite.length > 0) {
    const compositeComponent: CompositeComponent = {
      name: CompositeRoot.componentName,
      jsonSchema: CompositeRoot.schema.jsonSchema,
      data: new Map(),
    };

    for (const [compositeRootEntity, compositeRootValue] of childrenComposite) {
      if (compositeRootEntity === engine.RootEntity) continue;

      compositeRootValue.entities.forEach(item => ignoreEntities.add(item.dest));

      const componentData: ComponentData = componentToCompositeComponentData(
        internalDataType,
        {
          src: compositeRootValue.src,
          entities: [],
        },
        CompositeRoot,
      );
      compositeComponent.data.set(compositeRootEntity, componentData);
    }

    composite.components.push(compositeComponent);
  }

  // UI-Designer membership: only entities reachable from an asset-packs::UI marker via the
  // core::UiTransform parent index are real UI nodes. core::Ui* suppression and the
  // UIDesign re-emission below are gated on this set so a stray/tampered core::UiTransform on
  // a non-UI entity is dumped verbatim under its own name (not silently folded into UIDesign).
  const uiMarker = engine.getComponentOrNull(ComponentName.UI);
  const uiChildrenIndex = buildUiChildrenIndex(engine);
  const uiMemberEntities = new Set<Entity>();
  if (uiMarker) {
    for (const [rootEntity] of engine.getEntitiesWith(uiMarker)) {
      for (const e of descendantsFromIndex(uiChildrenIndex, rootEntity)) uiMemberEntities.add(e);
    }
  }

  const ignoreComponentNames = [
    'inspector:Selection',
    'editor::Toggle',
    CompositeRoot.componentName,
  ];

  for (const itComponentDefinition of engine.componentsIter()) {
    if (ignoreComponentNames.includes(itComponentDefinition.componentName)) continue;

    // TODO: will we support APPEND components?
    if (itComponentDefinition.componentType === ComponentType.GrowOnlyValueSet) continue;

    const itCompositeComponent: CompositeComponent = {
      name: itComponentDefinition.componentName,
      jsonSchema: itComponentDefinition.schema.jsonSchema,
      data: new Map(),
    };

    for (const [entity, value] of engine.getEntitiesWith(itComponentDefinition)) {
      // TODO: see for overrides? check if the value has changed or not (should we tag it?)
      // For now, the entities from children composite are ignored
      if (ignoreEntities.has(entity)) continue;
      // core::Ui* on a real UI-Designer node is re-emitted as asset-packs::UIDesign below;
      // skip it here. core::Ui* on a non-member entity is dumped verbatim (defense-in-depth).
      if (
        UI_RENDER_COMPONENT_NAMES.has(itComponentDefinition.componentName) &&
        uiMemberEntities.has(entity)
      ) {
        continue;
      }

      const componentData: ComponentData = componentToCompositeComponentData(
        internalDataType,
        value,
        itComponentDefinition as LastWriteWinElementSetComponentDefinition<unknown>,
      );
      itCompositeComponent.data.set(entity, componentData);
    }

    // TODO: should we save defined component but without entities assigned?
    if (itCompositeComponent.data.size > 0) {
      composite.components.push(itCompositeComponent);
    }
  }

  // Emit asset-packs::UIDesign for every UI node, bundling its core render components.
  // This is the persisted form of the design; the runtime (asset-packs) recreates the
  // core::* components from it (scaled), and the inspector load-side migration splits it
  // back into live core::* (see splitUIDesignToCore).
  const UiTransform = engine.getComponentOrNull('core::UiTransform');
  const UIDesign = engine.getComponentOrNull(ComponentName.UI_DESIGN);
  if (UiTransform && UIDesign) {
    const UiText = engine.getComponentOrNull(
      'core::UiText',
    ) as LastWriteWinElementSetComponentDefinition<unknown> | null;
    const UiInput = engine.getComponentOrNull(
      'core::UiInput',
    ) as LastWriteWinElementSetComponentDefinition<unknown> | null;
    const UiDropdown = engine.getComponentOrNull(
      'core::UiDropdown',
    ) as LastWriteWinElementSetComponentDefinition<unknown> | null;
    const UiBackground = engine.getComponentOrNull(
      'core::UiBackground',
    ) as LastWriteWinElementSetComponentDefinition<unknown> | null;
    const uiDesignComposite: CompositeComponent = {
      name: UIDesign.componentName,
      jsonSchema: UIDesign.schema.jsonSchema,
      data: new Map(),
    };
    for (const [entity, transform] of engine.getEntitiesWith(UiTransform)) {
      if (ignoreEntities.has(entity)) continue;
      if (!uiMemberEntities.has(entity)) continue; // not a UI-Designer node — leave verbatim.
      const { parent, rightOf, ...transformRest } = transform as Record<string, unknown>;
      const text = UiText?.getOrNull(entity);
      const input = UiInput?.getOrNull(entity);
      const dropdown = UiDropdown?.getOrNull(entity);
      const background = UiBackground?.getOrNull(entity);
      const value = {
        parent: parent ?? 0,
        rightOf: rightOf ?? 0,
        transform: JSON.stringify(transformRest),
        text: text ? JSON.stringify(text) : undefined,
        input: input ? JSON.stringify(input) : undefined,
        dropdown: dropdown ? JSON.stringify(dropdown) : undefined,
        background: background ? JSON.stringify(background) : undefined,
      };
      uiDesignComposite.data.set(
        entity,
        componentToCompositeComponentData(
          internalDataType,
          value,
          UIDesign as LastWriteWinElementSetComponentDefinition<unknown>,
        ),
      );
    }
    if (uiDesignComposite.data.size > 0) composite.components.push(uiDesignComposite);
  }

  return composite;
}

export function dumpEngineToCrdtCommands(engine: IEngine): Uint8Array {
  const componentBuffer = new ReadWriteByteBuffer();
  const crdtBuffer = new ReadWriteByteBuffer();
  for (const itComponentDefinition of engine.componentsIter()) {
    for (const [entity, value] of engine.getEntitiesWith(itComponentDefinition)) {
      if (value) {
        componentBuffer.resetBuffer();
        itComponentDefinition.schema.serialize(value, componentBuffer);

        PutComponentOperation.write(
          entity,
          0,
          itComponentDefinition.componentId,
          componentBuffer.toBinary(),
          crdtBuffer,
        );
      }
    }
  }

  return crdtBuffer.toBinary();
}

// Polyfill for Set.difference
function setDifference(set: Set<any>, other: Set<any>) {
  if (typeof set.difference === 'function') return set.difference(other);
  return new Set([...set].filter(x => !other.has(x)));
}

/**
 * Generate a TypeScript declaration file with a string literal union type containing all entity names in the scene.
 * This allows for type-safe references to entities by name in scene scripts.
 *
 * @param engine The ECS engine instance
 * @param outputPath The path where the .d.ts file should be written
 * @param typeName The name for the generated type (default: "SceneEntityNames")
 * @param fs FileSystem interface for writing the file
 * @returns Promise that resolves when the file has been written
 */

let __ENTITY_NAMES_CACHE: Set<string> = new Set();
export async function generateEntityNamesType(
  engine: IEngine,
  outputPath: string = 'scene-entity-names.d.ts',
  typeName: string = 'SceneEntityNames',
  fs: FileSystemInterface,
): Promise<void> {
  try {
    // Find the Name component definition
    const NameComponent: typeof Name = engine.getComponentOrNull(Name.componentId) as typeof Name;

    if (!NameComponent) {
      throw new Error('Name component not found in engine');
    }

    // Collect all names from entities
    const names: string[] = [];
    for (const [_, nameValue] of engine.getEntitiesWith(NameComponent)) {
      if (nameValue.value) {
        names.push(nameValue.value);
      }
    }

    // Sort names for consistency
    names.sort();
    const namesSet = new Set(names);

    if (setDifference(namesSet, __ENTITY_NAMES_CACHE).size === 0) {
      return;
    }

    __ENTITY_NAMES_CACHE = namesSet;

    // Remove duplicates
    const uniqueNames = Array.from(namesSet);

    // Generate valid, unique TS-identifier enum entries (sanitize + dedup).
    const finalNames = buildEnumEntries(uniqueNames);

    // Generate the .d.ts file content
    let fileContent = '// Auto-generated entity names from the scene\n\n';

    // Add a constant object with name keys for IDE autocompletion
    fileContent +=
      '\n/**\n * Object containing all entity names in the scene for autocomplete support.\n */\n';
    fileContent += `export enum ${typeName} {\n`;

    for (const { original, valid } of finalNames) {
      fileContent += `  ${valid} = ${JSON.stringify(original)},\n`;
    }

    fileContent += '} \n';

    // Check if file exists and compare content before writing
    const fileExists = await fs.existFile(outputPath);
    if (fileExists) {
      const existingContent = (await fs.readFile(outputPath)).toString('utf-8');
      if (existingContent === fileContent) {
        // Content is identical, no need to write
        return;
      }
    }

    // Write to file only if content is different or file doesn't exist
    await fs.writeFile(outputPath, Buffer.from(fileContent, 'utf-8'));
  } catch (e) {
    console.error(`Fail to generate entity names types: ${e}\n`);
  }
}

const FIELD_TO_CALLBACK_SIG: Record<string, string> = {
  'core::UiInput.onChange': '(value: string) => void',
  'core::UiInput.onSubmit': '(value: string) => void',
  'core::UiDropdown.onChange': '(value: number) => void',
  'asset-packs::UI.onMouseDown': '() => void',
  'asset-packs::UI.onMouseUp': '() => void',
  'asset-packs::UI.onMouseEnter': '() => void',
  'asset-packs::UI.onMouseLeave': '() => void',
};

const VAR_TYPE_TO_TS: Record<string, string> = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  color: '{ r: number; g: number; b: number; a?: number }',
  'string-array': 'string[]',
};

// TS/JS reserved words + a few contextual keywords that are invalid as a bare
// enum-member name or interface-member/type name. An author-controlled Name
// (or UI marker / variable name) that sanitizes to one of these would emit a
// non-compiling generated file (build-time DoS), so prefix it with `_`.
const TS_RESERVED_WORDS: ReadonlySet<string> = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'as',
  'implements',
  'interface',
  'let',
  'package',
  'private',
  'protected',
  'public',
  'static',
  'yield',
  'any',
  'boolean',
  'constructor',
  'declare',
  'get',
  'module',
  'require',
  'number',
  'set',
  'string',
  'symbol',
  'type',
  'from',
  'of',
  'namespace',
  'async',
  'await',
]);

/**
 * Turn an author-controlled string into a guaranteed-valid bare TS identifier.
 * (a) sanitize to the [A-Za-z0-9_] charset, prefixing a leading digit;
 * (b) if the sanitized token collides with a TS reserved word, prefix `_` so
 *     the emitted token is valid regardless of input.
 * Empty input collapses to `_`. Single chokepoint for every author-string →
 * source-*token* (not value) emission in this module.
 */
function toSafeIdentifier(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_]/g, '_').replace(/^[0-9]/, '_$&') || '_';
  return TS_RESERVED_WORDS.has(cleaned) ? `_${cleaned}` : cleaned;
}

let __UI_CONTEXTS_CACHE = '';

export async function generateUiContextsType(
  engine: IEngine,
  outputPath: string,
  fs: FileSystemInterface,
): Promise<void> {
  try {
    const UIComp = engine.getComponentOrNull('asset-packs::UI');
    if (!UIComp) return;
    const UIBindings = engine.getComponentOrNull('asset-packs::UIBindings');
    const UiTransform = engine.getComponentOrNull('core::UiTransform');
    if (!UiTransform) return;

    const childrenIndex = buildUiChildrenIndex(engine);

    const blocks: string[] = [];
    const usedTypeNames = new Set<string>();

    for (const [rootEntity, rawMarker] of engine.getEntitiesWith(UIComp)) {
      const marker = rawMarker as UI;
      if (!marker.name) continue;
      const typeBase = toSafeIdentifier(marker.name);
      let typeName = typeBase;
      let suffix = 1;
      while (usedTypeNames.has(typeName)) {
        suffix += 1;
        typeName = `${typeBase}_${suffix}`;
      }
      usedTypeNames.add(typeName);

      // Walk descendants to find callback bindings for THIS root.
      const descSet = descendantsFromIndex(childrenIndex, rootEntity as Entity);
      const callbackFieldsByVar = new Map<string, Set<string>>();
      if (UIBindings) {
        const UIBindingsLww = UIBindings as LastWriteWinElementSetComponentDefinition<UIBindings>;
        for (const e of descSet) {
          const b = UIBindingsLww.getOrNull(e);
          if (!b) continue;
          for (const row of b.value) {
            const fieldKey = row.field;
            const set = callbackFieldsByVar.get(row.variable) ?? new Set<string>();
            set.add(fieldKey);
            callbackFieldsByVar.set(row.variable, set);
          }
        }
      }

      const contextLines: string[] = [];
      const callbackLines: string[] = [];

      for (const v of marker.variables) {
        if (v.type === 'callback') {
          const fields = callbackFieldsByVar.get(v.name);
          let sig: string;
          if (!fields || fields.size === 0) {
            sig = '() => void';
          } else {
            const sigs = new Set<string>();
            for (const f of fields) {
              sigs.add(FIELD_TO_CALLBACK_SIG[f] ?? '() => void');
            }
            sig =
              sigs.size === 1
                ? sigs.values().next().value!
                : Array.from(sigs)
                    .map(s => `(${s})`)
                    .join(' | ');
          }
          callbackLines.push(`  ${toSafeIdentifier(v.name)}: ${sig};`);
        } else {
          const ts = VAR_TYPE_TO_TS[v.type];
          if (ts === undefined) {
            console.warn(
              `generateUiContextsType: skipping variable ${JSON.stringify(v.name)} with unknown type ${JSON.stringify(v.type)}`,
            );
            continue;
          }
          contextLines.push(`  ${toSafeIdentifier(v.name)}: ${ts};`);
        }
      }

      blocks.push(
        `export interface ${typeName}Context {\n${
          contextLines.join('\n') || '  // (no value variables)'
        }\n}`,
      );
      blocks.push(
        `export interface ${typeName}Callbacks {\n${
          callbackLines.join('\n') || '  // (no callback variables)'
        }\n}`,
      );
    }

    const fileContent = `// Auto-generated UI context interfaces. Do not edit by hand.\n\n${blocks.join(
      '\n\n',
    )}\n`;

    if (fileContent === __UI_CONTEXTS_CACHE) return;
    __UI_CONTEXTS_CACHE = fileContent;

    const fileExists = await fs.existFile(outputPath);
    if (fileExists) {
      const existing = (await fs.readFile(outputPath)).toString('utf-8');
      if (existing === fileContent) return;
    }
    await fs.writeFile(outputPath, Buffer.from(fileContent, 'utf-8'));
  } catch (e) {
    console.error(`Fail to generate UI contexts type: ${e}\n`);
  }
}

// Turn raw Name strings into unique, valid TS-identifier enum entries.
// Single source of the sanitize + collision-dedup logic, consumed by both
// generateEntityNamesType and generateUiEntityNamesType.
function buildEnumEntries(names: string[]): Array<{ original: string; valid: string }> {
  const used = new Set<string>();
  const out: Array<{ original: string; valid: string }> = [];
  for (const name of names) {
    let valid = toSafeIdentifier(name);
    if (used.has(valid)) {
      let suffix = 1;
      while (used.has(`${valid}_${suffix}`)) suffix++;
      valid = `${valid}_${suffix}`;
    }
    used.add(valid);
    out.push({ original: name, valid });
  }
  return out;
}

let __UI_ENTITY_NAMES_CACHE = '';

/**
 * Generate a TypeScript value-enum of UI element names — every UI root
 * (`asset-packs::UI` marker) plus its named `core::UiTransform.parent`
 * descendants. A UI-filtered subset of the catch-all `EntityNames`, intended for
 * `engine.getEntityOrNullByName(UiEntityNames.X)` and pairing with the
 * `<Root>Context` / `<Root>Callbacks` interfaces from `ui-contexts.ts`.
 */
export async function generateUiEntityNamesType(
  engine: IEngine,
  outputPath: string,
  fs: FileSystemInterface,
): Promise<void> {
  try {
    const UIComp = engine.getComponentOrNull('asset-packs::UI');
    const UiTransform = engine.getComponentOrNull('core::UiTransform');
    const NameComponent = engine.getComponentOrNull(Name.componentId) as typeof Name | null;
    if (!UIComp || !UiTransform || !NameComponent) return;

    const childrenIndex = buildUiChildrenIndex(engine);

    // Union of every UI root and its descendants.
    const uiEntities = new Set<Entity>();
    for (const [rootEntity] of engine.getEntitiesWith(UIComp)) {
      for (const e of descendantsFromIndex(childrenIndex, rootEntity as Entity)) uiEntities.add(e);
    }

    const names: string[] = [];
    for (const e of uiEntities) {
      const value = NameComponent.getOrNull(e)?.value;
      if (value) names.push(value);
    }
    names.sort();

    const entries = buildEnumEntries(Array.from(new Set(names)));

    let fileContent = '// Auto-generated UI entity names from the scene. Do not edit by hand.\n\n';
    fileContent += 'export enum UiEntityNames {\n';
    for (const { original, valid } of entries) {
      fileContent += `  ${valid} = ${JSON.stringify(original)},\n`;
    }
    fileContent += '}\n';

    if (fileContent === __UI_ENTITY_NAMES_CACHE) return;
    __UI_ENTITY_NAMES_CACHE = fileContent;

    const fileExists = await fs.existFile(outputPath);
    if (fileExists) {
      const existing = (await fs.readFile(outputPath)).toString('utf-8');
      if (existing === fileContent) return;
    }
    await fs.writeFile(outputPath, Buffer.from(fileContent, 'utf-8'));
  } catch (e) {
    console.error(`Fail to generate UI entity names types: ${e}\n`);
  }
}
