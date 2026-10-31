import { useEffect, useRef, useState } from 'react';
import { AiOutlineSearch as SearchIcon } from 'react-icons/ai';
import { MdClose as ClearIcon } from 'react-icons/md';
import cx from 'classnames';

type Props = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  /** Wait this long after the last keystroke before reporting the change. */
  debounceMs?: number;
  className?: string;
};

export function AssetSearchField({
  value,
  placeholder,
  onChange,
  debounceMs = 0,
  className,
}: Props) {
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const lastReported = useRef(value);

  // Adopt resets coming from outside (breadcrumb clicks, "Clear") without fighting typing.
  useEffect(() => {
    if (value !== lastReported.current) {
      lastReported.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const report = (next: string) => {
    clearTimeout(timer.current);
    const send = () => {
      lastReported.current = next;
      onChange(next);
    };
    if (debounceMs > 0 && next !== '') timer.current = setTimeout(send, debounceMs);
    else send();
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
    report(event.target.value);
  };

  const handleClear = () => {
    setText('');
    report('');
  };

  return (
    <div className={cx('Assets-search', className)}>
      <SearchIcon />
      <input
        type="text"
        value={text}
        placeholder={placeholder}
        onChange={handleChange}
        onKeyDown={event => event.key === 'Escape' && handleClear()}
        aria-label={placeholder}
      />
      {text && (
        <button
          className="Assets-search-clear"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <ClearIcon />
        </button>
      )}
    </div>
  );
}
