import React, { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { Box, Typography } from "@mui/material";
import { DeliveryEvent } from "../../../types/calendar-types";
import { ClientProfile } from "../../../types/client-types";
import DeliveryCard from "./DeliveryCard";
import EventCountHeader from "../../../components/EventCountHeader";
import { useRecurringDelivery } from "../../../context/RecurringDeliveryContext";
import VirtualScroll from "../../../components/VirtualScroll";


interface DayViewProps {
  events: DeliveryEvent[];
  clients: ClientProfile[];
  onEventModified: () => void;
  dailyLimit?: number;
}

const DayView: React.FC<DayViewProps> = React.memo(function DayView({ events, clients, onEventModified, dailyLimit }) {
  const { preloadDateRanges } = useRecurringDelivery();
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Constants for virtual scrolling
  const DELIVERY_CARD_HEIGHT = 120; // 108px from CSS + margin
  const VIRTUAL_SCROLL_THRESHOLD = 50; // Use virtual scrolling when more than 50 items
  
  // Memoized client lookup for better performance
  const clientLookupMap = useMemo(() => {
    const map = new Map();
    clients.forEach(client => {
      if (client.uid) {
        map.set(client.uid, client);
      }
    });
    return map;
  }, [clients]);

  // Calculate container height for virtual scrolling
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const availableHeight = window.innerHeight - rect.top - 50; // 50px buffer
        setContainerHeight(Math.max(300, availableHeight)); // Minimum 300px
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Batch preload recurring delivery date ranges for all events
  useEffect(() => {
    const recurringRequests = events
      .filter(event => event.recurrence && event.recurrence !== 'None')
      .map(event => ({
        clientId: event.clientId,
        recurrenceType: event.recurrence
      }));

    if (recurringRequests.length > 0) {
      // Remove duplicates
      const uniqueRequests = recurringRequests.filter((request, index, array) => 
        array.findIndex(r => r.clientId === request.clientId && r.recurrenceType === request.recurrenceType) === index
      );
      
      preloadDateRanges(uniqueRequests).catch(error => {
        console.error('Failed to preload recurring delivery date ranges:', error);
      });
    }
  }, [events, preloadDateRanges]);

  // Render function for virtual scroll items
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderDeliveryCard = useCallback((event: DeliveryEvent, index: number) => {
    const client = clientLookupMap.get(event.clientId);
    return (
      <DeliveryCard
        key={event.id}
        event={event}
        client={client}
        onEventModified={onEventModified}
        allEvents={events}
      />
    );
  }, [clientLookupMap, onEventModified, events]);

  return (
    <Box sx={{ padding: 1, width: "100%", maxWidth: "100%", display: "flex", flexDirection: "column", height: "97%", minHeight: "300px", overflow: "hidden" }}>
      <EventCountHeader events={events} limit={dailyLimit} />

      {events.length === 0 ? (
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 2 }}>
          <Typography variant="body1" sx={{ textAlign: "center", color: "text.secondary" }}>
            No deliveries scheduled for this day.
          </Typography>
        </Box>
      ) : (
        <Box
          ref={containerRef}
          sx={{
            flex: 1,
            width: "100%",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {events.length > VIRTUAL_SCROLL_THRESHOLD ? (
            (() => {
              console.log(`🚀 [VIRTUAL_SCROLL] Using virtual scrolling for ${events.length} events (threshold: ${VIRTUAL_SCROLL_THRESHOLD})`);
              return (
                <VirtualScroll
                  items={events}
                  itemHeight={DELIVERY_CARD_HEIGHT}
                  containerHeight={containerHeight}
                  renderItem={renderDeliveryCard}
                  overscan={10}
                />
              );
            })()
          ) : (
            (() => {
              console.log(`📄 [REGULAR_SCROLL] Using regular scrolling for ${events.length} events (below threshold: ${VIRTUAL_SCROLL_THRESHOLD})`);
              return (
                <Box
                  sx={{
                    height: "100%",
                    overflowY: "auto",
                    width: "100%",
                  }}
                >
                  {events.map((event) => {
                    const client = clientLookupMap.get(event.clientId);
                    return (
                      <DeliveryCard
                        key={event.id}
                        event={event}
                        client={client}
                        onEventModified={onEventModified}
                        allEvents={events}
                      />
                    );
                  })}
                </Box>
              );
            })()
          )}
        </Box>
      )}
    </Box>
  );
});

export default DayView;