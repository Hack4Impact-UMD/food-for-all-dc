import React, { useRef, useEffect, useState } from 'react';
import { Button as MuiButton, ButtonProps as MuiButtonProps, Tooltip } from '@mui/material';
import styles from './Button.module.css';

interface ButtonProps extends Omit<MuiButtonProps, 'variant'> {
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  tooltipText?: string;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  className = '',
  icon,
  tooltipText,
  children,
  style,
  ...props
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [showIconOnly, setShowIconOnly] = useState(false);

  useEffect(() => {
    // For now, we'll disable the overflow detection so both icon and text show together
    // This can be re-enabled later when we determine the specific conditions for icon-only mode
    const checkOverflow = () => {
      // Temporarily disabled - always show both icon and text
      setShowIconOnly(false);
      
      // Original overflow detection logic (commented out for now):
      // if (buttonRef.current && textRef.current && icon) {
      //   const buttonWidth = buttonRef.current.offsetWidth;
      //   const textWidth = textRef.current.scrollWidth;
      //   const padding = 40; // Account for increased padding
      //   const iconSpace = 24; // Space for smaller icon and gap
      //   
      //   const overflow = textWidth + iconSpace + padding > buttonWidth;
      //   setShowIconOnly(overflow);
      // }
    };

    // Initial check
    checkOverflow();
    
    // Use setTimeout to recheck after render
    const timeoutId = setTimeout(checkOverflow, 100);
    
    // Listen for window resize
    const handleResize = () => checkOverflow();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, [icon, children]);

  const buttonClasses = [
    styles.button,
    styles[variant],
    size === 'small' ? styles.small : '',
    fullWidth ? styles.fullWidth : '',
    showIconOnly ? styles.iconOnly : '',
    className
  ].filter(Boolean).join(' ');

  // Merge styles to ensure proper text display
  const mergedStyle = {
    minWidth: 'fit-content',
    width: 'auto',
    overflow: 'visible',
    ...style, // Allow style overrides but ensure text visibility
  };

  const buttonContent = (
    <>
      {icon && <span className={styles.icon}>{icon}</span>}
      <span 
        ref={textRef} 
        className={styles.text}
      >
        {children}
      </span>
    </>
  );

  const button = (
    <MuiButton 
      ref={buttonRef}
      className={buttonClasses} 
      style={mergedStyle}
      {...props}
    >
      {buttonContent}
    </MuiButton>
  );

  // Show tooltip only when explicitly provided
  if (tooltipText) {
    return (
      <Tooltip title={tooltipText} arrow>
        {button}
      </Tooltip>
    );
  }

  return button;
};

export default Button;