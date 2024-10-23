import React from "react";
import { useNavigate } from 'react-router-dom'; // Import useNavigate


const Dashboard = () => {

  const navigate = useNavigate(); 

  const goToCalendar = () => {
    navigate('/calendar'); 
  };

  const goToProfile = () => {
    navigate('/profile'); 
  };

  return (
    <div className="App">
      <header className="App-header">
        <p>Temporary Home Page</p>
        <p>Unitl we have all the authentication and routing set up, use this page to create a button to route to the page you are working on</p>
        <div className="buttons">
          <button onClick={goToCalendar}>Calendar</button>
          <button onClick={goToProfile}>Profile</button>
        </div>      
      </header>
    </div>
  );
};

export default Dashboard;
