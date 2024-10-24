import React, { useState } from "react";
import "./Profile.css";
import { Edit } from "lucide-react";
import { Icon } from '@iconify/react';

function Profile() {
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const toggleDropdown = () => {
        setDropdownOpen(!dropdownOpen);
    };

    return (
        <div>
            <div className="profile-container">
                <div className = "white-container">
                    <header className="profile-header">
                        <div className="menu-icon">&#9776;</div>
                        <div className="buttons-together">
                            <button className="header-button">Calendar</button>
                            <div className="settings-icon">&#9881;</div>
                            <button className = "header-button">Admin</button>
                        </div>
                    </header>
                    <div className="profile-name">Natasha Yergafova</div>
                    <div className = "buttons-together">
                        <Icon className = "green" icon="iconamoon:profile-fill" width="32" height="32" />
                        <div className="overview-title">OVERVIEW</div>
                    </div>
                </div>
                
            </div>
                
            
            <div className="profile-main">
                <div className = "centered-box">
                    <div className = "box-header">
                        <div className = "basic-info-title">Basic Information</div>
                        <div className = "buttons-together">
                            <div className="edit">
                                <button className="edit-button"><Edit size={24} /></button>
                            </div>
                            <p className = "edit">Edit</p>
                        </div>
                    </div>
                    <div className="info-grid">
                        <div>
                            <span className="info-category">Name</span>
                            <span className="information">Natasha M Yergafova</span>
                        </div>
                        <div>
                            <span className="info-category">Date of Birth</span>
                            <span className="information">April 2, 1997 (Age 27)</span>
                        </div>
                        <div>
                            <span className="info-category">Address</span>
                            <span className="information">2309 Forest Creek Ln, Columbia MD 20588</span>
                        </div>
                        <div>
                            <span className="info-category">Client ID</span>
                            <span className="information"></span>
                        </div>
                        <div>
                            <span className="info-category">Gender</span>
                            <span className="information"></span>
                        </div>
                        <div>
                            <span className="info-category">Phone</span>
                            <span className="information"></span>
                        </div>
                        <div>
                            <span className="info-category">Alternate Phone</span>
                            <span className="information"></span>
                        </div>
                        <div>
                            <span className="info-category">Quadrant</span>
                            <span className="information"></span>
                        </div>
                        <div>
                            <span className="info-category">Ward</span>
                            <span className="information"></span>
                        </div>
                        <div>
                            <span className="info-category">Ethnicity</span>
                            <span className="information"></span>
                        </div>
                        <div>
                            <span className="info-category">Adults</span>
                            <span className="information"></span>
                        </div>
                        <div>
                            <span className="info-category">Children</span>
                            <span className="information"></span>
                        </div>
                        <div>
                            <span className="info-category">Delivery Frequency</span>
                            <span className="information"></span>
                        </div>
                        <div>
                            <span className="info-category">Dietary Restrictions</span>
                            <span className="information"></span>
                        </div>
                        <div>
                            <span className="info-category">Delivery Instructions</span>
                            <span className="information"></span>
                        </div>
                        <div>
                            <span className="info-category">Notes</span>
                            <span className="information"></span>
                        </div>
                        <div>
                            <span className="info-category">REFERRAL ENTITY</span>
                            <span className="information"></span>
                        </div>
                        <div>
                            <span className="info-category">Start/end date</span>
                            <span className="information"></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
export default Profile;