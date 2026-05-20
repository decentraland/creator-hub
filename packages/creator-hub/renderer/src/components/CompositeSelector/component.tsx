import { useCallback, useMemo, useState } from 'react';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Menu, MenuItem } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';

import type { Props } from './types';

import './styles.css';

const MAIN_COMPOSITE_RELATIVE = 'assets/scene/main.composite';

export function CompositeSelector({
  composites,
  selected,
  projectTitle,
  onSelect,
  onManage,
}: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const selectedLabel = useMemo(() => {
    const entry = composites.find(c => c.relativePath === selected);
    if (!entry || entry.isMain) return projectTitle;
    return entry.displayName;
  }, [composites, selected, projectTitle]);

  const handleSelect = useCallback(
    (relativePath: string) => {
      setAnchorEl(null);
      if (relativePath !== selected) onSelect(relativePath);
    },
    [onSelect, selected],
  );

  const handleManage = useCallback(() => {
    setAnchorEl(null);
    onManage();
  }, [onManage]);

  return (
    <div className="CompositeSelector">
      <button
        type="button"
        className="CompositeSelectorButton"
        onClick={handleOpen}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : 'false'}
      >
        <span className="label">{selectedLabel}</span>
        <KeyboardArrowDownIcon />
      </button>
      <Menu
        classes={{ root: 'CompositeSelectorMenu' }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
      >
        {composites.map(entry => (
          <MenuItem
            key={entry.relativePath}
            selected={entry.relativePath === selected}
            onClick={() => handleSelect(entry.relativePath)}
          >
            <span className="composite-name">
              {entry.isMain ? projectTitle : entry.displayName}
            </span>
          </MenuItem>
        ))}
        <MenuItem
          className="manage-item"
          onClick={handleManage}
        >
          {t('editor.composites.manage')}
        </MenuItem>
      </Menu>
    </div>
  );
}

export { MAIN_COMPOSITE_RELATIVE };
