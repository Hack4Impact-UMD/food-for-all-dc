import React, { useState } from 'react';
import { Button, TextField, Typography, Box} from '@mui/material';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig.js'; 
import { Link } from 'react-router-dom'; // Ensure you are importing from 'react-router-dom'

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
  
  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // used chat gpt for email regex validation
    return re.test(email);
  };
 
  const validatePassword = (password: string | any[]) => {
    return password.length >= 6;
  };
  
  const handleSubmit = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (!validateEmail(email)) {
      setError('Invalid email format.');
      setLoading(false);
      return;
    }
    if (!validatePassword(password)) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      
      window.location.href = '/dashboard'; 
    } catch (err) {
      setError('Incorrect email or password.');
      setLoading(false);
    }
  };

  return (
    <Box
      component="form"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        p: 3
      }}
      onSubmit={handleSubmit}
    >
      <Typography variant="h4" component="h1" align="center">
        Login
      </Typography>
      <TextField
        label="Email"
        type="email"
        variant="outlined"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <TextField
        label="Password"
        type="password"
        variant="outlined"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <Button type="submit" variant="contained" color="primary">
        Login
      </Button>
      <Link to="/forgot-password" style={{ marginTop: '16px', textDecoration: 'none' }}>
        <Typography variant="body2" align="center">Forgot Password?</Typography>
      </Link>
    </Box>
  );
};

export default LoginPage;