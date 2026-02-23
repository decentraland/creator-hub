import { parse } from '@babel/parser';

type ScriptParseResult = {
  error?: string;
  hasCustomImports?: boolean;
  hasMainBody?: boolean;
};

function getScriptCustomCode(content: string): ScriptParseResult {
  let hasCustomImports = false;
  let hasMainBody = false;

  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['typescript'],
    });

    const defaultImports = new Set(['@dcl/sdk/math', '@dcl/sdk/ecs', './ui']);

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
    throw new Error(`Failed to parse scene file: ${error}`);
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

  try {
    const result = getScriptCustomCode(content);
    return !!result.hasCustomImports || !!result.hasMainBody;
  } catch (error) {
    console.warn('Error parsing scene:', error);
    return false; // safe default
  }
}
