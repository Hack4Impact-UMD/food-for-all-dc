import { DayPilot } from "@daypilot/daypilot-lite-react";
import { DateTime } from "luxon";
import { TimeUtils } from "../../../utils/timeUtils";
import DeliveryService from "../../../services/delivery-service";
import { toJSDate } from '../../../utils/timestamp';
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

  const clientMap = new Map(clients.map((client: ClientProfile) => [client.uid, client]));

  const updatedEvents = fetchedEvents.map(event => {
    const client = clientMap.get(event.clientId);
    if (client) {
      const fullName = `${client.firstName} ${client.lastName}`.trim();
      return {
        ...event,
        clientName: fullName
      };
    }
    return event;
  });

  // Format for calendar config if needed
  const formattedEvents = updatedEvents.map(event => ({
    id: event.id,
    text: `Client: ${event.clientName} (Driver: ${event.assignedDriverName})`,
  start: new DayPilot.Date(toJSDate(event.deliveryDate)),
  end: new DayPilot.Date(toJSDate(event.deliveryDate)),
    backColor: "var(--color-primary)",
  }));

  return { updatedEvents, formattedEvents };
}
