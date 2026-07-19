import type { Timestamp } from "firebase/firestore";
import type { DateTime } from "luxon";
import type { ClientDeliverySummary } from "../../../utils/lastDeliveryDate";
import { computeClientActiveStatus } from "../../../utils/clientStatus";

type RouteClientStatusSource = {
  id: string;
  startDate?: string | Date | DateTime | Timestamp | null;
  endDate?: string | Date | DateTime | Timestamp | null;
  autoInactiveReason?: unknown;
  missedStrikeCount?: unknown;
};

export const enrichRouteClientStatuses = <T extends RouteClientStatusSource>(
  clients: T[],
  summaries: Map<string, ClientDeliverySummary>
): Array<T & { activeStatus: boolean; missedStrikeCount: number }> =>
  clients.map((client) => ({
    ...client,
    activeStatus: computeClientActiveStatus(
      client.startDate,
      client.endDate,
      typeof client.autoInactiveReason === "string" ? client.autoInactiveReason : null
    ),
    missedStrikeCount:
      summaries.get(client.id)?.missedStrikeCount ??
      (typeof client.missedStrikeCount === "number" ? client.missedStrikeCount : 0),
  }));
