import React, { useState } from 'react';
import {
  startOfMonth, endOfMonth, addMonths, subMonths,
  format, eachDayOfInterval, startOfWeek, endOfWeek, addDays,
  eachHourOfInterval,
  startOfDay,
  endOfDay,
  getHours,
  eachMinuteOfInterval,
  isEqual
} from 'date-fns';
import './CalendarPage.css';
import { Box, Button, TextField, Typography } from '@mui/material';

type ViewType = 'month' | 'week' | 'day';

interface CalendarProps {
  initialMonth?: Date;
  events?: { date: Date; title: string; description?: string }[];
}

const CalendarPage: React.FC<CalendarProps> = ({ initialMonth = new Date(), events = [] }) => {
  const [currentDate, setCurrentDate] = useState(initialMonth);
  const [viewType, setViewType] = useState<ViewType>('month');
  const [calendarEvents, setCalendarEvents] = useState(events);

  // State for new event form
  const [newEventDate, setNewEventDate] = useState<string>('');
  const [newEventTitle, setNewEventTitle] = useState<string>('');
  const [newEventDescription, setNewEventDescription] = useState<string>('');

  const handleNext = () => {
    setCurrentDate(viewType === 'month' ? addMonths(currentDate, 1) : addDays(currentDate, viewType === 'week' ? 7 : 1));
  };

  const handlePrev = () => {
    setCurrentDate(viewType === 'month' ? subMonths(currentDate, 1) : addDays(currentDate, viewType === 'week' ? -7 : -1));
  };

  const getEventsForDate = (date: Date) =>
    calendarEvents.filter(event => format(event.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));

  const handleAddEvent = () => {
    const newEvent = {
      date: new Date(newEventDate),
      title: newEventTitle,
      description: newEventDescription
    };
    setCalendarEvents([...calendarEvents, newEvent]);
    setNewEventDate('');
    setNewEventTitle('');
    setNewEventDescription('');
  };

  const renderMonthView = () => {
    const daysInMonth = eachDayOfInterval({
      start: startOfWeek(startOfMonth(currentDate)),
      end: endOfWeek(endOfMonth(currentDate)),
    });

    return (
      <div className="calendar-grid month-view">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="calendar-day-header">{day}</div>
        ))}
        {daysInMonth.map(date => (
          <div
            key={date.toString()}
            className={`calendar-day ${date.getMonth() === currentDate.getMonth() ? 'current-month' : 'other-month'}`}
          >
            <span>{format(date, 'd')}</span>
            {getEventsForDate(date).map(event => (
              <div key={event.title} className="event-indicator">{event.title}</div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderWeekView = () => {
    const daysInWeek = eachDayOfInterval({
      start: startOfWeek(currentDate),
      end: endOfWeek(currentDate),
    });

    return (
      <div className="calendar-grid week-view">
        {daysInWeek.map(date => (
          <div key={date.toString()} className="calendar-day">
            <span className="week-date-header">{format(date, 'EEE, MMM d')}</span>
            {getEventsForDate(date).map(event => (
              <div key={event.title} className="event-indicator">{event.title}</div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate);
  
    // Generate hours and 15-minute slots for each hour
    const hoursInDay = eachHourOfInterval({
      start: startOfDay(currentDate),
      end: endOfDay(currentDate),
    });
  
    const hoursWithEvents = hoursInDay.filter(hour => {
      return dayEvents.some(event => {
        return (
          hour.getHours() === new Date(event.date).getHours() &&
          hour.getDate() === new Date(event.date).getDate() &&
          hour.getMonth() === new Date(event.date).getMonth() &&
          hour.getFullYear() === new Date(event.date).getFullYear()
        );
      });
    });
  
    return (
      <div className="calendar-day-view">
        {hoursWithEvents.map(hour => (
          <Box key={format(hour, 'HH:mm')} className="hour-row" sx={{ display: 'flex', alignItems: 'flex-start', height: '125px'}}>
            <Typography className="hour-label" sx={{ width: '60px' }}>{format(hour, 'HH:mm')}</Typography>
            <Box className="event-container" sx={{ flexGrow: 1, display: 'flex', flexWrap: 'wrap', backgroundColor: '#D9D9D9', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', height: '100%' }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', width: '100%' }}>
                {eachMinuteOfInterval(
                  { start: hour, end: new Date(hour.getTime() + 60 * 60 * 1000 - 1) },
                  { step: 15 }
                ).map(slot => {
                  const eventsInSlot = dayEvents.filter(event =>
                    isEqual(new Date(event.date), slot)
                  );
  
                  return (
                    <Box key={format(slot, 'HH:mm')} className="slot" sx={{ marginRight: '5px', flexGrow: 1, color: "white", display: 'flex'}}>
                      {eventsInSlot.length > 0 ? (
                        eventsInSlot.map(event => (
                          <Box key={event.title} className="event-detail" sx={{ display: 'block', margin: '5px 10px', padding: '5px 10px', backgroundColor: '#257E68', borderRadius: '20px', boxShadow: '0 0 2px rgba(0,0,0,0.2)', flex: 1, marginBottom: "10px"}}>
                            {format(slot, 'HH:mm')} {event.title}
                          </Box>
                        ))
                      ) : (
                        <div className="empty-slot" style={{ color: '#888' }}></div>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        ))}
      </div>
    );
  };
  
  
  
  
  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <button onClick={handlePrev}>&lt;</button>
        <span>{format(currentDate, viewType === 'month' ? 'MMMM yyyy' : 'MMMM d, yyyy')}</span>
        <button onClick={handleNext}>&gt;</button>

        <div className="view-selection">
          <button onClick={() => setViewType('month')}>Month</button>
          <button onClick={() => setViewType('week')}>Week</button>
          <button onClick={() => setViewType('day')}>Day</button>
        </div>
      </div>

      {viewType === 'month' && renderMonthView()}
      {viewType === 'week' && renderWeekView()}
      {viewType === 'day' && renderDayView()}

      <Box>
        <h3>Add New Event</h3>
        <TextField
          type="date"
          value={newEventDate}
          onChange={(e) => setNewEventDate(e.target.value)}
          placeholder="Event Date"
        />
        <TextField
          type="text"
          value={newEventTitle}
          onChange={(e) => setNewEventTitle(e.target.value)}
          placeholder="Event Title"
        />
        <TextField
          value={newEventDescription}
          onChange={(e) => setNewEventDescription(e.target.value)}
          placeholder="Event Description (optional)"
        />
        <Button onClick={handleAddEvent}>Add Event</Button>
      </Box>
    </div>
  );
};

export default CalendarPage;
