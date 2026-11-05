import React, { useState } from 'react';
import { IoIosClose as CloseIcon } from 'react-icons/io';
import { IoPersonCircle as GenericAvatarIcon } from 'react-icons/io5';

import { formatAddress } from '../../../../lib/logic/ethereum';

import './ProfileRow.css';

export type Props = {
  address: string;
  /** Omitted when the profile did not resolve — the row then shows the address alone. */
  name?: string;
  faceUrl?: string;
  /** Accessible name of the remove button — say what it removes, not just "Remove". */
  removeLabel: string;
  onRemove: () => void;
};

const ProfileRow: React.FC<Props> = ({ address, name, faceUrl, removeLabel, onRemove }) => {
  const shortAddress = formatAddress(address);
  const [unreachableFaceUrl, setUnreachableFaceUrl] = useState<string>();

  return (
    <div className="ProfileRow">
      {faceUrl && faceUrl !== unreachableFaceUrl ? (
        <img
          className="Avatar"
          src={faceUrl}
          alt=""
          onError={() => setUnreachableFaceUrl(faceUrl)}
        />
      ) : (
        <GenericAvatarIcon className="Avatar" />
      )}
      {name ? <span className="Name">{name}</span> : null}
      <span
        className="Address"
        title={address}
      >
        {shortAddress}
      </span>
      <button
        type="button"
        className="RemoveButton"
        aria-label={`${removeLabel} ${shortAddress}`}
        onClick={onRemove}
      >
        <CloseIcon />
      </button>
    </div>
  );
};

export default ProfileRow;
