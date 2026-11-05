import { useRef, type KeyboardEvent } from 'react';
import { t } from '/@/modules/store/translation/utils';
import type { ManageTab } from '/shared/types/manage';

import { MapPinIcon, PublicIcon } from '../../Icons';

import { Tab, TabList } from './ManageTabs.styled';

export const MANAGE_PANEL_ID = 'manage-panel';

/** Id of a tab's button, which names the panel while that tab is selected. */
export const getManageTabId = (tab: ManageTab) => `manage-tab-${tab}`;

const TABS = [
  { value: 'worlds', label: 'manage.tabs.worlds', Icon: PublicIcon },
  { value: 'lands', label: 'manage.tabs.lands', Icon: MapPinIcon },
] as const;

const STEP_BY_KEY: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };

type Props = {
  value: ManageTab;
  onChange: (tab: ManageTab) => void;
  labelledBy: string;
};

export function ManageTabs({ value, onChange, labelledBy }: Props) {
  const buttons = useRef<Partial<Record<ManageTab, HTMLButtonElement | null>>>({});

  const handleKeyDown = (event: KeyboardEvent) => {
    const step = STEP_BY_KEY[event.key];
    if (!step) return;
    event.preventDefault();
    const index = TABS.findIndex(tab => tab.value === value);
    const next = TABS[(index + step + TABS.length) % TABS.length].value;
    onChange(next);
    buttons.current[next]?.focus();
  };

  return (
    <TabList
      role="tablist"
      aria-labelledby={labelledBy}
      onKeyDown={handleKeyDown}
    >
      {TABS.map(({ value: tab, label, Icon }) => (
        <Tab
          key={tab}
          ref={button => {
            buttons.current[tab] = button;
          }}
          id={getManageTabId(tab)}
          type="button"
          role="tab"
          aria-selected={tab === value}
          aria-controls={MANAGE_PANEL_ID}
          tabIndex={tab === value ? 0 : -1}
          onClick={() => onChange(tab)}
        >
          <Icon />
          {t(label)}
        </Tab>
      ))}
    </TabList>
  );
}
