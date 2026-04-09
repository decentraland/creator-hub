import type { UiElementNode } from '../types'

export function isDescendantOf(
  elementId: string,
  ancestorId: string,
  elements: Record<string, UiElementNode>,
): boolean {
  const ancestor = elements[ancestorId]
  if (!ancestor) return false
  for (const childId of ancestor.children) {
    if (childId === elementId) return true
    if (isDescendantOf(elementId, childId, elements)) return true
  }
  return false
}

export function canRearrangeDrop(
  dragId: string,
  targetId: string,
  rootId: string,
  elements: Record<string, UiElementNode>,
): boolean {
  if (dragId === rootId) return false
  if (dragId === targetId) return false
  if (!elements[targetId]) return false
  if (isDescendantOf(targetId, dragId, elements)) return false
  return true
}
