import React, { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '../../../redux/hooks'
import {
  selectActiveDocument,
  selectSelectedElement,
  selectSelectedElementId,
  renameElement,
} from '../../../redux/ui-editor'
import { TextField } from '../../ui/TextField'
import UiTransformSection from './UiTransformSection'
import UiBackgroundSection from './UiBackgroundSection'
import UiTextSection from './UiTextSection'
import UiButtonSection from './UiButtonSection'
import UiInputSection from './UiInputSection'
import UiDropdownSection from './UiDropdownSection'
import UiEventsSection from './UiEventsSection'
import './UiPropertyPanel.css'

const UiPropertyPanel: React.FC = () => {
  const document = useAppSelector(selectActiveDocument)
  const element = useAppSelector(selectSelectedElement)
  const elementId = useAppSelector(selectSelectedElementId)
  const dispatch = useAppDispatch()

  const handleRename = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (elementId) {
      dispatch(renameElement({ elementId, name: e.target.value }))
    }
  }, [dispatch, elementId])

  if (!document) {
    return (
      <div className="UiPropertyPanel empty">
        <span>No document selected</span>
      </div>
    )
  }

  if (!element) {
    return (
      <div className="UiPropertyPanel empty">
        <span>Select an element to edit its properties</span>
      </div>
    )
  }

  const renderTypeSection = () => {
    switch (element.elementData.type) {
      case 'label':
        return <UiTextSection element={element} />
      case 'button':
        return <UiButtonSection element={element} />
      case 'input':
        return <UiInputSection element={element} />
      case 'dropdown':
        return <UiDropdownSection element={element} />
      case 'container':
      default:
        return null
    }
  }

  return (
    <div className="UiPropertyPanel">
      <div className="property-panel-header">
        <TextField
          label="Name"
          value={element.name}
          onChange={handleRename}
        />
        <div className="property-panel-type">
          {element.elementData.type}
        </div>
      </div>
      <div className="property-panel-sections">
        <UiTransformSection element={element} />
        <UiBackgroundSection element={element} />
        {renderTypeSection()}
        <UiEventsSection element={element} />
      </div>
    </div>
  )
}

export default React.memo(UiPropertyPanel)
