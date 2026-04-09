import React, { useCallback, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '../../../redux/hooks'
import { selectActiveDocument, updateElementEvents } from '../../../redux/ui-editor'
import type { UiElementNode, SdkEventName } from '../types'
import { ELEMENT_EVENT_SUPPORT } from '../types'
import { Container } from '../../Container'
import { TextField } from '../../ui/TextField'

interface Props {
  element: UiElementNode
}

const VALID_JS_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/

const EVENT_LABELS: Record<SdkEventName, string> = {
  onMouseDown: 'On Mouse Down',
  onMouseUp: 'On Mouse Up',
  onMouseEnter: 'On Mouse Enter',
  onMouseLeave: 'On Mouse Leave',
  onChange: 'On Change',
  onSubmit: 'On Submit',
}

function getPlaceholder(elementName: string, eventName: SdkEventName): string {
  const suffix = eventName.charAt(0).toUpperCase() + eventName.slice(1)
  const cleanName = elementName.replace(/[^a-zA-Z0-9]/g, '')
  return `${suffix.charAt(0).toLowerCase() + suffix.slice(1)}${cleanName}`
}

const UiEventsSection: React.FC<Props> = ({ element }) => {
  const dispatch = useAppDispatch()
  const document = useAppSelector(selectActiveDocument)

  const supportedEvents = ELEMENT_EVENT_SUPPORT[element.elementData.type]
  const eventNames = Object.keys(supportedEvents) as SdkEventName[]

  const usedPropNames = useMemo(() => {
    if (!document) return new Set<string>()
    const names = new Set<string>()
    for (const el of Object.values(document.elements)) {
      if (el.id === element.id) continue
      for (const eventName of Object.keys(ELEMENT_EVENT_SUPPORT[el.elementData.type]) as SdkEventName[]) {
        const value = el.events?.[eventName]
        if (value) names.add(value)
      }
    }
    return names
  }, [document, element.id])

  const handleChange = useCallback((eventName: SdkEventName, value: string) => {
    dispatch(updateElementEvents({ elementId: element.id, events: { [eventName]: value } }))
  }, [dispatch, element.id])

  if (eventNames.length === 0) return null

  const getError = (eventName: SdkEventName): string | boolean => {
    const value = element.events?.[eventName] ?? ''
    if (!value) return false
    if (!VALID_JS_IDENTIFIER.test(value)) return 'Must be a valid JavaScript identifier'
    if (usedPropNames.has(value)) return 'This name is already used by another element'
    return false
  }

  return (
    <Container label="Events" initialOpen={false}>
      {eventNames.map((eventName) => (
        <TextField
          key={eventName}
          label={EVENT_LABELS[eventName]}
          placeholder={getPlaceholder(element.name, eventName)}
          value={element.events?.[eventName] ?? ''}
          error={getError(eventName)}
          onChange={(e) => handleChange(eventName, e.target.value)}
        />
      ))}
    </Container>
  )
}

export default React.memo(UiEventsSection)
