import { TextField, InputAdornment } from 'decentraland-ui2';
import SearchIcon from '@mui/icons-material/Search';

import './styles.css';

type Props = {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function PageSearchField({ placeholder, value, onChange, className = '' }: Props) {
  return (
    <TextField
      className={`PageSearchField ${className}`.trim()}
      placeholder={placeholder}
      size="small"
      value={value}
      onChange={e => onChange(e.target.value)}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ color: 'rgba(255,255,255,0.35)', fontSize: 20 }} />
          </InputAdornment>
        ),
      }}
    />
  );
}
