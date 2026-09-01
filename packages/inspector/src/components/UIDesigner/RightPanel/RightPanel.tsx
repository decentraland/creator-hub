import React, { useMemo, useState } from 'react';

import { useAppSelector } from '../../../redux/hooks';
import { getSelectedNode } from '../../../redux/ui-designer';
import { Box } from '../../Box';
import { findCodeNode, useCodeState } from '../code/store';
import type { CodeUINode } from '../code/types';
import { GuiGridIcon } from '../shared/widget-icons';
import { PropertyPanel } from './PropertyPanel';
import { CodeVariablesPanel } from './LogicPanel/CodeVariablesPanel';
import { CodePropsPanel } from './LogicPanel/CodePropsPanel';
import { CodeCallbacksPanel } from './LogicPanel/CodeCallbacksPanel';
import { ComponentRefPanel } from './LogicPanel/ComponentRefPanel';

import '../UIDesigner.css';

type RightTab = 'properties' | 'logic';

/** Right rail as tabs: Properties (per-node) and Logic (per-root). */
const RightPanel: React.FC = () => {
  const [tab, setTab] = useState<RightTab>('properties');
  const selected = useAppSelector(getSelectedNode);
  const codeState = useCodeState();

  const codeNode = useMemo(
    () =>
      selected !== null
        ? findCodeNode(
            codeState.parsed?.root as CodeUINode | undefined,
            selected as unknown as number,
          )
        : undefined,
    [codeState, selected],
  );

  const instances = useMemo(() => {
    if (!codeNode) return [];
    if (codeNode.componentRef) return [codeNode];
    return (codeNode.children ?? []).filter(child => child.componentRef);
  }, [codeNode]);

  return (
    <Box className="ui-designer-right-rail">
      <div
        className="ui-designer-right-rail-tabs"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'properties'}
          className={`ui-designer-right-rail-tab${tab === 'properties' ? ' active' : ''}`}
          onClick={() => setTab('properties')}
        >
          Properties
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'logic'}
          className={`ui-designer-right-rail-tab${tab === 'logic' ? ' active' : ''}`}
          onClick={() => setTab('logic')}
        >
          Logic
        </button>
      </div>
      <div className="ui-designer-right-rail-tabpanel">
        {tab === 'properties' ? (
          <PropertyPanel />
        ) : instances.length > 0 ? (
          <>
            {instances.map(instance => (
              <ComponentRefPanel
                key={instance.entity as unknown as number}
                node={instance}
              />
            ))}
            <p className="ui-designer-logic-note">
              You're setting the inputs this instance passes to its component. Variables and Events
              belong to the GUI, not this component — open it to edit those.
            </p>
          </>
        ) : (
          <>
            {codeState.filename ? (
              <div className="ui-designer-code-gui-header">
                <GuiGridIcon />
                <span className="ui-designer-code-gui-name">
                  {codeState.filename
                    .split('/')
                    .pop()
                    ?.replace(/\.tsx$/, '')}
                </span>
              </div>
            ) : null}
            <CodeVariablesPanel />
            <CodePropsPanel />
            <CodeCallbacksPanel />
          </>
        )}
      </div>
    </Box>
  );
};

export default React.memo(RightPanel);
export { RightPanel };
