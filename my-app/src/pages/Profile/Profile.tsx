import React, { useState } from "react";
import "./Profile.css";

function Profile() {
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const toggleDropdown = () => {
        setDropdownOpen(!dropdownOpen);
    };

    return (
        <div>
            <div className="profile-container">
                <header className="profile-header">
                    <div className="menu-icon">&#9776;</div>
                    <div className="controls">
                        <button className="header-button">Calendar</button>
                        <div className="settings-icon">&#9881;</div>
                        <div className = "header-button">
                            Admin
                        </div>
                    </div>
                </header>
                <div className="profile-name">Natasha Yergafova</div>
                
                <div className="overview-title">OVERVIEW</div>
            </div>
                
            
            <div className="profile-main"></div>
        </div>
    );
}
export default Profile;