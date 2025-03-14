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
  duration: number; // in milliseconds before fade-out starts
}

const PopUp: React.FC<PopUpProps> = ({ message, duration }) => {
  const [visible, setVisible] = useState(true);

  // Container style centers the box using flexbox
  const containerStyle = {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e0e0e0", // Optional: background color for contrast
  };

  // Box style for the centered element
  const boxStyle: React.CSSProperties = {
    position: "absolute",
    fontWeight: "bold",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
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

  return <div style={boxStyle}>{message}</div>;
};

export default PopUp;
