import { useId } from 'react';

import { t } from '/@/modules/store/translation/utils';

import { FormTextInput } from '../../TextInput';
import type { FieldError } from './details';
import {
  Counter,
  DescriptionInput,
  ErrorText,
  Field,
  FieldTitle,
  Help,
  InputSlot,
} from './DetailsTab.styled';

const INPUT = { single: FormTextInput, multi: DescriptionInput };

type Props = {
  label: string;
  value: string;
  max: number;
  error: FieldError;
  placeholder: string;
  multiline: 'single' | 'multi';
  onChange: (value: string) => void;
};

/** A labelled Details text field with its live counter and limit error. */
export function DetailsField({
  label,
  value,
  max,
  error,
  placeholder,
  multiline,
  onChange,
}: Props) {
  const inputId = useId();
  const helpId = useId();
  const Input = INPUT[multiline];
  return (
    <Field>
      <FieldTitle htmlFor={inputId}>{label}</FieldTitle>
      <InputSlot>
        <Input
          id={inputId}
          value={value}
          placeholder={placeholder}
          multiline={multiline === 'multi'}
          error={!!error}
          onChange={event => onChange(event.target.value)}
          inputProps={{ 'aria-describedby': helpId, 'aria-invalid': !!error }}
        />
        <Help id={helpId}>
          {error && <ErrorText>{t(error.key, { max: error.max })}</ErrorText>}
          <Counter over={value.length > max ? 'over' : 'within'}>
            {t('land_detail.details.counter', { count: value.length, max })}
          </Counter>
        </Help>
      </InputSlot>
    </Field>
  );
}
