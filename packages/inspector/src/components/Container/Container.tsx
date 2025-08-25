import React, { useCallback, useMemo, useState } from 'react';
import { IoIosArrowDown, IoIosArrowForward } from 'react-icons/io';
import { FiAlertTriangle as WarningIcon } from 'react-icons/fi';
import { VscTrash as RemoveIcon } from 'react-icons/vsc';
import cx from 'classnames';
import { Button } from '../Button';
import { InfoTooltip } from '../ui/InfoTooltip';
import MoreOptionsMenu from '../EntityInspector/MoreOptionsMenu';

/**
 * ContainerContent is a wrapper component that allows returning both main content
 * and right content from within a field renderer, while ensuring they become
 * direct children of the Container.
 */
export const ContainerContent: React.FC<{
  content: React.ReactNode;
  rightContent?: React.ReactNode;
}> = _ => {
  return null;
};

import { type Props } from './types';

import './Container.css';

const Container: React.FC<React.PropsWithChildren<Props>> = props => {
  const [open, setOpen] = useState<boolean>(props.initialOpen ?? true);
  const Icon = open ? <IoIosArrowDown className="icon" /> : <IoIosArrowForward className="icon" />;

  const { children, rightContentFromChildren } = useMemo(() => {
    const childrenArray = React.Children.toArray(props.children);

    // Find ContainerContent
    const containerContentIndex = childrenArray.findIndex(
      child => React.isValidElement(child) && child.type === ContainerContent,
    );

    // Handle ContainerContent (it can provide both content and right content)
    if (containerContentIndex !== -1) {
      const containerContent = childrenArray[containerContentIndex];
      const otherChildren = childrenArray.filter((_, index) => index !== containerContentIndex);

      if (React.isValidElement(containerContent)) {
        const { content, rightContent } = containerContent.props;
        return {
          children: [...otherChildren, content],
          rightContentFromChildren: rightContent || null,
        };
      }
    }

    return {
      children: childrenArray,
      rightContentFromChildren: null,
    };
  }, [props.children]);

  const renderIndicator = useCallback(() => {
    if (props.indicator) {
      return (
        <span className="indicator">
          {typeof props.indicator === 'boolean' ? (
            <WarningIcon />
          ) : typeof props.indicator === 'string' ? (
            <InfoTooltip
              text={props.indicator}
              type="warning"
              position="top center"
            />
          ) : (
            props.indicator
          )}
        </span>
      );
    }

    return null;
  }, [props.indicator]);

  const finalRightContent = rightContentFromChildren || props.rightContent;

  const shouldRenderRightContent = useMemo(() => {
    return finalRightContent || props.onRemoveContainer;
  }, [finalRightContent, props.onRemoveContainer]);

  const renderRightContent = useCallback(() => {
    return (
      <div className="RightContent">
        {finalRightContent}
        {props.onRemoveContainer && (
          <MoreOptionsMenu>
            <Button
              className="RemoveButton"
              onClick={props.onRemoveContainer}
            >
              <RemoveIcon /> Delete Component
            </Button>
          </MoreOptionsMenu>
        )}
      </div>
    );
  }, [finalRightContent, props.onRemoveContainer]);

  return (
    <div
      className={cx('Container', props.className, {
        open,
        border: props.border,
        'with-gap': props.gap,
      })}
    >
      {props.label && (
        <div
          className="title"
          onClick={() => setOpen(!open)}
        >
          {Icon}
          <span>{props.label}</span>
          {renderIndicator()}
          {shouldRenderRightContent && renderRightContent()}
        </div>
      )}
      {open && <div className="content">{children}</div>}
    </div>
  );
};

export default React.memo(Container);
