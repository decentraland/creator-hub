import React, { useCallback } from 'react'
import { useAppDispatch } from '../../../redux/hooks'
import { updateElementData } from '../../../redux/ui-editor'
import type { UiElementNode, UiTextData, TextAlign, TextWrap, FontType } from '../types'
import { Container } from '../../Container'
import { TextField } from '../../ui/TextField'
import { Dropdown } from '../../ui/Dropdown'
import { RangeField } from '../../ui/RangeField'
import { ColorField } from '../../ui/ColorField'
import { color4ToHex, hexToColor4 } from './color-utils'

interface Props {
  element: UiElementNode
}

const UiTextSection: React.FC<Props> = ({ element }) => {
  const dispatch = useAppDispatch()
  const data = element.elementData as UiTextData

  const update = useCallback((partial: Partial<UiTextData>) => {
    dispatch(updateElementData({ elementId: element.id, data: partial }))
  }, [dispatch, element.id])

  return (
    <Container label="Text" initialOpen>
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
        label="Align"
        options={[
          { label: 'Top Left', value: 'top-left' },
          { label: 'Top Center', value: 'top-center' },
          { label: 'Top Right', value: 'top-right' },
          { label: 'Middle Left', value: 'middle-left' },
          { label: 'Middle Center', value: 'middle-center' },
          { label: 'Middle Right', value: 'middle-right' },
          { label: 'Bottom Left', value: 'bottom-left' },
          { label: 'Bottom Center', value: 'bottom-center' },
          { label: 'Bottom Right', value: 'bottom-right' },
        ]}
        value={data.textAlign}
        onChange={(e) => update({ textAlign: e.target.value as TextAlign })}
      />
      <Dropdown
        label="Wrap"
        options={[
          { label: 'No Wrap', value: 'nowrap' },
          { label: 'Wrap', value: 'wrap' },
        ]}
        value={data.textWrap}
        onChange={(e) => update({ textWrap: e.target.value as TextWrap })}
      />
    </Container>
  )
}

export default React.memo(UiTextSection)
