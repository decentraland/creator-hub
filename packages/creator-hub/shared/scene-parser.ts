import { parse } from '@babel/parser';

export type ScriptParseResult = {
  error?: string;
  hasCustomImports?: boolean;
  hasMainBody?: boolean;
};

function getScriptParams(content: string | null): ScriptParseResult {
  if (!content) {
    return { error: 'No content provided' };
  }

  let hasCustomImports = false;
  let hasMainBody = false;

  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['typescript'],
    });

    const defaultImports = new Set(['@dcl/sdk/math', '@dcl/sdk/ecs']);

    for (const statement of ast.program.body) {
      // Check for non-default imports
      if (statement.type === 'ImportDeclaration') {
        const importSource = statement.source.value;
        if (!defaultImports.has(importSource)) {
          hasCustomImports = true;
        }
      }

      // Check for main function with non-empty body
      if (
        statement.type === 'ExportNamedDeclaration' &&
        statement.declaration?.type === 'FunctionDeclaration' &&
        statement.declaration.id?.name === 'main'
      ) {
        // To make it simple, we just check if function body has any statements
        const functionBody = statement.declaration.body;
        if (functionBody && functionBody.type === 'BlockStatement') {
          hasMainBody = functionBody.body.length > 0;
        }

        break;
      }
    }
    return { hasCustomImports, hasMainBody };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '';
    console.warn('Failed to parse scene file:', error);
    return { error: errorMessage };
  }
}

/**
 * Determines if a scene has custom code.
 * A scene is considered to have custom code if it has:
 * - Non-default imports (anything other than @dcl/sdk/math or @dcl/sdk/ecs)
 * - OR a non-empty main function body
 */
export function hasCustomCode(content: string | null): boolean {
  if (!content) return false;

  const result = getScriptParams(content);

  // If there's a parse error, assume no custom code (safer default)
  if (result.error) {
    console.warn('Error parsing scene for custom code detection:', result.error);
    return false;
  }

  return result.hasCustomImports === true || result.hasMainBody === true;
}
