import React, { useCallback } from 'react'
import { useAppDispatch } from '../../../redux/hooks'
import { updateElementData } from '../../../redux/ui-editor'
import type { UiElementNode, UiButtonData, ButtonVariant, FontType } from '../types'
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

const UiButtonSection: React.FC<Props> = ({ element }) => {
  const dispatch = useAppDispatch()
  const data = element.elementData as UiButtonData

  const update = useCallback((partial: Partial<UiButtonData>) => {
    dispatch(updateElementData({ elementId: element.id, data: partial }))
  }, [dispatch, element.id])

  return (
    <Container label="Button" initialOpen>
      <TextField
        label="Text"
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
      <Dropdown
        label="Variant"
        options={[
          { label: 'Primary', value: 'primary' },
          { label: 'Secondary', value: 'secondary' },
        ]}
        value={data.variant}
        onChange={(e) => update({ variant: e.target.value as ButtonVariant })}
      />
      <CheckboxField
        label="Disabled"
        checked={data.disabled}
        onChange={(e) => update({ disabled: !!e.target.checked })}
      />
    </Container>
  )
}

export default React.memo(UiButtonSection)
