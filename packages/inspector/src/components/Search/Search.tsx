import React from 'react';

import { Input } from '../Input';
import SearchIcon from '../Icons/Search';
import type { PropTypes } from './types';

import './Search.css';

function Search(props: PropTypes) {
  return (
    <div
      className="Search"
      onContextMenu={e => e.stopPropagation()}
    >
      <SearchIcon />
      <Input {...props} />
    </div>
  );
}

export default Search;
