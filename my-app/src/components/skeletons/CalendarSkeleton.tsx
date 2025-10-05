import React from 'react';
import { Box, Skeleton, Card, CardContent, Typography } from '@mui/material';

interface CalendarSkeletonProps {
  viewType: 'Day' | 'Month';
}

export const CalendarSkeleton: React.FC<CalendarSkeletonProps> = ({ viewType }) => {
  if (viewType === 'Day') {
    return <DayViewSkeleton />;
  }
  
  return <MonthViewSkeleton />;
};

const DayViewSkeleton: React.FC = () => {
  return (
    <Box sx={{ padding: 2 }}>
      {/* Day header skeleton */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Skeleton variant="text" width={120} height={40} sx={{ mr: 2 }} />
        <Skeleton variant="circular" width={32} height={32} />
      </Box>

      {/* Events list skeleton */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[...Array(3)].map((_, index) => (
          <DeliveryCardSkeleton key={index} />
        ))}
      </Box>

      {/* Loading text */}
      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.7 }}>
          Loading calendar data...
        </Typography>
      </Box>
    </Box>
  );
};

const MonthViewSkeleton: React.FC = () => {
  return (
    <Box sx={{ padding: 2 }}>
      {/* Month grid skeleton */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: 1,
        mb: 2
      }}>
        {/* Week days header */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <Box key={day} sx={{ p: 1, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">{day}</Typography>
          </Box>
        ))}
        
        {/* Calendar days skeleton */}
        {[...Array(35)].map((_, index) => (
          <Card key={index} sx={{ minHeight: 80, border: '1px solid #e0e0e0' }}>
            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
              <Skeleton variant="text" width={20} height={20} />
              <Skeleton variant="rectangular" width="100%" height={12} sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Loading text */}
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.7 }}>
          Loading calendar data...
        </Typography>
      </Box>
    </Box>
  );
};

const DeliveryCardSkeleton: React.FC = () => {
  return (
    <Card sx={{ 
      borderLeft: '4px solid #e0e0e0',
      boxShadow: 1,
      '&:hover': { boxShadow: 2 }
    }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          {/* Client name skeleton */}
          <Skeleton variant="text" width={140} height={24} />
          {/* Menu button skeleton */}
          <Skeleton variant="circular" width={24} height={24} />
        </Box>

        {/* Driver info skeleton */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Skeleton variant="circular" width={16} height={16} sx={{ mr: 1 }} />
          <Skeleton variant="text" width={100} height={20} />
        </Box>

        {/* Recurrence info skeleton */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Skeleton variant="circular" width={16} height={16} sx={{ mr: 1 }} />
          <Skeleton variant="text" width={80} height={20} />
        </Box>

        {/* Time info skeleton */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Skeleton variant="circular" width={16} height={16} sx={{ mr: 1 }} />
          <Skeleton variant="text" width={60} height={20} />
        </Box>
      </CardContent>
    </Card>
  );
};

export default CalendarSkeleton;