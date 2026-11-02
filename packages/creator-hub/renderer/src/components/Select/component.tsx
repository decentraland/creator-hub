import cx from 'classnames';
import { type SelectProps, Select as SelectUI } from 'decentraland-ui2';
import './styles.css';

export type Props<T extends string | string[]> = SelectProps<T> & {
  maxSelected?: number;
};

export function Select<T extends string | string[]>({ maxSelected, ...props }: Props<T>) {
  return (
    <SelectUI
      {...props}
      className={cx('Select', props.className)}
      variant="standard"
      value={props.value}
      onChange={(event, child) => {
        if (
          props.onChange &&
          (!props.multiple ||
            !maxSelected ||
            (event.target.value as string[]).length <= maxSelected)
        ) {
          props.onChange(event, child);
        }
      }}
      MenuProps={{
        className: 'SelectMenu',
        /*
         * Without this the menu locks body scroll while open, which removes the
         * app scrollbar and shifts the whole layout sideways as it opens.
         */
        disableScrollLock: true,
      }}
    >
      {props.children}
    </SelectUI>
  );
}
