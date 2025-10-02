import React from 'react';
import { Box, Typography } from '@mui/material';

const DietaryRestrictionsLegend: React.FC = () => {
  // Color definitions from Spreadsheet.tsx
  const colorTypes = [
    {
      name: 'General Dietary Restrictions',
      color: '#e8f5e9'
    },
    {
      name: 'Food Allergies',
      color: '#FFEBEE'
    },
    {
      name: 'Other Restrictions',
      color: '#F3E8FF'
    }
  ];

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'flex-end',
      gap: 2, 
      mb: 2,
      p: 1
    }}>
      <Typography 
        variant="body2" 
        sx={{ 
          fontWeight: 600, 
          color: '#257e68',
          fontSize: '0.735rem'
        }}
      >
        Dietary Restrictions:
      </Typography>
      
      {colorTypes.map((type, index) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            sx={{
              width: 13.44,
              height: 13.44,
              backgroundColor: type.color,
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: 0.5
            }}
          />
          <Typography 
            variant="body2" 
            sx={{ 
              fontSize: '0.672rem',
              color: '#555'
            }}
          >
            {type.name}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

export default DietaryRestrictionsLegend;