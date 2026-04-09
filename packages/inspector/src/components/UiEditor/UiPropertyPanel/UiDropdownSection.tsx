import React, { useCallback } from 'react'
import { VscTrash, VscAdd } from 'react-icons/vsc'
import { useAppDispatch } from '../../../redux/hooks'
import { updateElementData } from '../../../redux/ui-editor'
import type { UiElementNode, UiDropdownData, FontType } from '../types'
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

const UiDropdownSection: React.FC<Props> = ({ element }) => {
  const dispatch = useAppDispatch()
  const data = element.elementData as UiDropdownData

  const update = useCallback((partial: Partial<UiDropdownData>) => {
    dispatch(updateElementData({ elementId: element.id, data: partial }))
  }, [dispatch, element.id])

  const handleAddOption = useCallback(() => {
    update({ options: [...data.options, `Option ${data.options.length + 1}`] })
  }, [update, data.options])

  const handleRemoveOption = useCallback((index: number) => {
    const next = data.options.filter((_, i) => i !== index)
    const selectedIndex = data.selectedIndex >= next.length ? Math.max(0, next.length - 1) : data.selectedIndex
    update({ options: next, selectedIndex })
  }, [update, data.options, data.selectedIndex])

  const handleEditOption = useCallback((index: number, value: string) => {
    const next = [...data.options]
    next[index] = value
    update({ options: next })
  }, [update, data.options])

  return (
    <Container label="Dropdown" initialOpen>
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: '#888' }}>Options</span>
          <span
            style={{ cursor: 'pointer', fontSize: 14, color: '#4285f4' }}
            onClick={handleAddOption}
          >
            <VscAdd />
          </span>
        </div>
        {data.options.map((opt, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <TextField
              value={opt}
              onChange={(e) => handleEditOption(i, e.target.value)}
            />
            <span
              style={{ cursor: 'pointer', fontSize: 12, color: '#f44', flexShrink: 0 }}
              onClick={() => handleRemoveOption(i)}
            >
              <VscTrash />
            </span>
          </div>
        ))}
      </div>
      <RangeField
        label="Selected"
        value={data.selectedIndex}
        onChange={(e: any) => update({ selectedIndex: Number(e?.target?.value) })}
        isValidValue={(v: any) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n < data.options.length; }}
      />
      <CheckboxField
        label="Accept Empty"
        checked={data.acceptEmpty}
        onChange={(e) => update({ acceptEmpty: !!e.target.checked })}
      />
      {data.acceptEmpty && (
        <TextField
          label="Empty Label"
          value={data.emptyLabel}
          onChange={(e) => update({ emptyLabel: e.target.value })}
        />
      )}
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
      <CheckboxField
        label="Disabled"
        checked={data.disabled}
        onChange={(e) => update({ disabled: !!e.target.checked })}
      />
    </Container>
  )
}

export default React.memo(UiDropdownSection)
