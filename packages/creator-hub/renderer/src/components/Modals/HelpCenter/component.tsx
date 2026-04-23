import { useState } from 'react';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Typography } from 'decentraland-ui2';

import { misc } from '#preload';
import { TabsModal } from '../TabsModal';

import './styles.css';

type FaqItem = {
  question: string;
  answer: string;
};

const FAQ_GENERAL: FaqItem[] = [
  {
    question: 'What is Decentraland?',
    answer:
      'Decentraland is an open, community-owned virtual world where you can explore, create, play games, attend events, and connect with others. The world is made up of parcels of LAND that community members can build on and monetize.',
  },
  {
    question: 'How do I enter Decentraland?',
    answer:
      'You can explore Decentraland directly from your web browser at decentraland.org, or download the desktop client for an enhanced experience. No wallet or cryptocurrency is required to get started.',
  },
  {
    question: 'Do I need cryptocurrency or a digital wallet?',
    answer:
      'No. You can explore Decentraland as a guest without a wallet. However, to own LAND, wearables, emotes, or a NAME, you will need an Ethereum-compatible wallet (like MetaMask) and some MANA or ETH.',
  },
];

const FAQ_CREATOR: FaqItem[] = [
  {
    question: 'How do I become a Decentraland Creator?',
    answer:
      'Download the Creator Hub — the all-in-one tool for building scenes, managing projects, and publishing to Decentraland. You can start from templates or code custom experiences using the SDK.',
  },
  {
    question: 'What is a NAME?',
    answer:
      'A NAME is a unique, claimable identity in Decentraland. It becomes your in-world username and also gives you a free World — a personal virtual space you can build on without owning LAND.',
  },
  {
    question: 'What is the difference between LAND and Worlds?',
    answer:
      'LAND is a limited set of parcels on the Genesis City map that are owned as NFTs. Worlds are personal virtual spaces tied to your NAME that exist outside the map — they are free, private, and perfect for prototyping or hosting events.',
  },
  {
    question: 'How do I publish a scene?',
    answer:
      'Use the Creator Hub to create your scene, then click Publish. You can deploy to your own LAND, a rented parcel, or a World. The Creator Hub handles the entire deployment process for you.',
  },
];

const FAQ_SUPPORT: FaqItem[] = [
  {
    question: 'How can I get help and contact the Support Team?',
    answer:
      'Visit decentraland.org/help to browse FAQs and support updates, or use the chat box to speak directly with the Support Team. You can also submit feedback through the Creator Hub.',
  },
  {
    question: 'Where can I find the Creator Docs?',
    answer:
      'The full documentation is available at docs.decentraland.org/creator. It covers everything from scene building, the SDK, 3D modeling, wearables, emotes, and publishing.',
  },
];

type FaqSectionProps = {
  title: string;
  items: FaqItem[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  prefix: string;
};

function FaqSection({ title, items, expandedId, onToggle, prefix }: FaqSectionProps) {
  return (
    <div className="HelpSection">
      <Typography
        variant="overline"
        className="HelpSectionLabel"
      >
        {title}
      </Typography>
      <div className="HelpAccordionGroup">
        {items.map((item, i) => {
          const id = `${prefix}-${i}`;
          const isOpen = expandedId === id;
          return (
            <div
              key={id}
              className={`HelpAccordionItem ${isOpen ? 'open' : ''}`}
            >
              <button
                className="HelpAccordionTrigger"
                onClick={() => onToggle(isOpen ? '' : id)}
              >
                <Typography
                  variant="body2"
                  className="HelpAccordionQuestion"
                >
                  {item.question}
                </Typography>
                <ExpandMoreIcon className={`HelpAccordionChevron ${isOpen ? 'rotated' : ''}`} />
              </button>
              <div className={`HelpAccordionContent ${isOpen ? 'expanded' : ''}`}>
                <Typography
                  variant="body2"
                  className="HelpAccordionAnswer"
                >
                  {item.answer}
                </Typography>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HelpCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleVisitHelpCenter = () => {
    misc.openExternal('https://decentraland.org/help/');
  };

  return (
    <TabsModal<string>
      open={open}
      className="HelpCenterModal"
      icon={<HelpOutlineIcon />}
      title="Help Center"
      tabs={[]}
      showTabs={false}
      activeTab=""
      onTabClick={() => {}}
      onClose={onClose}
    >
      <Box className="HelpCenterBody">
        <FaqSection
          title="General"
          items={FAQ_GENERAL}
          expandedId={expandedId}
          onToggle={setExpandedId}
          prefix="gen"
        />
        <FaqSection
          title="Creating"
          items={FAQ_CREATOR}
          expandedId={expandedId}
          onToggle={setExpandedId}
          prefix="cre"
        />
        <FaqSection
          title="Support"
          items={FAQ_SUPPORT}
          expandedId={expandedId}
          onToggle={setExpandedId}
          prefix="sup"
        />

        <button
          className="HelpExternalLink"
          onClick={handleVisitHelpCenter}
        >
          <Typography variant="body2">Visit full Help Center</Typography>
          <OpenInNewIcon fontSize="small" />
        </button>
      </Box>
    </TabsModal>
  );
}
