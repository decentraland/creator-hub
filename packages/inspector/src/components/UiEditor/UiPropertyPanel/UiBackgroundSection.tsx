import React, { useCallback } from 'react'
import { useAppDispatch } from '../../../redux/hooks'
import { updateElementBackground } from '../../../redux/ui-editor'
import type { UiElementNode, UiBackgroundData, TextureMode } from '../types'
import { Container } from '../../Container'
import { TextField } from '../../ui/TextField'
import { Dropdown } from '../../ui/Dropdown'
import { ColorField } from '../../ui/ColorField'
import { color4ToHex, hexToColor4 } from './color-utils'

interface Props {
  element: UiElementNode
}

const UiBackgroundSection: React.FC<Props> = ({ element }) => {
  const dispatch = useAppDispatch()

  const update = useCallback((partial: Partial<UiBackgroundData>) => {
    dispatch(updateElementBackground({ elementId: element.id, background: partial }))
  }, [dispatch, element.id])

  const bg = element.background

  const handleColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value
    const c = hexToColor4(hex)
    update({ color: { ...c, a: bg.color?.a ?? 1 } })
  }, [update, bg.color?.a])

  const hexValue = bg.color ? color4ToHex(bg.color) : undefined

  return (
    <Container label="Background" initialOpen>
      {hexValue && (
        <ColorField
          label="Color"
          value={hexValue}
          onChange={handleColorChange}
        />
      )}
      {!hexValue && (
        <div
          style={{ padding: '4px 0', fontSize: 11, cursor: 'pointer', color: '#4285f4' }}
          onClick={() => update({ color: { r: 0, g: 0, b: 0, a: 0.5 } })}
        >
          + Add Background Color
        </div>
      )}
      {hexValue && (
        <div
          style={{ padding: '4px 0', fontSize: 11, cursor: 'pointer', color: '#f44' }}
          onClick={() => update({ color: null })}
        >
          Remove Color
        </div>
      )}
      <TextField
        label="Texture"
        value={bg.textureSrc}
        onChange={(e) => update({ textureSrc: e.target.value })}
      />
      {bg.textureSrc && (
        <Dropdown
          label="Mode"
          options={[
            { label: 'Stretch', value: 'stretch' },
            { label: 'Center', value: 'center' },
            { label: 'Nine Slices', value: 'nine-slices' },
          ]}
          value={bg.textureMode}
          onChange={(e) => update({ textureMode: e.target.value as TextureMode })}
        />
      )}
    </Container>
  )
}

export default React.memo(UiBackgroundSection)
