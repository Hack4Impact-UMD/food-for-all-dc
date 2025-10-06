import { DayPilot } from "@daypilot/daypilot-lite-react";
import { DateTime } from "luxon";
import { TimeUtils } from "../../../utils/timeUtils";
import DeliveryService from "../../../services/delivery-service";
import { toDayPilotDateString } from '../../../utils/timestamp';
import { ViewType, DeliveryEvent } from "../../../types/calendar-types";
import { ClientProfile } from "../../../types/client-types";

export async function getEventsByViewType({
  viewType,
  currentDate,
  clients
}: {
  viewType: ViewType;
  currentDate: DayPilot.Date;
  clients: ClientProfile[];
}) {
  let start = new DayPilot.Date(currentDate);
  let endDate;

  switch (viewType) {
    case "Month": {
      const monthStart = currentDate.firstDayOfMonth();
      const monthEnd = currentDate.lastDayOfMonth();
      const monthStartLuxon = TimeUtils.fromJSDate(monthStart.toDate());
      const monthEndLuxon = TimeUtils.fromJSDate(monthEnd.toDate());
      const gridStart = monthStartLuxon.startOf('week').toJSDate();
      const gridEnd = monthEndLuxon.endOf('week').toJSDate();
      const extendedStart = TimeUtils.fromJSDate(gridStart).minus({ weeks: 2 }).toJSDate();
      const extendedEnd = TimeUtils.fromJSDate(gridEnd).plus({ weeks: 2 }).toJSDate();
      start = new DayPilot.Date(extendedStart);
      endDate = new DayPilot.Date(extendedEnd);
      break;
    }
    case "Day": {
      const easternZone = 'America/New_York';
      const selectedDateStr = currentDate.toString("yyyy-MM-dd");
      const selectedLuxon = DateTime.fromISO(selectedDateStr, { zone: easternZone }).startOf('day');
      const nextDayLuxon = selectedLuxon.plus({ days: 1 });
      start = new DayPilot.Date(selectedLuxon.toJSDate());
      endDate = new DayPilot.Date(nextDayLuxon.toJSDate());
      break;
    }
    default:
      endDate = start.addDays(1);
  }

  const deliveryService = DeliveryService.getInstance();
  const fetchedEvents = await deliveryService.getEventsByDateRange(
    start.toDate(),
    endDate.toDate()
  );

  // Create a client lookup map for O(1) performance instead of O(n) for each event
  const clientLookupStartTime = performance.now();
  const clientMap = new Map(clients.map((client: ClientProfile) => [client.uid, client]));
  console.log('⚡ getEventsByViewType: Client map creation took', (performance.now() - clientLookupStartTime).toFixed(2), 'ms for', clients.length, 'clients');

  // Update client names in events if client exists, but do not filter out any events
  const nameResolutionStartTime = performance.now();
  const updatedEvents = fetchedEvents.map(event => {
    const client = clientMap.get(event.clientId); // O(1) lookup instead of O(n)
    if (client) {
      const fullName = `${client.firstName} ${client.lastName}`.trim();
      return {
        ...event,
        clientName: fullName
      };
    }
    return event;
  });
  console.log('⚡ getEventsByViewType: Name resolution took', (performance.now() - nameResolutionStartTime).toFixed(2), 'ms for', fetchedEvents.length, 'events');

  // Format for calendar config if needed
  const formattedEvents = updatedEvents.map(event => ({
    id: event.id,
    text: `Client: ${event.clientName} (Driver: ${event.assignedDriverName})`,
    start: new DayPilot.Date(toDayPilotDateString(event.deliveryDate)),
    end: new DayPilot.Date(toDayPilotDateString(event.deliveryDate)),
    backColor: "#257E68",
  }));

  return { updatedEvents, formattedEvents };
}
