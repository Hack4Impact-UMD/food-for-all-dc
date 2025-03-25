import React, { useState } from "react";
import PopUp from "./PopUp"; // Import the PopUp component

const ClientProfile: React.FC = () => {
  const [showPopUp, setShowPopUp] = useState(false);

  const saveProfile = () => {
    // Logic to save the client profile
    // ...existing code...

    // Show the PopUp notification
    setShowPopUp(true);

    // Reset the state after a delay (matching the PopUp's duration)
    setTimeout(() => setShowPopUp(false), 2500);
  };

  return (
    <div>
      {/* ...existing code... */}
      <button onClick={saveProfile}>Save Profile</button>
      {showPopUp && <PopUp message="Profile saved successfully!" duration={2500} />}
    </div>
  );
};

export default ClientProfile;
