import { useEffect, useState } from "react";
import styles from "./PopUp.module.css";

// Example usage:
// After importing to another component, have some state that controls whether
// the pop up is shown - i.e: const [showPopUp, setShowPopUp] = useState(false);
// Then upon a successful save, set the variable to true and have a timeout
// to reset it - i.e:
// Show the notification
// setShowNotification(true);
// Reset the state after a delay (matching the PopUp's duration)
// setTimeout(() => setShowNotification(false), 2500);

interface PopUpProps {
  message: string;
  duration: number;
}

const PopUp: React.FC<PopUpProps> = ({ message, duration }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, duration);

    // Clean up the timer.
    return () => clearTimeout(timer);
  }, [duration]);

  if (!visible) return null;

  return <div className={styles.popupContainer}>{message}</div>;
};

export default PopUp;
