import { useEffect, useState } from "react";

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

  // Box style for the bottom left element
  const boxStyle: React.CSSProperties = {
    position: "fixed",
    bottom: "20px",
    left: "20px",
    fontWeight: "bold",
    padding: "20px",
    border: "3px solid #257E68",
    backgroundColor: "#fff",
    boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)",
    borderRadius: "8px",
    zIndex: 10,
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, duration); // 2 second timer.

    // Clean up the timer.
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return <div style={boxStyle}>{message}</div>;
};

export default PopUp;
