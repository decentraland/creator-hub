import CloseIcon from '@mui/icons-material/CloseRounded';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { Modal } from 'decentraland-ui2/dist/components/Modal/Modal';
import { Box, IconButton, Typography } from 'decentraland-ui2';
import './styles.css';

type Props<T> = {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  tabs: { value: T; label: string }[];
  activeTab: T;
  onTabClick: (tab: T) => void;
  children: React.ReactNode;
  className?: string;
};

function TabsModal<T>({
  open,
  onClose,
  title,
  icon,
  tabs,
  activeTab,
  onTabClick,
  children,
  className = '',
}: Props<T>) {
  return (
    <Modal
      open={open}
      size="small"
    >
      <Box className={`TabsModal ${className}`}>
        <Box className="TabsModalHeader">
          <Box className="TabsModalTitle">
            {icon}
            <Typography variant="h6">{title}</Typography>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon
              fontSize="medium"
              style={{ color: 'var(--white)' }}
            />
          </IconButton>
        </Box>
        <Box className="TabsModalLayout">
          <Tabs
            className="TabsModalSidebar"
            orientation="vertical"
            variant="scrollable"
            value={activeTab}
            onChange={(_event, newValue) => onTabClick(newValue)}
          >
            {tabs.map(tab => (
              <Tab
                key={`tab-${tab.value}`}
                className="TabsModalTab"
                value={tab.value}
                label={tab.label}
              />
            ))}
          </Tabs>
          <Box className="TabsModalContent">{children}</Box>
        </Box>
      </Box>
    </Modal>
  );
}

export default TabsModal;
