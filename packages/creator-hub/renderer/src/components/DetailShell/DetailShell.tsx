import { useId, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AvatarFace, type AvatarFaceProps, Tab } from 'decentraland-ui2';

import { useProfile } from '/@/hooks/useProfile';
import { t } from '/@/modules/store/translation/utils';

import { AvatarWithInfo } from '../AvatarWithInfo';
import { Button } from '../Button';
import { Container } from '../Container';
import { useDisplayName } from '../LandDetailPage/access/useDisplayName';
import { EmptyState } from '../ManagePage/EmptyState';
import { RoleTag, type RoleTagVariant } from '../ManagePage/RoleTag';
import { DefaultModal } from '../Modals/DefaultModal';
import { Navbar, NavbarItem } from '../Navbar';
import { Title } from '../Title';
import { DraftContext, type Draft } from './draft';
import {
  Content,
  Header,
  HeaderActions,
  OwnerName,
  Page,
  RoleRow,
  SelfOwner,
  TabBar,
  TitleBlock,
} from './DetailShell.styled';

const PANEL_ID = 'detail-panel';
const MANAGE = '/manage';

export type HeaderPeople =
  | { kind: 'self'; owner: string }
  | { kind: 'other'; role: RoleTagVariant | undefined; owner: string };

type Props = {
  title: string;
  basePath: string;
  people?: HeaderPeople;
  menu: ReactNode;
  tabs: { value: string; label: string }[];
  activeTab: string;
  children: ReactNode;
};

/** The Manage detail page frame: navbar, container and content column. */
export function DetailPage({ children }: { children: ReactNode }) {
  return (
    <Page>
      <Navbar active={NavbarItem.MANAGE} />
      <Container>
        <Content>{children}</Content>
      </Container>
    </Page>
  );
}

/** The detail page's not-found state, with the way back to Manage. */
export function DetailMissing({ message }: { message: string }) {
  const navigate = useNavigate();
  return (
    <EmptyState
      title={message}
      action={{
        label: t('land_detail.back_to_manage'),
        variant: 'secondary',
        onClick: () => navigate(MANAGE),
      }}
    />
  );
}

function SelfOwnerValue({ address }: { address: string }) {
  const { avatar } = useProfile(address);
  const displayName = useDisplayName();
  return (
    <SelfOwner>
      <AvatarFace
        avatar={avatar as AvatarFaceProps['avatar']}
        size="tiny"
        inline
      />
      <OwnerName>{t('world_detail.owner_you', { name: displayName(address) })}</OwnerName>
    </SelfOwner>
  );
}

function PeopleRow({ people }: { people: HeaderPeople }) {
  return (
    <RoleRow>
      {people.kind === 'other' && (
        <div>
          <dt>{t('land_detail.role')}</dt>
          <dd>{people.role && <RoleTag variant={people.role} />}</dd>
        </div>
      )}
      <div>
        <dt>{t('land_detail.owner')}</dt>
        <dd>
          {people.kind === 'self' ? (
            <SelfOwnerValue address={people.owner} />
          ) : (
            <AvatarWithInfo
              value={people.owner}
              size="tiny"
            />
          )}
        </dd>
      </div>
    </RoleRow>
  );
}

/** A Manage detail page: title, back, header row, CANCEL / SAVE for the open tab's draft, menu and tabs; asks before leaving unsaved edits. */
export function DetailShell({ title, basePath, people, menu, tabs, activeTab, children }: Props) {
  const navigate = useNavigate();
  const titleId = useId();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [exit, setExit] = useState<{ path: string; replace: boolean } | null>(null);

  const leave = (path: string, replace: boolean) => {
    if (draft?.dirty) setExit({ path, replace });
    else navigate(path, { replace });
  };

  const discardAndLeave = () => {
    if (!exit) return;
    draft?.onCancel();
    setExit(null);
    navigate(exit.path, { replace: exit.replace });
  };

  const saveAndStay = () => {
    draft?.onSave();
    setExit(null);
  };

  return (
    <DraftContext.Provider value={setDraft}>
      <Header>
        <TitleBlock>
          <Title
            id={titleId}
            value={title}
            onBack={() => leave(MANAGE, false)}
          />
          {people && <PeopleRow people={people} />}
        </TitleBlock>
        <HeaderActions>
          {draft?.dirty && (
            <>
              <Button
                variant="contained"
                color="secondary"
                onClick={draft.onCancel}
              >
                {t('modal.cancel')}
              </Button>
              <Button
                variant="contained"
                color="primary"
                disabled={!draft.valid}
                onClick={draft.onSave}
              >
                {t('land_detail.save')}
              </Button>
            </>
          )}
          {menu}
        </HeaderActions>
      </Header>
      <TabBar
        value={activeTab}
        aria-labelledby={titleId}
        onChange={(_, next: string) => leave(`${basePath}/${next}`, true)}
      >
        {tabs.map(tab => (
          <Tab
            key={tab.value}
            value={tab.value}
            label={tab.label}
            aria-controls={PANEL_ID}
          />
        ))}
      </TabBar>
      <div
        role="tabpanel"
        id={PANEL_ID}
      >
        {children}
      </div>
      <DefaultModal
        open={!!exit}
        title={t('detail_shell.unsaved')}
        onClose={() => setExit(null)}
        secondary={{ label: t('detail_shell.discard'), onClick: discardAndLeave }}
        primary={{
          label: t('land_detail.save'),
          state: draft?.valid ? 'idle' : 'blocked',
          onClick: saveAndStay,
        }}
      />
    </DraftContext.Provider>
  );
}
