import { useEffect, useId, useState } from 'react';

import { t } from '/@/modules/store/translation/utils';

import { FieldTitle } from '../../LandDetailPage/DetailsTab/DetailsTab.styled';
import { SelectCheckbox } from '../../LandDetailPage/SelectCheckbox';
import { formatTime, MIDDAY_SECONDS, parseTime } from './settings';
import { CheckRow, Row, SectionBlock, Slider, SmallInput } from './SettingsTab.styled';

const STEP_SECONDS = 900;
const LAST_MINUTE_SECONDS = 86340;

const STEPS: Record<string, (seconds: number) => number> = {
  ArrowRight: seconds => seconds + STEP_SECONDS,
  ArrowUp: seconds => seconds + STEP_SECONDS,
  ArrowLeft: seconds => seconds - STEP_SECONDS,
  ArrowDown: seconds => seconds - STEP_SECONDS,
  Home: () => 0,
  End: () => LAST_MINUTE_SECONDS,
};

const clamp = (seconds: number) => Math.min(LAST_MINUTE_SECONDS, Math.max(0, seconds));

/** The skybox time: Auto (null, Decentraland time) or a fixed time picked on the slider or typed as HH:MM. */
export function SkyboxField({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const titleId = useId();
  const seconds = value ?? MIDDAY_SECONDS;
  const [typed, setTyped] = useState(formatTime(seconds));

  useEffect(() => setTyped(formatTime(seconds)), [seconds]);

  return (
    <SectionBlock className="Loose">
      <FieldTitle
        as="span"
        id={titleId}
      >
        {t('world_detail.settings.skybox')}
      </FieldTitle>
      <CheckRow>
        <SelectCheckbox
          checked={value === null}
          onChange={event => onChange(event.target.checked ? null : MIDDAY_SECONDS)}
        />
        {t('world_detail.settings.skybox_auto')}
      </CheckRow>
      <Row>
        <Slider
          type="range"
          min={0}
          max={LAST_MINUTE_SECONDS}
          step={60}
          value={seconds}
          disabled={value === null}
          aria-label={t('world_detail.settings.skybox_slider')}
          aria-valuetext={formatTime(seconds)}
          onChange={event => onChange(Number(event.target.value))}
          onKeyDown={event => {
            const step = STEPS[event.key];
            if (!step) return;
            event.preventDefault();
            onChange(clamp(step(seconds)));
          }}
        />
        <SmallInput
          value={typed}
          disabled={value === null}
          inputProps={{ 'aria-labelledby': titleId }}
          onChange={event => {
            setTyped(event.target.value);
            const parsed = parseTime(event.target.value);
            if (parsed !== null) onChange(parsed);
          }}
          onBlur={() => setTyped(formatTime(seconds))}
        />
      </Row>
    </SectionBlock>
  );
}
