import React from 'react';
import { Button as MuiButton, ButtonProps as MuiButtonProps } from '@mui/material';
import styles from './Button.module.css';

interface ButtonProps extends Omit<MuiButtonProps, 'variant'> {
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium';
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  className = '',
  children,
  ...props
}) => {
  const buttonClasses = [
    styles.button,
    styles[variant],
    size === 'small' ? styles.small : '',
    fullWidth ? styles.fullWidth : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <MuiButton className={buttonClasses} {...props}>
      {children}
    </MuiButton>
  );
};

export default Button;