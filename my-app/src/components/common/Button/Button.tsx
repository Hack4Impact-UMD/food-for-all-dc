import React from "react";
import { Button as MuiButton, ButtonProps as MuiButtonProps, Tooltip } from "@mui/material";
import styles from "./Button.module.css";

/**
 * Custom Button component with consistent styling and optional icon support
 *
 * @example
 * // Basic button
 * <Button variant="primary">Click Me</Button>
 *
 * // Button with icon
 * <Button variant="secondary" icon={<SaveIcon />} tooltipText="Save changes">
 *   Save
 * </Button>
 */
interface ButtonProps extends Omit<MuiButtonProps, "variant"> {
  /** Button style variant */
  variant?: "primary" | "secondary";
  /** Button size */
  size?: "small" | "medium";
  /** Whether button should take full width */
  fullWidth?: boolean;
  /** Optional icon to display before text */
  icon?: React.ReactNode;
  /** Optional tooltip text */
  tooltipText?: string;
}

const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "medium",
  fullWidth = false,
  className = "",
  icon,
  tooltipText,
  children,
  style,
  ...props
}) => {
  const buttonClasses = [
    styles.button,
    styles[variant],
    size === "small" ? styles.small : "",
    fullWidth ? styles.fullWidth : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const buttonContent = (
    <>
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.text}>{children}</span>
    </>
  );

  const button = (
    <MuiButton className={buttonClasses} style={style} {...props}>
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
