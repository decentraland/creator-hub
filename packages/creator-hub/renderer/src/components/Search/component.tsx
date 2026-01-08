import React, { useCallback } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import { OutlinedInput } from 'decentraland-ui2';
import type { OutlinedInputProps } from 'decentraland-ui2';
import { debounce } from '/shared/utils';
import './styles.css';

type Props = OutlinedInputProps & {
  onChange?: (value: string) => void;
};

const Search: React.FC<Props> = React.memo(props => {
  const onChangeDebounced = useCallback(
    debounce((event: React.ChangeEvent<HTMLInputElement>) => {
      if (props.onChange) {
        props.onChange(event.target.value);
      }
    }, 500),
    [props.onChange],
  );

  return (
    <OutlinedInput
      {...props}
      endAdornment={<SearchIcon />}
      onChange={onChangeDebounced}
      className="SearchInput"
    />
  );
});

export { Search };
