import { Link } from 'react-router-dom';

import { t } from '/@/modules/store/translation/utils';
import { Button } from '../../Button';

import { type Props } from './types';

import './styles.css';

export function OptionBox({
  thumbnailSrc,
  title,
  description,
  buttonText,
  onClickPublish,
  learnMoreUrl,
}: Props) {
  return (
    <div className="OptionBox">
      <img className="thumbnail" src={thumbnailSrc} />
      <h3>{title}</h3>
      <span className="description">{description}</span>
      <Button onClick={onClickPublish}>{buttonText}</Button>
      {learnMoreUrl  && <Link className="learn-more" to={learnMoreUrl}>{t('option_box.learn_more')}</Link>}
    </div>
  );
}
