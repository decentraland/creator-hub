import React, { useCallback } from 'react'
import { useAppDispatch } from '../../../redux/hooks'
import { updateElementData } from '../../../redux/ui-editor'
import type { UiElementNode, UiInputData, FontType } from '../types'
import { Container } from '../../Container'
import { TextField } from '../../ui/TextField'
import { Dropdown } from '../../ui/Dropdown'
import { RangeField } from '../../ui/RangeField'
import { ColorField } from '../../ui/ColorField'
import { CheckboxField } from '../../ui/CheckboxField'
import { color4ToHex, hexToColor4 } from './color-utils'

interface Props {
  element: UiElementNode
}

const UiInputSection: React.FC<Props> = ({ element }) => {
  const dispatch = useAppDispatch()
  const data = element.elementData as UiInputData

  const update = useCallback((partial: Partial<UiInputData>) => {
    dispatch(updateElementData({ elementId: element.id, data: partial }))
  }, [dispatch, element.id])

  return (
    <Container label="Input" initialOpen>
      <TextField
        label="Placeholder"
        value={data.placeholder}
        onChange={(e) => update({ placeholder: e.target.value })}
      />
      <TextField
        label="Value"
        value={data.value}
        onChange={(e) => update({ value: e.target.value })}
      />
      <RangeField
        label="Font Size"
        value={data.fontSize}
        onChange={(e: any) => update({ fontSize: Number(e?.target?.value) })}
        isValidValue={(v: any) => !isNaN(Number(v)) && Number(v) > 0}
      />
      <ColorField
        label="Color"
        value={color4ToHex(data.color)}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const c = hexToColor4(e.target.value)
          update({ color: { ...c, a: data.color.a } })
        }}
      />
      <ColorField
        label="Placeholder Color"
        value={color4ToHex(data.placeholderColor)}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const c = hexToColor4(e.target.value)
          update({ placeholderColor: { ...c, a: data.placeholderColor.a } })
        }}
      />
      <Dropdown
        label="Font"
        options={[
          { label: 'Sans Serif', value: 'sans-serif' },
          { label: 'Serif', value: 'serif' },
          { label: 'Monospace', value: 'monospace' },
        ]}
        value={data.font}
        onChange={(e) => update({ font: e.target.value as FontType })}
      />
      <CheckboxField
        label="Disabled"
        checked={data.disabled}
        onChange={(e) => update({ disabled: !!e.target.checked })}
      />
    </Container>
  )
}

export default React.memo(UiInputSection)
