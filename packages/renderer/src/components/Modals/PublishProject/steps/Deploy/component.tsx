import { useCallback, useEffect, useMemo, useState } from 'react';
import { type AuthChain, Authenticator } from '@dcl/crypto';
import { localStorageGetIdentity } from '@dcl/single-sign-on-client';
import { Loader } from '/@/components/Loader';
import { useEditor } from '/@/hooks/useEditor';
import { useIsMounted } from '/@/hooks/useIsMounted';
import { PublishModal } from '../../PublishModal';
import { type Props } from '../../types';
import type { File, Info } from './types';
import './styles.css';
import { useAuth } from '/@/hooks/useAuth';
import { ChainId } from '@dcl/schemas';
import { addBase64ImagePrefix } from '/@/modules/image';
import { Typography } from 'decentraland-ui2';
import { Button } from '../../../../Button';

const MAX_FILE_PATH_LENGTH = 50;

function getPath(filename: string) {
  return filename.length > MAX_FILE_PATH_LENGTH
    ? `${filename.slice(0, MAX_FILE_PATH_LENGTH / 2)}...${filename.slice(
        -(MAX_FILE_PATH_LENGTH / 2),
      )}`
    : filename;
}

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

function getSize(size: number) {
  if (size < KB) {
    return `${size.toFixed(2)} B`;
  }
  if (size < MB) {
    return `${(size / KB).toFixed(2)} KB`;
  }
  if (size < GB) {
    return `${(size / MB).toFixed(2)} MB`;
  }
  return `${(size / GB).toFixed(2)} GB`;
}

export function Deploy(props: Props) {
  const { chainId, wallet, avatar } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [info, setInfo] = useState<Info | null>(null);
  const { loadingPublish, publishPort, project, publishError } = useEditor();
  const isMounted = useIsMounted();
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccessful, setIsSuccessful] = useState(false);

  const url = useMemo(() => {
    const port = import.meta.env.VITE_CLI_DEPLOY_PORT || publishPort;
    return port ? `http://localhost:${port}/api` : null;
  }, [publishPort]);

  const handlePublish = useCallback(() => {
    if (!url) return;
    async function deploy(payload: { address: string; authChain: AuthChain; chainId: ChainId }) {
      setIsDeploying(true);
      setError(null);
      const resp = await fetch(`${url}/deploy`, {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (resp.ok) {
        return;
      }
      let error = (await resp.json()).message as string;
      if (/Response was/.test(error)) {
        try {
          error = error.split('["')[1].split('"]')[0];
        } catch (e) {
          /* */
        }
      }
      throw new Error(error);
    }
    if (wallet && info && info.rootCID) {
      const identity = localStorageGetIdentity(wallet);
      if (identity && chainId) {
        const authChain = Authenticator.signPayload(identity, info.rootCID);
        void deploy({ address: wallet, authChain, chainId })
          .then(() => {
            if (!isMounted()) return;
            setIsDeploying(false);
            setIsSuccessful(true);
          })
          .catch(error => {
            setIsDeploying(false);
            setError(error.message);
          });
      } else {
        setError('Invalid identity or chainId');
      }
    }
  }, [wallet, info, url, chainId]);

  useEffect(() => {
    if (!url || isSuccessful) return;
    async function fetchFiles() {
      const resp = await fetch(`${url}/files`);
      const files = await resp.json();
      return files as File[];
    }
    async function fetchInfo() {
      const resp = await fetch(`${url}/info`);
      const info = await resp.json();
      return info as Info;
    }
    void Promise.all([fetchFiles(), fetchInfo()])
      .then(([files, info]) => {
        if (!isMounted()) return;
        setFiles(files);
        setInfo(info);
      })
      .catch();
  }, [url, isSuccessful]);

  // set publish error
  useEffect(() => {
    if (publishError) {
      setError(publishError);
    }
  }, [publishError, setError]);

  return (
    <PublishModal
      title={
        info
          ? info.isWorld
            ? 'Publish to your World'
            : 'Publish to your Land'
          : loadingPublish
          ? 'Loading...'
          : error
          ? 'Error'
          : ''
      }
      size="large"
      {...props}
    >
      <div className="Deploy">
        {loadingPublish ? (
          <Loader />
        ) : error ? (
          <>
            <div className="cli-publish-error">
              <div className="Warning" />
              <p className="message">{error}</p>
            </div>
          </>
        ) : !info ? null : (
          <>
            <div className="ethereum">
              <div className="chip network">
                {chainId === ChainId.ETHEREUM_MAINNET ? 'Mainnet' : 'Testnet'}
              </div>
              {wallet ? (
                <div className="chip address">
                  {wallet.slice(0, 6)}...{wallet.slice(-4)}
                </div>
              ) : null}
              {info.isWorld ? (
                avatar ? (
                  <div className="chip username">
                    {avatar.name}
                    {avatar.hasClaimedName ? <i className="verified"></i> : null}
                  </div>
                ) : null
              ) : (
                <div className="chip parcel">
                  <i className="pin"></i>
                  {info.baseParcel}
                </div>
              )}
            </div>
            <div className="scene">
              <div className="info">
                {project ? (
                  <div
                    className="thumbnail"
                    style={{ backgroundImage: `url(${addBase64ImagePrefix(project.thumbnail)})` }}
                  />
                ) : null}
                <div className="text">
                  <Typography variant="body1">{info.title}</Typography>
                  <Typography
                    variant="body2"
                    color="#A09BA8"
                  >
                    {info.description}
                  </Typography>
                </div>
              </div>
              <div className="files">
                <div className="filters">
                  <div className="count">{files.length} files</div>
                  <div className="size">
                    Total Size:{' '}
                    <b>{getSize(files.reduce((total, file) => total + file.size, 0))}</b>
                  </div>
                </div>
                <div className="list">
                  {files.map(file => (
                    <div
                      className="file"
                      key={file.name}
                    >
                      <div
                        className="filename"
                        title={file.name}
                      >
                        {getPath(file.name)}
                      </div>
                      <div className="size">{getSize(file.size)}</div>
                    </div>
                  ))}
                </div>
                <div className="actions">
                  <p className="error">{error}</p>
                  <Button
                    size="large"
                    disabled={isDeploying || isSuccessful}
                    onClick={handlePublish}
                  >
                    Publish
                    {isDeploying ? <Loader size={20} /> : <i className="deploy-icon" />}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </PublishModal>
  );
}
