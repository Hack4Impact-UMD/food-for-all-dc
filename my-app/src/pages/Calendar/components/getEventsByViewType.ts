import { DayPilot } from "@daypilot/daypilot-lite-react";
import DeliveryService from "../../../services/delivery-service";
import { ViewType, DeliveryEvent } from "../../../types/calendar-types";
import { ClientProfile } from "../../../types/client-types";
import { deliveryDate } from "../../../utils/deliveryDate";
import { getCalendarViewRange } from "./calendarDateRange";

export async function getEventsByViewType({
  viewType,
  currentDate,
  clients,
}: {
  viewType: ViewType;
  currentDate: DayPilot.Date;
  clients: ClientProfile[];
}) {
  const { start, endExclusive } = getCalendarViewRange(currentDate, viewType);

  const deliveryService = DeliveryService.getInstance();
  const fetchedEvents = await deliveryService.getEventsByDateRange(
    start.toDate(),
    endExclusive.toDate()
  );

  const clientMap = new Map(clients.map((client: ClientProfile) => [client.uid, client]));

  const updatedEvents = fetchedEvents.map((event) => {
    const client = clientMap.get(event.clientId);
    if (client) {
      const fullName = `${client.firstName} ${client.lastName}`.trim();
      return {
        ...event,
        clientName: fullName,
      };
    }
    return event;
  });

  // Format for calendar config if needed
  const formattedEvents = updatedEvents.map((event) => ({
    id: event.id,
    text: `Client: ${event.clientName} (Driver: ${event.assignedDriverName})`,
    start: new DayPilot.Date(deliveryDate.toJSDate(event.deliveryDate)),
    end: new DayPilot.Date(deliveryDate.toJSDate(event.deliveryDate)),
    backColor: "var(--color-primary)",
  }));

  return { updatedEvents, formattedEvents };
}
