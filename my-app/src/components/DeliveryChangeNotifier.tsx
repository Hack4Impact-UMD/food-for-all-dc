import { useEffect } from "react";
import { useNotifications } from "./NotificationProvider";
import { deliveryEventEmitter } from "../utils/deliveryEventEmitter";
import {
  formatDeliveryDateLabel,
  recordClearedRouteDates,
} from "../utils/deliveryRouteClearNotice";

const DeliveryChangeNotifier = () => {
  const { showWarning, showError } = useNotifications();

  useEffect(() => {
    const unsubscribe = deliveryEventEmitter.subscribe((event) => {
      if (event.clearedClusterDateKeys.length > 0) {
        recordClearedRouteDates(event.clearedClusterDateKeys);

        if (event.clearedClusterDateKeys.length === 1) {
          showWarning(
            `Saved route assignments were cleared for ${formatDeliveryDateLabel(
              event.clearedClusterDateKeys[0]
            )} because deliveries changed.`,
            5000
          );
        } else {
          showWarning(
            `Saved route assignments were cleared for ${event.clearedClusterDateKeys.length} delivery dates because deliveries changed.`,
            5000
          );
        }
      }

      if (event.failedClusterDateKeys.length > 0) {
        showError(
          `Delivery changes were saved, but saved route assignments could not be cleared for ${event.failedClusterDateKeys.length} delivery date${
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
