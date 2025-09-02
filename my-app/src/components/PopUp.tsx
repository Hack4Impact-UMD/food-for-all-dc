import React, { useEffect, useState } from "react";
import styles from "./PopUp.module.css";

/**
 * PopUp notification component with auto-dismiss functionality
 *
 * @example
 * // Basic success notification
 * <PopUp message="Data saved successfully!" type="success" />
 *
 * // Error notification with custom duration
 * <PopUp
 *   message="Failed to save data"
 *   type="error"
 *   duration={5000}
 * />
 *
 * // Usage with state management:
 * const [showPopUp, setShowPopUp] = useState(false);
 *
 * const handleSave = () => {
 *   // ... save logic
 *   setShowPopUp(true);
 *   setTimeout(() => setShowPopUp(false), 3000);
 * };
 */
interface PopUpProps {
  /** Message to display in the popup */
  message: string;
  /** Duration in milliseconds before auto-dismiss */
  duration?: number;
  /** Type of notification (affects styling) */
  type?: "success" | "error" | "warning" | "info";
  /** Callback when popup is dismissed */
  onDismiss?: () => void;
}

const PopUp: React.FC<PopUpProps> = ({ message, duration = 3000, type = "success", onDismiss }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, duration);

    // Clean up the timer
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  if (!visible) return null;

  const popupClasses = [styles.popupContainer, styles[type] || styles.success].join(" ");

  return <div className={popupClasses}>{message}</div>;
};

export default PopUp;
