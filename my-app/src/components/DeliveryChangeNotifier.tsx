import { useEffect } from "react";
import { useNotifications } from "./NotificationProvider";
import { deliveryEventEmitter } from "../utils/deliveryEventEmitter";
import { format } from "date-fns";
import { deliveryDate } from "../utils/deliveryDate";

const DeliveryChangeNotifier = () => {
  const { showWarning, showError } = useNotifications();

  useEffect(() => {
    const unsubscribe = deliveryEventEmitter.subscribe((event) => {
      if (event.reviewRequiredDateKeys.length > 0) {
        if (event.reviewRequiredDateKeys.length === 1) {
          const dateLabel = format(
            deliveryDate.toJSDate(event.reviewRequiredDateKeys[0]),
            "MMMM d, yyyy"
          );
          showWarning(
            `Schedule changed for ${dateLabel}. Existing routes were preserved; review unassigned deliveries.`,
            5000
          );
        } else {
          showWarning(
            `Schedule changed for ${event.reviewRequiredDateKeys.length} delivery dates. Existing routes were preserved; review unassigned deliveries.`,
            5000
          );
        }
      }

      if (event.failedClusterDateKeys.length > 0) {
        showError(
          `Delivery changes were saved, but route assignments could not be reconciled for ${event.failedClusterDateKeys.length} delivery date${
            event.failedClusterDateKeys.length === 1 ? "" : "s"
          }.`,
          6000
        );
      }
    });

    return unsubscribe;
  }, [showError, showWarning]);

  return null;
};

export default DeliveryChangeNotifier;
