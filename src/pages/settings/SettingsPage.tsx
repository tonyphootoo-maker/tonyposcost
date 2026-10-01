import React from 'react';
import { SettingsModal } from '../../components/settings/SettingsModal';

interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = (props) => {
  return <SettingsModal {...props} />;
};

export { SettingsModal };
