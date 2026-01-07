import { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
} from 'decentraland-ui2';
import type { TransformChange, BlenderExportMetadata } from '/shared/types/ipc';

interface BlenderSyncPreviewProps {
  open: boolean;
  changes: TransformChange[];
  metadata: BlenderExportMetadata | null;
  onApply: () => void;
  onCancel: () => void;
}

export function BlenderSyncPreview({
  open,
  changes,
  metadata,
  onApply,
  onCancel,
}: BlenderSyncPreviewProps) {
  const { newObjects, updatedObjects, deletedObjects } = useMemo(() => {
    const newObjs = changes.filter(c => c.isNewObject && !c.isDeleted);
    const updatedObjs = changes.filter(c => !c.isNewObject && !c.isDeleted);
    const deletedObjs = changes.filter(c => c.isDeleted);
    return { newObjects: newObjs, updatedObjects: updatedObjs, deletedObjects: deletedObjs };
  }, [changes]);

  const formatVector = (vec?: { x: number; y: number; z: number }) => {
    if (!vec) return 'N/A';
    return `(${vec.x.toFixed(2)}, ${vec.y.toFixed(2)}, ${vec.z.toFixed(2)})`;
  };

  const formatQuaternion = (q?: { x: number; y: number; z: number; w: number }) => {
    if (!q) return 'N/A';
    return `(${q.x.toFixed(2)}, ${q.y.toFixed(2)}, ${q.z.toFixed(2)}, ${q.w.toFixed(2)})`;
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="lg" fullWidth>
      <DialogTitle>Sync Preview - Review Changes</DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Alert severity="info">
            <Typography variant="body2">
              <strong>Clean Sync Mode:</strong> All existing Blender entities and assets will be deleted, then re-imported fresh from Blender.
              <br />
              <br />
              Found <strong>{changes.length}</strong> object(s) from Blender:
              <br />
              • <strong>{newObjects.length}</strong> new object(s)
              <br />
              • <strong>{updatedObjects.length}</strong> updated object(s)
              {deletedObjects.length > 0 && (
                <>
                  <br />
                  • <strong>{deletedObjects.length}</strong> deleted object(s)
                </>
              )}
              {metadata && (
                <>
                  <br />
                  <br />
                  Exported from Blender {metadata.blender_version}
                </>
              )}
            </Typography>
          </Alert>
        </Box>

        {/* New Objects */}
        {newObjects.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              New Objects
            </Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Object Name</TableCell>
                    <TableCell>Position</TableCell>
                    <TableCell>Rotation</TableCell>
                    <TableCell>Scale</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {newObjects.map((change, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {change.objectName}
                          <Chip label="NEW" size="small" color="success" />
                        </Box>
                      </TableCell>
                      <TableCell>{formatVector(change.newTransform?.position)}</TableCell>
                      <TableCell>{formatQuaternion(change.newTransform?.rotation)}</TableCell>
                      <TableCell>{formatVector(change.newTransform?.scale)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Updated Objects */}
        {updatedObjects.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Updated Objects
            </Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Object Name</TableCell>
                    <TableCell>Property</TableCell>
                    <TableCell>Current</TableCell>
                    <TableCell>New</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {updatedObjects.map((change, idx) => {
                    const hasPositionChange =
                      formatVector(change.currentTransform?.position) !==
                      formatVector(change.newTransform?.position);
                    const hasRotationChange =
                      formatQuaternion(change.currentTransform?.rotation) !==
                      formatQuaternion(change.newTransform?.rotation);
                    const hasScaleChange =
                      formatVector(change.currentTransform?.scale) !==
                      formatVector(change.newTransform?.scale);

                    return (
                      <>
                        {hasPositionChange && (
                          <TableRow key={`${idx}-pos`}>
                            <TableCell>{idx === 0 && change.objectName}</TableCell>
                            <TableCell>Position</TableCell>
                            <TableCell>{formatVector(change.currentTransform?.position)}</TableCell>
                            <TableCell sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                              {formatVector(change.newTransform?.position)}
                            </TableCell>
                          </TableRow>
                        )}
                        {hasRotationChange && (
                          <TableRow key={`${idx}-rot`}>
                            <TableCell>{idx === 0 && !hasPositionChange && change.objectName}</TableCell>
                            <TableCell>Rotation</TableCell>
                            <TableCell>{formatQuaternion(change.currentTransform?.rotation)}</TableCell>
                            <TableCell sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                              {formatQuaternion(change.newTransform?.rotation)}
                            </TableCell>
                          </TableRow>
                        )}
                        {hasScaleChange && (
                          <TableRow key={`${idx}-scale`}>
                            <TableCell>
                              {idx === 0 && !hasPositionChange && !hasRotationChange && change.objectName}
                            </TableCell>
                            <TableCell>Scale</TableCell>
                            <TableCell>{formatVector(change.currentTransform?.scale)}</TableCell>
                            <TableCell sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                              {formatVector(change.newTransform?.scale)}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Deleted Objects */}
        {deletedObjects.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Deleted Objects
            </Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Object Name</TableCell>
                    <TableCell>Current Position</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deletedObjects.map((change, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {change.objectName}
                          <Chip label="DELETED" size="small" color="error" />
                        </Box>
                      </TableCell>
                      <TableCell>{formatVector(change.currentTransform?.position)}</TableCell>
                      <TableCell sx={{ color: 'error.main', fontWeight: 'bold' }}>
                        Will be removed from scene
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {changes.length === 0 && (
          <Alert severity="success">
            <Typography variant="body1">
              No changes detected. Your scene is already in sync with the Blender file!
            </Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel} variant="text">
          Cancel
        </Button>
        <Button
          onClick={onApply}
          variant="contained"
          color="primary"
          disabled={changes.length === 0}
        >
          Apply Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

