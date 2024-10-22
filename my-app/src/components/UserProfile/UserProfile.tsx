import React from "react";
import { useParams } from "react-router-dom";
import "./UserProfile.css";

interface Params {
  uid: string;
}

const UserProfile: React.FC = () => {
  const { uid } = useParams<{ uid: string }>();

  return (
    <div className="container">
      <div className="header-row">
        <h1>Basic Information</h1>
        <div className="edit-button">
          <button>Edit</button>
        </div>
      </div>
      <hr />

      <div className="grid-container">
        <div className="grid-item">
          <label>Name</label>
          <span className="value">Natasha M Yergafova</span>
        </div>
        <div className="grid-item">
          <label>Date of Birth</label>
          <span className="value">April 2, 1997 (Age 27)</span>
        </div>
        <div className="grid-item">
          <label>Address</label>
          <span className="value">2309 Forest Creek Ln, Columbia MD 20588</span>
        </div>
        <div className="grid-item">
          <label>Client ID</label>
          <span className="value">{uid}</span>
        </div>
        <div className="grid-item">
          <label>Gender</label>
          <span className="value">Female</span>
        </div>
        <div className="grid-item">
          <label>Phone</label>
          <span className="value">(202)-346-9812</span>
        </div>
        <div className="grid-item">
          <label>Alternate Phone</label>
          <span className="value">N/A</span>
        </div>
        <div className="grid-item">
          <label>Quadrant</label>
          <span className="value">2</span>
        </div>
        <div className="grid-item">
          <label>Ward</label>
          <span className="value">2</span>
        </div>

        <div className="grid-item">
          <label>Ethnicity</label>
          <span className="value">Bulgarian</span>
        </div>
        <div className="grid-item">
          <label>Adults</label>
          <span className="value">1</span>
        </div>
        <div className="grid-item">
          <label>Children</label>
          <span className="value">2</span>
        </div>
        <div className="grid-item">
          <label>Delivery Frequency</label>
          <span className="value">Once per week</span>
        </div>
        <div className="grid-item">
          <label>Dietary Restrictions</label>
          <span className="value">Gluten free</span>
        </div>
        <div className="grid-item">
          <label>Delivery Instructions</label>
          <span className="value">Leave at door</span>
        </div>
        <div className="grid-item">
          <label>Notes</label>
          <span className="value">Busy Schedule</span>
        </div>
        <div className="grid-item">
          <label>Referral Entity</label>
          <span className="value"><span style={{ fontWeight: "bold", color: "#257e68" }}>Martin Young</span>, 123-234-3456</span>
        </div>
        <div className="grid-item">
          <label>Start/End Date</label>
          <span className="value">10/10/10 - 20/20/20</span>
        </div>
      </div>




    </div >
  );
};

export default UserProfile;
