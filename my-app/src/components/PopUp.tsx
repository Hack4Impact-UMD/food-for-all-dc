import React, { useEffect } from "react";
import styles from "./PopUp.module.css";

/**
 * PopUp notification component with auto-dismiss functionality
 *
 * @example
 * // NotificationProvider renders timed toast cards with dismissal callbacks
 * <PopUp
 *   message="Delivery changes saved"
 *   type="info"
 *   onDismiss={() => removeToast(id)}
 * />
 */
interface PopUpProps {
  /** Message to display in the popup */
  message: string;
  /** Duration in milliseconds before auto-dismiss */
  duration?: number;
  /** Type of notification (affects styling) */
  type?: "success" | "error" | "warning" | "info";
  /** Callback when popup is dismissed */
  onDismiss: () => void;
}

const PopUp: React.FC<PopUpProps> = ({ message, duration = 3000, type = "success", onDismiss }) => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onDismiss();
    }, duration);

    // Clean up the timer
    return () => window.clearTimeout(timer);
  }, [duration, onDismiss]);

  const popupClasses = [styles.popupContainer, styles[type] || styles.success].join(" ");
  const role = type === "error" || type === "warning" ? "alert" : "status";

  return (
    <div
      className={popupClasses}
      role={role}
      aria-live={role === "alert" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {message}
    </div>
  );
};

export default PopUp;
