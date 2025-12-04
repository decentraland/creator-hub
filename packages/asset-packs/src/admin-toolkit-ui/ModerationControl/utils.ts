import { fetchSceneAdmins, fetchSceneBans } from '..';
import { postSceneAdmin, postSceneBan, deleteSceneBan } from './api';

export const handleAddAdmin = async (
  adminData: { admin: string } | { name: string },
  setError: (error: string) => void,
  setLoading: (loading: boolean) => void,
  clearInput: () => void,
) => {
  setLoading(true);
  const [error, _] = await postSceneAdmin(adminData);
  if (error) {
    setError('Please try again with a valid NAME or wallet address.');
  } else {
    setError('');
    clearInput();
    await fetchSceneAdmins();
  }
  setLoading(false);
};

export const handleBanUser = async (
  banData: { banned_address: string } | { banned_name: string },
  setError: (error: string) => void,
  setLoading: (loading: boolean) => void,
  clearInput: () => void,
) => {
  setLoading(true);
  const [error, _] = await postSceneBan(banData);

  if (error) {
    setError('Please try again with a valid NAME or wallet address.');
  } else {
    setError('');
    clearInput();
    await fetchSceneBans();
  }
  setLoading(false);
};

export const handleUnbanUser = async (address: string): Promise<boolean> => {
  if (!address) return false;
  const [error, _] = await deleteSceneBan(address);
  if (error) {
    await fetchSceneBans();
    return false;
  } else {
    return true;
  }
};
