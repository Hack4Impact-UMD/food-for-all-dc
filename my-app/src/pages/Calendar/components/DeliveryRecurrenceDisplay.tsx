import React, { useEffect, useState } from 'react';
import { Typography } from '@mui/material';
import { format } from 'date-fns';
import { DeliveryEvent } from '../../../types/calendar-types';
import { useRecurringDelivery } from '../../../context/RecurringDeliveryContext';
import styles from './DeliveryCard.module.css';

// Helper to parse various date formats as local date
function parseLocalDateString(dateStr: string): Date {
  if (!dateStr) return new Date('');
  
  // Handle MM/DD/YYYY format
  if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    return new Date(dateStr);
  }
  
  // Handle YYYY-MM-DD format
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // Try parsing as regular date string
  return new Date(dateStr);
}

// Helper function to get delivery recurrence label and CSS class
const getDeliveryTypeInfo = (recurrence: string) => {
  switch (recurrence) {
    case 'Weekly':
      return { label: 'WEEKLY DELIVERY', className: styles.weekly };
    case '2x-Monthly':
      return { label: '2x-MONTHLY DELIVERY', className: styles.twoXMonthly };
    case 'Monthly':
      return { label: 'MONTHLY DELIVERY', className: styles.monthly };
    case 'Custom':
      return { label: 'CUSTOM DELIVERY', className: styles.custom };
    default:
      return { label: 'ONE-OFF DELIVERY', className: styles.oneOff };
  }
};

interface DeliveryRecurrenceDisplayProps {
  event: DeliveryEvent;
  allEvents?: DeliveryEvent[];
}

const DeliveryRecurrenceDisplay: React.FC<DeliveryRecurrenceDisplayProps> = ({ event, allEvents }) => {
  const { label, className } = getDeliveryTypeInfo(event.recurrence);
  const [dateRange, setDateRange] = useState<{ earliest: Date | null; latest: Date | null } | null>(null);
  const { getDateRange } = useRecurringDelivery();

  useEffect(() => {
    if (event.recurrence !== 'None') {
      let cancelled = false;
      
      getDateRange(event.clientId, event.recurrence)
        .then(range => {
          if (!cancelled) {
            setDateRange(range);
          }
        })
        .catch(error => {
          console.error('Error fetching recurring delivery date range:', error);
          if (!cancelled) {
            setDateRange({ earliest: null, latest: null });
          }
        });
      
      return () => {
        cancelled = true;
      };
    }
  }, [event.clientId, event.recurrence, getDateRange]);

  let dateRangeElement = null;
  // Only show date range if not a one-off delivery and we have fetched the date range
  if (event.recurrence !== 'None' && dateRange && dateRange.earliest && dateRange.latest) {
    try {
      const startDate = format(dateRange.earliest, 'M/d/yy');
      const endDate = format(dateRange.latest, 'M/d/yy');
      const formattedDateRange = `(${startDate} - ${endDate})`;
      
      dateRangeElement = (
        <Typography 
          variant="body2" 
          sx={{ 
            fontSize: '0.9rem', 
            color: 'text.secondary',
            marginTop: '2px'
          }}
        >
          {formattedDateRange}
        </Typography>
      );
    } catch (error) {
      console.error("Error formatting date range:", error);
    }
  }
  
  return (
    <>
      <Typography className={`${styles.deliveryTypeIndicator} ${className}`}>
        {label}
      </Typography>
      {dateRangeElement}
    </>
  );
};

export default DeliveryRecurrenceDisplay; 