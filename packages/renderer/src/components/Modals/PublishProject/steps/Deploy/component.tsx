import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type AuthChain, Authenticator } from '@dcl/crypto';
import { localStorageGetIdentity } from '@dcl/single-sign-on-client';
import { ChainId } from '@dcl/schemas';
import { Typography, Checkbox } from 'decentraland-ui2';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { misc, workspace } from '#preload';

import type { IFileSystemStorage } from '/shared/types/storage';

import { useAuth } from '/@/hooks/useAuth';
import { useEditor } from '/@/hooks/useEditor';
import { useIsMounted } from '/@/hooks/useIsMounted';

import { t } from '/@/modules/store/translation/utils';
import { Loader } from '/@/components/Loader';
import { addBase64ImagePrefix } from '/@/modules/image';

import { PublishModal, onBackNoop } from '../../PublishModal';
import { ConnectedSteps } from '../../../../Step';
import { Button } from '../../../../Button';

import type { Step } from '../../../../Step/types';
import { type Props } from '../../types';

import {
  getInitialDeploymentStatus,
  retryDelayInMs,
  maxRetries,
  checkDeploymentStatus,
  fetchDeploymentStatus,
  deriveOverallStatus,
  cleanPendingsFromDeploymentStatus,
  isDeployFinishing,
} from './utils';
import {
  type File,
  type Info,
  type DeploymentStatus,
  type Status,
  isDeploymentError,
} from './types';

import './styles.css';

const MAX_FILE_PATH_LENGTH = 50;

function getPath(filename: string) {
  return filename.length > MAX_FILE_PATH_LENGTH
    ? `${filename.slice(0, MAX_FILE_PATH_LENGTH / 2)}...${filename.slice(-(MAX_FILE_PATH_LENGTH / 2))}`
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
  const infoRef = useRef<IFileSystemStorage>();
  const { chainId, wallet, avatar } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [info, setInfo] = useState<Info | null>(null);
  const { loadingPublish, publishPort, project, publishError } = useEditor();
  const isMounted = useIsMounted();
  const [deployStatus, setDeployStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [skipWarning, setSkipWarning] = useState(false);

  // read skip warning flag
  useEffect(() => {
    if (project) {
      workspace.getProjectInfo(project.path).then(info => {
        info.get<boolean>('skipPublishWarning').then(value => {
          setSkipWarning(!!value);
        });
        infoRef.current = info;
      });
    }
  }, [project]);

  const url = useMemo(() => {
    const port = import.meta.env.VITE_CLI_DEPLOY_PORT || publishPort;
    return port ? `http://localhost:${port}/api` : null;
  }, [publishPort]);

  const handlePublish = useCallback(() => {
    if (!url) return;
    setShowWarning(false);
    async function deploy(payload: { address: string; authChain: AuthChain; chainId: ChainId }) {
      setDeployStatus('pending');
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
          })
          .catch(error => {
            setDeployStatus('failed');
            setError(error.message);
          });
      } else {
        setError('Invalid identity or chainId');
      }
    }
    // write skip warning flag
    infoRef.current?.set('skipPublishWarning', skipWarning);
  }, [wallet, info, url, chainId, skipWarning]);

  const handleBack = useCallback(() => {
    setShowWarning(false);
    setSkipWarning(false);
  }, []);

  useEffect(() => {
    if (!url || deployStatus !== 'idle') return;
    async function fetchFiles() {
      const resp = await fetch(`${url}/files`);
      const files = (await resp.json()) as File[];
      return files;
    }
    async function fetchInfo() {
      const resp = await fetch(`${url}/info`);
      const info = (await resp.json()) as Info;
      return info;
    }
    void Promise.all([fetchFiles(), fetchInfo()])
      .then(([files, info]) => {
        if (!isMounted()) return;
        setFiles(files);
        setInfo(info);
      })
      .catch();
  }, [url, deployStatus]);

  // set publish error
  useEffect(() => {
    if (publishError) {
      // TODO: JSON.parse(publishError) if possible
      setError(publishError);
    }
  }, [publishError, setError]);

  // jump in
  const jumpInUrl = useMemo(() => {
    if (info && project) {
      if (info.isWorld) {
        if (project.worldConfiguration) {
          return `decentraland://?realm=${project.worldConfiguration.name}`;
        }
      } else {
        return `decentraland://?position=${project.scene.base}`;
      }
    }
    return null;
  }, [info, project]);

  const handleJumpIn = useCallback(() => {
    if (jumpInUrl) {
      void misc.openExternal(jumpInUrl);
    }
  }, [jumpInUrl]);

  const handleDeploySuccess = useCallback(() => {
    setDeployStatus('complete');
  }, []);

  const handleDeployRetry = useCallback(() => {
    props.onBack && props.onBack();
  }, []);

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
      onBack={deployStatus === 'complete' ? onBackNoop : props.onBack}
    >
      <div className="Deploy">
        {showWarning ? (
          <div className="publish-warning">
            <div className="content">
              <div className="Warning" />
              <div className="message">
                {t('modal.publish_project.deploy.warning.message', {
                  ul: (child: string) => <ul>{child}</ul>,
                  li: (child: string) => <li>{child}</li>,
                })}
              </div>
            </div>
            <div className="actions">
              <label className="dont-show-again">
                <Checkbox
                  value={skipWarning}
                  onChange={() => setSkipWarning(!skipWarning)}
                />
                {t('modal.publish_project.deploy.warning.checkbox')}
              </label>
              <span className="buttons">
                <Button
                  color="secondary"
                  variant="outlined"
                  size="medium"
                  onClick={handleBack}
                >
                  {t('modal.publish_project.deploy.warning.back')}
                </Button>
                <Button
                  size="medium"
                  onClick={handlePublish}
                >
                  {t('modal.publish_project.deploy.warning.continue')}
                </Button>
              </span>
            </div>
          </div>
        ) : null}
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
                {chainId === ChainId.ETHEREUM_MAINNET
                  ? t('modal.publish_project.deploy.ethereum.mainnet')
                  : t('modal.publish_project.deploy.ethereum.testnet')}
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
              {deployStatus === 'idle' && (
                <Idle
                  files={files}
                  error={error}
                  onClick={() => (skipWarning ? handlePublish() : setShowWarning(true))}
                />
              )}
              {deployStatus === 'pending' && (
                <Deploying
                  info={info}
                  url={jumpInUrl}
                  onSuccess={handleDeploySuccess}
                  onClick={handleJumpIn}
                  onRetry={handleDeployRetry}
                />
              )}
              {deployStatus === 'complete' && (
                <Success
                  info={info}
                  url={jumpInUrl}
                  onClick={handleJumpIn}
                />
              )}
            </div>
          </>
        )}
      </div>
    </PublishModal>
  );
}

type IdleProps = {
  files: File[];
  error: string | null;
  onClick: () => void;
};

function Idle({ files, error, onClick }: IdleProps) {
  return (
    <div className="files">
      <div className="filters">
        <div className="count">
          {t('modal.publish_project.deploy.files.count', { count: files.length })}
        </div>
        <div className="size">
          {t('modal.publish_project.deploy.files.size', {
            size: getSize(files.reduce((total, file) => total + file.size, 0)),
            b: (child: string) => <b>{child}</b>,
          })}
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
          onClick={onClick}
        >
          {t('modal.publish_project.deploy.files.publish')}
          <i className="deploy-icon" />
        </Button>
      </div>
    </div>
  );
}

type DeployingProps = {
  info: Info;
  url: string | null;
  onSuccess: () => void;
  onClick: () => void;
  onRetry: () => void;
};

function Deploying({ info, url, onSuccess, onClick, onRetry }: DeployingProps) {
  const { wallet } = useAuth();
  const [deployState, setDeployState] = useState<DeploymentStatus>(
    getInitialDeploymentStatus(info.isWorld),
  );

  const getDeploymentStatus = useCallback((): Promise<DeploymentStatus> => {
    if (!wallet) throw new Error('No wallet provided');
    const identity = localStorageGetIdentity(wallet);
    if (!identity) throw new Error(`No identity found for wallet ${wallet}`);
    return fetchDeploymentStatus(info.rootCID, identity, info.isWorld);
  }, [wallet, info]);

  const onReportIssue = useCallback(() => {
    void misc.openExternal('https://decentraland.canny.io');
  }, []);

  useEffect(
    () => {
      let isCancelled = false;

      const handleUpdate = (status: DeploymentStatus) => {
        if (!isCancelled) {
          if (deriveOverallStatus(status) === 'failed') {
            isCancelled = true;
            setDeployState(cleanPendingsFromDeploymentStatus(status));
          } else {
            setDeployState(status);
          }
        }
      };

      const handleSuccess = () => {
        if (!isCancelled) onSuccess();
      };

      const handleFailure = (error: any) => {
        if (!isCancelled) {
          // info: if we know the error, we can translate it
          if (isDeploymentError(error, 'MAX_RETRIES')) {
            setDeployState(cleanPendingsFromDeploymentStatus(error.status));
          }
        }
      };

      const shouldAbort = () => isCancelled;

      checkDeploymentStatus(
        maxRetries,
        retryDelayInMs,
        getDeploymentStatus,
        handleUpdate,
        shouldAbort,
        deployState,
      )
        .then(handleSuccess)
        .catch(handleFailure);

      // cleanup function to cancel retries if the component unmounts
      return () => {
        isCancelled = true;
      };
    },
    [] /* no deps, want this to run ONLY on mount */,
  );

  const getStepDescription = useCallback((status: Status) => {
    switch (status) {
      case 'pending':
        return t('modal.publish_project.deploy.deploying.step.loading');
      case 'failed':
        return t('modal.publish_project.deploy.deploying.step.failed');
      default:
        return undefined;
    }
  }, []);

  const steps: Step[] = useMemo(() => {
    const { catalyst, assetBundle, lods } = deployState;
    const baseSteps = [
      {
        bulletText: '1',
        name: t('modal.publish_project.deploy.deploying.step.catalyst'),
        description: getStepDescription(catalyst),
        state: catalyst,
      },
      {
        bulletText: '2',
        name: t('modal.publish_project.deploy.deploying.step.asset_bundle'),
        description: getStepDescription(assetBundle),
        state: assetBundle,
      },
    ];

    // Only add LODs step for non-world deployments
    if (!info.isWorld) {
      baseSteps.push({
        bulletText: '3',
        name: t('modal.publish_project.deploy.deploying.step.lods'),
        description: getStepDescription(lods),
        state: lods,
      });
    }

    return baseSteps;
  }, [deployState, getStepDescription, info.isWorld]);

  const isFinishing = useMemo(() => isDeployFinishing(deployState), [deployState]);
  const overallStatus = useMemo(() => deriveOverallStatus(deployState), [deployState]);
  const title = useMemo(() => {
    if (overallStatus === 'failed') return t('modal.publish_project.deploy.deploying.failed');
    if (isFinishing) return t('modal.publish_project.deploy.deploying.finishing');
    return t('modal.publish_project.deploy.deploying.publish');
  }, [overallStatus, isFinishing]);

  return (
    <div className="Deploying">
      <div className="header">
        <div className="title">
          {overallStatus === 'failed' ? <div className="Warning" /> : <Loader />}
          <Typography variant="h5">{title}</Typography>
        </div>
        {overallStatus === 'failed' && (
          <span>{t('modal.publish_project.deploy.deploying.try_again')}</span>
        )}
      </div>
      <ConnectedSteps steps={steps} />
      {overallStatus === 'failed' ? (
        <div className="actions">
          <Button
            size="large"
            variant="outlined"
            color="secondary"
            onClick={onReportIssue}
          >
            {t('modal.publish_project.deploy.deploying.actions.report_issue')}
          </Button>
          <Button
            size="large"
            onClick={onRetry}
          >
            {t('modal.publish_project.deploy.deploying.actions.retry')}
          </Button>
        </div>
      ) : isFinishing ? (
        <>
          <div className="jump">
            <JumpUrl
              inProgress
              info={info}
              url={url}
            />
          </div>
          <div className="actions">
            <Button
              size="large"
              onClick={onClick}
            >
              {t('modal.publish_project.deploy.success.jump_in')}
              <i className="jump-in-icon" />
            </Button>
          </div>
        </>
      ) : (
        <div className="info">
          <InfoOutlinedIcon />
          {t('modal.publish_project.deploy.deploying.info')}
        </div>
      )}
    </div>
  );
}

type SuccessProps = {
  info: Info;
  url: string | null;
  onClick: () => void;
};

function Success({ info, url, onClick }: SuccessProps) {
  return (
    <div className="Success">
      <div className="content">
        <i className="success-icon" />
        <div className="message">{t('modal.publish_project.deploy.success.message')}</div>
        <JumpUrl
          info={info}
          url={url}
        />
      </div>
      <div className="actions">
        <Button
          size="large"
          onClick={onClick}
        >
          {t('modal.publish_project.deploy.success.jump_in')}
          <i className="jump-in-icon" />
        </Button>
      </div>
    </div>
  );
}

function JumpUrl({
  inProgress,
  info,
  url,
}: {
  inProgress?: boolean;
  info: Info;
  url: string | null;
}) {
  return (
    <div className="jump-in-url">
      {inProgress && <label>{t('modal.publish_project.deploy.success.in_progress')}</label>}
      <label>
        {t('modal.publish_project.deploy.success.url', {
          target: info.isWorld
            ? t('modal.publish_project.deploy.success.world')
            : t('modal.publish_project.deploy.success.land'),
        })}
      </label>
      <div className="url">
        {url}
        <i
          className="copy-icon"
          onClick={() => url && misc.copyToClipboard(url)}
        />
      </div>
    </div>
  );
}
