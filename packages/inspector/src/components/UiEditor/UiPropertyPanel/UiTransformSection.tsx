import React, { useCallback } from 'react'
import { useAppDispatch } from '../../../redux/hooks'
import { updateElementTransform } from '../../../redux/ui-editor'
import type { UiElementNode, UiTransformData, FlexDirection, JustifyContent, AlignItems, FlexWrap, PositionType, Overflow, PointerFilter } from '../types'
import { Container } from '../../Container'
import { Dropdown } from '../../ui/Dropdown'
import { TextField } from '../../ui/TextField'
import { RangeField } from '../../ui/RangeField'

interface Props {
  element: UiElementNode
}

const getInputValue = (e: any): string => e?.target?.value ?? ''

const UiTransformSection: React.FC<Props> = ({ element }) => {
  const dispatch = useAppDispatch()

  const update = useCallback((partial: Partial<UiTransformData>) => {
    dispatch(updateElementTransform({ elementId: element.id, transform: partial }))
  }, [dispatch, element.id])

  const parseSizeValue = (val: string): number | string => {
    if (val === 'auto') return 'auto'
    if (val.endsWith('%')) return val
    const num = parseFloat(val)
    return isNaN(num) ? 'auto' : num
  }

  const t = element.transform

  return (
    <>
      <Container label="Layout" initialOpen>
        <Dropdown
          label="Direction"
          options={[
            { label: 'Column', value: 'column' },
            { label: 'Row', value: 'row' },
            { label: 'Column Reverse', value: 'column-reverse' },
            { label: 'Row Reverse', value: 'row-reverse' },
          ]}
          value={t.flexDirection}
          onChange={(e) => update({ flexDirection: e.target.value as FlexDirection })}
        />
        <Dropdown
          label="Justify"
          options={[
            { label: 'Start', value: 'flex-start' },
            { label: 'Center', value: 'center' },
            { label: 'End', value: 'flex-end' },
            { label: 'Space Between', value: 'space-between' },
            { label: 'Space Around', value: 'space-around' },
            { label: 'Space Evenly', value: 'space-evenly' },
          ]}
          value={t.justifyContent}
          onChange={(e) => update({ justifyContent: e.target.value as JustifyContent })}
        />
        <Dropdown
          label="Align"
          options={[
            { label: 'Auto', value: 'auto' },
            { label: 'Start', value: 'flex-start' },
            { label: 'Center', value: 'center' },
            { label: 'End', value: 'flex-end' },
            { label: 'Stretch', value: 'stretch' },
            { label: 'Baseline', value: 'baseline' },
          ]}
          value={t.alignItems}
          onChange={(e) => update({ alignItems: e.target.value as AlignItems })}
        />
        <Dropdown
          label="Wrap"
          options={[
            { label: 'No Wrap', value: 'nowrap' },
            { label: 'Wrap', value: 'wrap' },
            { label: 'Wrap Reverse', value: 'wrap-reverse' },
          ]}
          value={t.flexWrap}
          onChange={(e) => update({ flexWrap: e.target.value as FlexWrap })}
        />
      </Container>

      <Container label="Size" initialOpen>
        <TextField
          label="Width"
          value={String(t.width)}
          onChange={(e) => update({ width: parseSizeValue(e.target.value) })}
        />
        <TextField
          label="Height"
          value={String(t.height)}
          onChange={(e) => update({ height: parseSizeValue(e.target.value) })}
        />
        <TextField
          label="Min W"
          value={String(t.minWidth)}
          onChange={(e) => update({ minWidth: parseSizeValue(e.target.value) })}
        />
        <TextField
          label="Max W"
          value={String(t.maxWidth)}
          onChange={(e) => update({ maxWidth: parseSizeValue(e.target.value) })}
        />
        <TextField
          label="Min H"
          value={String(t.minHeight)}
          onChange={(e) => update({ minHeight: parseSizeValue(e.target.value) })}
        />
        <TextField
          label="Max H"
          value={String(t.maxHeight)}
          onChange={(e) => update({ maxHeight: parseSizeValue(e.target.value) })}
        />
      </Container>

      <Container label="Spacing" initialOpen={false}>
        <RangeField
          label="Pad Top"
          value={t.paddingTop}
          onChange={(e: any) => update({ paddingTop: Number(getInputValue(e)) })}
          isValidValue={(v: any) => !isNaN(Number(v))}
        />
        <RangeField
          label="Pad Right"
          value={t.paddingRight}
          onChange={(e: any) => update({ paddingRight: Number(getInputValue(e)) })}
          isValidValue={(v: any) => !isNaN(Number(v))}
        />
        <RangeField
          label="Pad Bottom"
          value={t.paddingBottom}
          onChange={(e: any) => update({ paddingBottom: Number(getInputValue(e)) })}
          isValidValue={(v: any) => !isNaN(Number(v))}
        />
        <RangeField
          label="Pad Left"
          value={t.paddingLeft}
          onChange={(e: any) => update({ paddingLeft: Number(getInputValue(e)) })}
          isValidValue={(v: any) => !isNaN(Number(v))}
        />
        <RangeField
          label="Margin Top"
          value={t.marginTop}
          onChange={(e: any) => update({ marginTop: Number(getInputValue(e)) })}
          isValidValue={(v: any) => !isNaN(Number(v))}
        />
        <RangeField
          label="Margin Right"
          value={t.marginRight}
          onChange={(e: any) => update({ marginRight: Number(getInputValue(e)) })}
          isValidValue={(v: any) => !isNaN(Number(v))}
        />
        <RangeField
          label="Margin Bottom"
          value={t.marginBottom}
          onChange={(e: any) => update({ marginBottom: Number(getInputValue(e)) })}
          isValidValue={(v: any) => !isNaN(Number(v))}
        />
        <RangeField
          label="Margin Left"
          value={t.marginLeft}
          onChange={(e: any) => update({ marginLeft: Number(getInputValue(e)) })}
          isValidValue={(v: any) => !isNaN(Number(v))}
        />
      </Container>

      <Container label="Position" initialOpen={false}>
        <Dropdown
          label="Type"
          options={[
            { label: 'Relative', value: 'relative' },
            { label: 'Absolute', value: 'absolute' },
          ]}
          value={t.positionType}
          onChange={(e) => update({ positionType: e.target.value as PositionType })}
        />
        {t.positionType === 'absolute' && (
          <>
            <TextField
              label="Top"
              value={String(t.positionTop)}
              onChange={(e) => update({ positionTop: parseSizeValue(e.target.value) })}
            />
            <TextField
              label="Right"
              value={String(t.positionRight)}
              onChange={(e) => update({ positionRight: parseSizeValue(e.target.value) })}
            />
            <TextField
              label="Bottom"
              value={String(t.positionBottom)}
              onChange={(e) => update({ positionBottom: parseSizeValue(e.target.value) })}
            />
            <TextField
              label="Left"
              value={String(t.positionLeft)}
              onChange={(e) => update({ positionLeft: parseSizeValue(e.target.value) })}
            />
          </>
        )}
      </Container>

      <Container label="Flex" initialOpen={false}>
        <RangeField
          label="Grow"
          value={t.flexGrow}
          onChange={(e: any) => update({ flexGrow: Number(getInputValue(e)) })}
          isValidValue={(v: any) => !isNaN(Number(v))}
        />
        <RangeField
          label="Shrink"
          value={t.flexShrink}
          onChange={(e: any) => update({ flexShrink: Number(getInputValue(e)) })}
          isValidValue={(v: any) => !isNaN(Number(v))}
        />
        <TextField
          label="Basis"
          value={String(t.flexBasis)}
          onChange={(e) => update({ flexBasis: parseSizeValue(e.target.value) })}
        />
      </Container>

      <Container label="Visual" initialOpen={false}>
        <Dropdown
          label="Overflow"
          options={[
            { label: 'Visible', value: 'visible' },
            { label: 'Hidden', value: 'hidden' },
            { label: 'Scroll', value: 'scroll' },
          ]}
          value={t.overflow}
          onChange={(e) => update({ overflow: e.target.value as Overflow })}
        />
        <RangeField
          label="Opacity"
          value={t.opacity}
          onChange={(e: any) => update({ opacity: Number(getInputValue(e)) })}
          isValidValue={(v: any) => { const n = Number(v); return !isNaN(n) && n >= 0 && n <= 1; }}
        />
        <RangeField
          label="Z-Index"
          value={t.zIndex}
          onChange={(e: any) => update({ zIndex: Number(getInputValue(e)) })}
          isValidValue={(v: any) => !isNaN(Number(v))}
        />
        <Dropdown
          label="Pointer"
          options={[
            { label: 'None', value: 'none' },
            { label: 'Block', value: 'block' },
          ]}
          value={t.pointerFilter}
          onChange={(e) => update({ pointerFilter: e.target.value as PointerFilter })}
        />
      </Container>
    </>
  )
}

export default React.memo(UiTransformSection)
