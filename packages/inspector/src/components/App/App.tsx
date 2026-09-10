import React, { useCallback, useMemo, useState } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import cx from 'classnames';

import { useSelectedEntity } from '../../hooks/sdk/useSelectedEntity';
import { useInspectorUIState } from '../../hooks/sdk/useInspectorUIState';
import { useSyncSceneRunWithMode } from '../../hooks/useSyncSceneRunWithMode';
import { useRestorePersistedMode } from '../../hooks/useRestorePersistedMode';
import { useWindowSize } from '../../hooks/useWindowSize';
import { getConfig } from '../../lib/logic/config';
import { useAppSelector } from '../../redux/hooks';
import { selectDataLayerError, selectSceneInfo } from '../../redux/data-layer';
import { selectEngines } from '../../redux/sdk';
import { getHiddenPanels } from '../../redux/ui';
import { PanelName } from '../../redux/ui/types';

import { EntityInspector } from '../EntityInspector';
import { Hierarchy } from '../Hierarchy';
import { Loading } from '../Loading';
import { ModeSwitcher } from '../ModeSwitcher';
import { Renderer } from '../Renderer';
import { Box } from '../Box';
import { Toolbar } from '../Toolbar';
import Assets from '../Assets';
import { SceneInfoPanel } from '../SceneInfoPanel';
import UIDesigner from '../UIDesigner/UIDesigner';
import { SdkUpgradeNotice } from '../UIDesigner/SdkUpgradeNotice';
import { LeftPanel } from '../UIDesigner/LeftPanel';
import { RightPanel } from '../UIDesigner/RightPanel';
import { Palette } from '../UIDesigner/Palette';
import { UIDesignerToolbar } from '../UIDesigner/Toolbar';

import './App.css';

const App = () => {
  const selectedEntity = useSelectedEntity();
  const { height } = useWindowSize();

  const sdkInitialized = useAppSelector(selectEngines).inspector;
  const hiddenPanels = useAppSelector(getHiddenPanels);
  const sceneInfoContent = useAppSelector(selectSceneInfo).content;
  const disconnected = useAppSelector(selectDataLayerError);
  const [uiState] = useInspectorUIState();
  const isUIDesigner = !hiddenPanels[PanelName.UI_DESIGNER];
  const uiEditorSupported = useMemo(() => getConfig().uiEditorSupported, []);

  useRestorePersistedMode();

  useSyncSceneRunWithMode();

  const modeResolved = uiState !== null;

  const isReady = !!sdkInitialized && modeResolved;

  const [isAssetsPanelCollapsed, setIsAssetsPanelCollapsed] = useState(false);

  const handleToggleAssetsPanel = useCallback((collapse: boolean) => {
    setIsAssetsPanelCollapsed(collapse);
  }, []);

  // Collapse the panel at 75 pixels
  const collapseAt = (75 / Math.max(1, height ?? 1)) * 100;
  // Footer's height is 48 pixels, so we need to calculate the percentage of the screen that it takes to pass as the minSize prop for the Panel
  const footerMin = (48 / Math.max(1, height ?? 1)) * 100;

  return (
    <div
      className={cx('App', { 'is-ready': isReady })}
      style={{ pointerEvents: disconnected ? 'none' : 'auto' }}
    >
      <PanelGroup
        direction="vertical"
        autoSaveId="vertical"
      >
        <Panel>
          <PanelGroup
            direction="horizontal"
            autoSaveId="horizontal"
          >
            {!hiddenPanels[PanelName.ENTITIES] && (
              <>
                <Panel
                  defaultSize={15}
                  minSize={15}
                  order={1}
                >
                  <Box className="composite-inspector">
                    <ModeSwitcher />
                    {modeResolved ? isUIDesigner ? <LeftPanel /> : <Hierarchy /> : null}
                  </Box>
                </Panel>
                <PanelResizeHandle className="horizontal-handle" />
              </>
            )}

            <Panel
              minSize={30}
              order={2}
            >
              <Box
                className={cx('composite-renderer', {
                  'no-box':
                    !!hiddenPanels[PanelName.ENTITIES] &&
                    !!hiddenPanels[PanelName.ASSETS] &&
                    !!hiddenPanels[PanelName.COMPONENTS],
                })}
              >
                {!hiddenPanels[PanelName.TOOLBAR] &&
                  (isUIDesigner ? <UIDesignerToolbar /> : <Toolbar />)}
                <div
                  className="renderer-host"
                  style={{
                    display: !hiddenPanels[PanelName.UI_DESIGNER] ? 'none' : 'contents',
                  }}
                >
                  <Renderer />
                </div>
                {modeResolved && !hiddenPanels[PanelName.UI_DESIGNER] && <UIDesigner />}
                {!modeResolved && (
                  <div className="mode-pending">
                    <Loading />
                  </div>
                )}
              </Box>
            </Panel>
            {uiState?.sceneInfoPanelVisible && !!sceneInfoContent && (
              <>
                <PanelResizeHandle className="horizontal-handle" />
                <Panel
                  defaultSize={25.5}
                  minSize={20}
                  order={3}
                >
                  <Box className="scene-info-panel">
                    <SceneInfoPanel />
                  </Box>
                </Panel>
              </>
            )}
            {!hiddenPanels[PanelName.COMPONENTS] && (isUIDesigner || selectedEntity !== null) && (
              <>
                <PanelResizeHandle className="horizontal-handle" />
                <Panel
                  defaultSize={25.5}
                  minSize={20}
                  order={4}
                >
                  <Box className="entity-inspector">
                    {isUIDesigner ? <RightPanel /> : <EntityInspector />}
                  </Box>
                </Panel>
              </>
            )}
          </PanelGroup>
        </Panel>
        {!hiddenPanels[PanelName.ASSETS] && (
          <>
            <PanelResizeHandle className="vertical-handle" />
            <Panel
              id={isUIDesigner ? 'palette' : 'assets'}
              defaultSize={isUIDesigner ? 14 : 30}
              {...(height
                ? { collapsible: true, collapsedSize: footerMin, minSize: collapseAt }
                : {})}
              onCollapse={() => handleToggleAssetsPanel(true)}
              onExpand={() => handleToggleAssetsPanel(false)}
            >
              <Box className="composite-renderer">
                {isUIDesigner ? (
                  <div className="ui-designer-bottom-bar">
                    <Palette />
                  </div>
                ) : (
                  <Assets isAssetsPanelCollapsed={isAssetsPanelCollapsed} />
                )}
              </Box>
            </Panel>
          </>
        )}
      </PanelGroup>
      {isUIDesigner && modeResolved && !uiEditorSupported && <SdkUpgradeNotice />}
    </div>
  );
};

export default React.memo(App);
