import { type ButtonHTMLAttributes, memo } from 'react';
import { AiOutlinePlus as AddIcon } from 'react-icons/ai';
import './AddButton.css';

const AddButton = memo<ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }>(
  props => {
    const { children, icon = <AddIcon />, ...rest } = props;
    return (
      <button
        className="AddButton"
        {...rest}
      >
        {icon} {children}
      </button>
    );
  },
);

export default AddButton;
