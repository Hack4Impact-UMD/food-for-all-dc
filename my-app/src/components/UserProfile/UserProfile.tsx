import React from "react";
import { useParams } from "react-router-dom";

const UserProfile: React.FC = () => {
  const { uid } = useParams<{ uid: string }>();

  return (
    <div>
      <h1>User Profile</h1>
      <p>Showing details for user UID: {uid}</p>
    </div>
  );
};

export default UserProfile;
