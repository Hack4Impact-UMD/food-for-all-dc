import DeliveryService from "../services/delivery-service";

export const deleteDeliveriesAfterEndDate = async (
  clientId: string,
  newEndDate: string
): Promise<void> => {
  if (!clientId || !newEndDate) {
    console.error("Invalid parameters for deleteDeliveriesAfterEndDate");
    return;
  }

  await DeliveryService.getInstance().enforceClientEndDate(clientId, newEndDate);
};
