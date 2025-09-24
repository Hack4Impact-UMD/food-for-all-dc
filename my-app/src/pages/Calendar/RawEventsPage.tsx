import React, { useEffect, useState } from "react";
import DeliveryService from "../../services/delivery-service";
import { DeliveryEvent } from "../../types/calendar-types";
import { Box, Typography, CircularProgress, Paper } from "@mui/material";
import Button from "@mui/material/Button";

const RawEventsPage: React.FC = () => {
  const [updatedIds, setUpdatedIds] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);
  const [events, setEvents] = useState<DeliveryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const deliveryService = DeliveryService.getInstance();
        // Fetch all events (assuming getAllEvents exists, otherwise use getEventsByDateRange with a wide range)
        const allEvents = await deliveryService.getAllEvents?.();
        if (allEvents) {
          setEvents(allEvents);
        } else {
          setError("Could not fetch events. Make sure getAllEvents is implemented.");
        }
      } catch (err: any) {
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  // Only show events with repeatsEndDate in MM/DD/YYYY format
  const mmddyyyyRegex = /^\d{2}\/\d{2}\/\d{4}$/;
  const filteredEvents = events.filter(e => mmddyyyyRegex.test(e.repeatsEndDate ?? ""));

  // Convert MM/DD/YYYY to ISO
  function convertToISO(dateStr: string) {
    if (!mmddyyyyRegex.test(dateStr)) return dateStr;
    const [month, day, year] = dateStr.split("/");
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`).toISOString();
  }

  // Button handler to update all filtered events
  const handleConvertDates = async () => {
    setUpdating(true);
    const deliveryService = DeliveryService.getInstance();
    const updated: string[] = [];
    for (const event of filteredEvents) {
      const isoDate = convertToISO(event.repeatsEndDate!);
      try {
        await deliveryService.updateEvent(event.id, { repeatsEndDate: isoDate });
        updated.push(event.id);
      } catch (err) {
        // Optionally handle error per event
      }
    }
    setUpdatedIds(updated);
    setUpdating(false);
    // Optionally, refetch events to show updated data
    // const allEvents = await deliveryService.getAllEvents?.();
    // if (allEvents) setEvents(allEvents);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>
        Raw Events Data (repeatsEndDate MM/DD/YYYY only)
      </Typography>
      <Button variant="contained" color="primary" onClick={handleConvertDates} disabled={updating || filteredEvents.length === 0} sx={{ mb: 2 }}>
        {updating ? "Converting..." : "Convert repeatsEndDate to ISO"}
      </Button>
      {loading && <CircularProgress />}
      {error && <Typography color="error">{error}</Typography>}
      {!loading && !error && (
        <Box>
          {filteredEvents.length === 0 ? (
            <Typography>No events found.</Typography>
          ) : (
            filteredEvents.map((event, idx) => (
              <Paper key={event.id || idx} sx={{ mb: 2, p: 2, fontFamily: 'monospace', whiteSpace: 'pre-wrap', border: updatedIds.includes(event.id) ? '2px solid green' : undefined }}>
                {JSON.stringify(event, null, 2)}
                {updatedIds.includes(event.id) && (
                  <Typography color="success.main" fontWeight={700}>Date converted!</Typography>
                )}
              </Paper>
            ))
          )}
        </Box>
      )}
    </Box>
  );
};

export default RawEventsPage;
