import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Alert,
  Box,
  Typography,
  TextField,
  IconButton,
} from 'decentraland-ui2';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SettingsIcon from '@mui/icons-material/Settings';

import { misc, blender } from '#preload';
import { BlenderSyncPreview } from './BlenderSyncPreview';
import type { BlenderWorkflowProps, BlenderSyncState } from './types';
import type { EntityData } from '/shared/types/ipc';

import './styles.css';

interface BlenderWorkflowInternalProps extends BlenderWorkflowProps {
  rpc?: { scene?: { getSceneEntities?: () => Promise<{ entities: EntityData[] }> } };
}

export function BlenderWorkflow({ open, onClose, projectPath, onSyncComplete, rpc }: BlenderWorkflowInternalProps) {
  const [state, setState] = useState<BlenderSyncState>({
    isDetecting: false,
    isSyncing: false,
    blenderInfo: null,
    linkedBlendFile: null,
    changes: null,
    metadata: null,
    error: null,
    showPreview: false,
  });

  // Detect Blender on mount and load last used .blend file
  useEffect(() => {
    if (open) {
      if (!state.blenderInfo && !state.isDetecting) {
        detectBlender();
      }
      // Load last used .blend file
      const lastFile = localStorage.getItem('lastBlenderFile');
      if (lastFile && !state.linkedBlendFile) {
        setState(prev => ({ ...prev, linkedBlendFile: lastFile }));
      }
    }
  }, [open]);

  const detectBlender = useCallback(async () => {
    setState(prev => ({ ...prev, isDetecting: true, error: null }));
    
    try {
      const info = await blender.detectBlender();
      
      if (info && info.isValid) {
        setState(prev => ({ ...prev, blenderInfo: info, isDetecting: false }));
      } else {
        setState(prev => ({
          ...prev,
          blenderInfo: null,
          isDetecting: false,
          error: 'Blender not found. Please install Blender or set a custom path.',
        }));
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isDetecting: false,
        error: `Failed to detect Blender: ${error.message}`,
      }));
    }
  }, []);

  const handleSelectBlendFile = useCallback(async () => {
    try {
      console.log('[Blender Workflow] Opening file dialog for .blend file...');
      
      const result = await misc.showOpenDialog({
        title: 'Select Blender Scene',
        filters: [{ name: 'Blender Files', extensions: ['blend'] }],
        properties: ['openFile'],
      });

      console.log('[Blender Workflow] Dialog result:', result);

      if (result && result.length > 0) {
        const blendFile = result[0];
        setState(prev => ({ ...prev, linkedBlendFile: blendFile, error: null }));
        // Store in localStorage for quick re-sync
        localStorage.setItem('lastBlenderFile', blendFile);
      }
    } catch (error: any) {
      console.error('[Blender Workflow] Error selecting file:', error);
      setState(prev => ({ ...prev, error: `Failed to select .blend file: ${error.message || String(error)}` }));
    }
  }, []);

  const handleSelectBlenderPath = useCallback(async () => {
    try {
      console.log('[Blender Workflow] Opening file dialog for Blender executable...');
      
      const result = await misc.showOpenDialog({
        title: 'Select Blender Executable',
        filters: [
          { name: 'Blender Executable', extensions: ['exe', 'app', ''] },
        ],
        properties: ['openFile'],
      });

      console.log('[Blender Workflow] Blender path dialog result:', result);

      if (result && result.length > 0) {
        const path = result[0];
        
        console.log('[Blender Workflow] Validating path:', path);
        // Validate the path
        const info = await blender.validateBlenderPath(path);
        console.log('[Blender Workflow] Validation result:', info);
        
        if (info && info.isValid) {
          await blender.setCustomBlenderPath(path);
          setState(prev => ({ ...prev, blenderInfo: info, error: null }));
        } else {
          setState(prev => ({
            ...prev,
            error: 'Invalid Blender executable. Please select a valid Blender installation.',
          }));
        }
      }
    } catch (error: any) {
      console.error('[Blender Workflow] Error selecting Blender path:', error);
      setState(prev => ({ ...prev, error: `Failed to set Blender path: ${error.message || String(error)}` }));
    }
  }, []);

  const handleSync = useCallback(async () => {
    if (!state.linkedBlendFile) {
      setState(prev => ({ ...prev, error: 'Please select a Blender file first.' }));
      return;
    }

    setState(prev => ({ ...prev, isSyncing: true, error: null, changes: null }));

    try {
      // Get current scene entities from Inspector via RPC
      let entities: EntityData[] = [];
      
      if (rpc?.scene?.getSceneEntities) {
        try {
          const result = await rpc.scene.getSceneEntities();
          entities = result.entities || [];
          console.log('[Blender Sync] Got', entities.length, 'entities from Inspector');
        } catch (error) {
          console.warn('[Blender Sync] Failed to get entities from Inspector:', error);
          // Continue with empty array - will show all Blender objects as new
        }
      }

      const result = await blender.detectChanges({
        blendFilePath: state.linkedBlendFile,
        entities,
        blenderPath: state.blenderInfo?.path,
        projectPath,
      });

      if (result.success && result.changes) {
        setState(prev => ({
          ...prev,
          isSyncing: false,
          changes: result.changes,
          metadata: result.metadata ?? null,
          showPreview: true,
        }));
      } else {
        setState(prev => ({
          ...prev,
          isSyncing: false,
          error: result.error || 'Failed to sync with Blender',
        }));
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isSyncing: false,
        error: `Sync failed: ${error.message}`,
      }));
    }
  }, [state.linkedBlendFile, state.blenderInfo, rpc]);

  const handleApplyChanges = useCallback(async () => {
    console.log('Applying changes:', state.changes);
    
    if (!state.changes || !rpc || !state.metadata) {
      console.error('[Blender Workflow] No changes, metadata, or RPC client available');
      return;
    }

    try {
      setState(prev => ({ ...prev, isSyncing: true }));

      // CLEAN SLATE APPROACH: Try to delete all existing Blender entities and assets first
      // If cleaning isn't available (old Inspector version), we'll proceed anyway
      console.log('[Blender Workflow] Step 1: Attempting to clean all existing Blender entities and assets...');
      
      let cleaned = false;
      try {
        const cleanResult = await rpc.scene.cleanBlenderEntities();
        if (cleanResult.success) {
          cleaned = true;
          console.log('[Blender Workflow] Successfully cleaned:', {
            deletedEntities: cleanResult.deletedCount,
            deletedFiles: cleanResult.deletedFiles.length,
          });
        } else {
          console.warn('[Blender Workflow] Clean operation failed:', cleanResult.error);
        }
      } catch (error: any) {
        // If the method doesn't exist (old Inspector), just warn and continue
        if (error.message?.includes('not implemented')) {
          console.warn('[Blender Workflow] Clean method not available (Inspector may need update). Proceeding with sync anyway...');
        } else {
          console.warn('[Blender Workflow] Clean operation failed:', error.message);
        }
        // Continue anyway - we'll create entities and they might duplicate, but that's better than failing
      }

      // Step 1.5: CRITICAL! Refresh the asset catalog so the Inspector knows about the new GLB files
      // The files were copied during "Sync from Blender", but the Inspector's asset cache needs to be refreshed
      console.log('[Blender Workflow] Step 1.5: Refreshing asset catalog...');
      try {
        await rpc.scene.refreshAssetCatalog();
        console.log('[Blender Workflow] Asset catalog refreshed successfully');
        // Give the asset catalog a moment to fully reload
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error: any) {
        console.warn('[Blender Workflow] Failed to refresh asset catalog:', error.message);
        // Continue anyway - assets might still work
      }

      // Step 2: Prepare all objects from Blender as NEW entities
      // Only send ROOT objects (no parent) - children are embedded in parent GLBs
      const allObjects = state.changes
        .filter(change => !change.isDeleted) // Only active objects
        .map((change) => {
          const objectMetadata = state.metadata?.objects[change.objectName];
          
          if (!change.newTransform) {
            console.warn(`[Blender Workflow] No transform data for "${change.objectName}"`, change);
          }
          
          return {
            name: change.objectName,
            position: change.newTransform?.position,
            rotation: change.newTransform?.rotation,
            scale: change.newTransform?.scale,
            gltfSrc: change.gltfFile ? `assets/blender/${change.gltfFile}` : undefined,
            parent: objectMetadata?.parent || null,
            isCollider: objectMetadata?.isCollider || false,
            // Don't include entityId - these are all new entities now
            isDeleted: false,
          };
        });

      // Filter to only root objects (children are in parent GLBs)
      const rootObjects = allObjects.filter(obj => !obj.parent);
      
      console.log('[Blender Workflow] Step 2: Creating', rootObjects.length, 'new entities from Blender');
      console.log('[Blender Workflow] Objects to create:', rootObjects.map(o => o.name));

      // Step 3: Create all entities as new
      const result = await rpc.scene.createEntitiesFromBlender(rootObjects);

      console.log('[Blender Workflow] Create result:', result);

      if (result.success) {
        console.log(`[Blender Workflow] Successfully synced:`, {
          cleaned: cleaned,
          created: result.createdCount,
        });
        
        if (onSyncComplete) {
          onSyncComplete();
        }
        
        setState(prev => ({
          ...prev,
          isSyncing: false,
          showPreview: false,
          changes: null,
          metadata: null,
        }));
      } else {
        throw new Error(result.error || 'Failed to create entities');
      }
    } catch (error: any) {
      console.error('[Blender Workflow] Failed to apply changes:', error);
      setState(prev => ({
        ...prev,
        isSyncing: false,
        error: `Failed to apply changes: ${error.message}`,
      }));
    }
  }, [state.changes, state.metadata, rpc, onSyncComplete]);

  const handleCancelPreview = useCallback(() => {
    setState(prev => ({
      ...prev,
      showPreview: false,
      changes: null,
      metadata: null,
    }));
  }, []);

  const handleClose = useCallback(() => {
    setState({
      isDetecting: false,
      isSyncing: false,
      blenderInfo: state.blenderInfo, // Keep Blender info
      linkedBlendFile: null,
      changes: null,
      metadata: null,
      error: null,
      showPreview: false,
    });
    onClose();
  }, [onClose, state.blenderInfo]);

  if (state.showPreview && state.changes) {
    return (
      <BlenderSyncPreview
        open={open}
        changes={state.changes}
        metadata={state.metadata}
        onApply={handleApplyChanges}
        onCancel={handleCancelPreview}
      />
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {state.linkedBlendFile ? 'Blender Workflow - Scene Linked' : 'Blender Workflow - Setup'}
      </DialogTitle>
      
      <DialogContent>
        <Box className="blender-workflow-content">
          {/* Blender Status */}
          <Box className="blender-status">
            <Typography variant="h6">Blender Installation</Typography>
            
            {state.isDetecting && (
              <Box display="flex" alignItems="center" gap={2}>
                <CircularProgress size={20} />
                <Typography>Detecting Blender...</Typography>
              </Box>
            )}
            
            {!state.isDetecting && state.blenderInfo && (
              <Box display="flex" alignItems="center" gap={1}>
                <CheckCircleIcon color="success" />
                <Typography>
                  Blender {state.blenderInfo.version} detected
                </Typography>
                <IconButton size="small" onClick={handleSelectBlenderPath} title="Change Blender path">
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Box>
            )}
            
            {!state.isDetecting && !state.blenderInfo && (
              <Box>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Blender not found automatically. Please select it manually:
                  </Typography>
                  <Typography variant="body2" component="div">
                    <strong>macOS:</strong> /Applications/Blender.app<br />
                    <strong>Windows:</strong> C:\Program Files\Blender Foundation\Blender X.X\blender.exe<br />
                    <strong>Linux:</strong> /usr/bin/blender or /snap/bin/blender
                  </Typography>
                </Alert>
                <Button variant="contained" onClick={handleSelectBlenderPath} startIcon={<FolderOpenIcon />}>
                  Select Blender Executable
                </Button>
              </Box>
            )}
          </Box>

          {/* Blend File Selection */}
          <Box className="blend-file-selection" sx={{ mt: 3 }}>
            <Typography variant="h6">Blender Scene</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {state.linkedBlendFile 
                ? 'Linked scene - click Sync to refresh, or Browse to change'
                : 'Select your .blend file to get started'
              }
            </Typography>
            
            <Box display="flex" gap={1} alignItems="center">
              <TextField
                fullWidth
                placeholder="No Blender file linked"
                value={state.linkedBlendFile || ''}
                InputProps={{ readOnly: true }}
                size="small"
              />
              <Button
                variant={state.linkedBlendFile ? "outlined" : "contained"}
                onClick={handleSelectBlendFile}
                startIcon={<FolderOpenIcon />}
              >
                {state.linkedBlendFile ? 'Change' : 'Browse'}
              </Button>
            </Box>
          </Box>

          {/* Error Display */}
          {state.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {state.error}
            </Alert>
          )}

          {/* Info Box */}
          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="body2">
              <strong>How it works:</strong>
              <br />
              1. Select Blender executable (one-time setup)
              <br />
              2. Browse and link your .blend file
              <br />
              3. Click "Sync from Blender" to export and preview changes
              <br />
              4. Review and apply changes to your scene
              <br />
              <br />
              <strong>For iterations:</strong> Just edit in Blender, save, and click Sync again!
              <br />
              <br />
              <em>Objects are matched by name. Make sure your Blender objects have the same names as your entities.</em>
            </Typography>
          </Alert>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} variant="text">
          Close
        </Button>
        <Button
          onClick={handleSync}
          variant="contained"
          color="primary"
          disabled={!state.linkedBlendFile || !state.blenderInfo || state.isSyncing}
          startIcon={state.isSyncing ? <CircularProgress size={20} /> : <SyncIcon />}
        >
          {state.isSyncing ? 'Syncing...' : 'Sync from Blender'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

