type DeliveryChangeReason =
  | "schedule-created"
  | "schedule-created-batch"
  | "schedule-updated"
  | "schedule-deleted"
  | "schedule-batch-updated"
  | "schedule-batch-deleted";

export interface DeliveryChangeEvent {
  reason: DeliveryChangeReason;
  impactedDateKeys: string[];
  clearedClusterDateKeys: string[];
  failedClusterDateKeys: string[];
}

type EventCallback = (event: DeliveryChangeEvent) => void;

const EVENT_NAME = "deliveriesModified";

class DeliveryEventEmitter {
  subscribe(callback: EventCallback): () => void {
    const eventListener = (event: Event) => {
      const detail = (event as CustomEvent<DeliveryChangeEvent>).detail;
      callback(detail);
    };

    window.addEventListener(EVENT_NAME, eventListener);

    return () => {
      window.removeEventListener(EVENT_NAME, eventListener);
    };
  }

  emit(event: DeliveryChangeEvent): void {
    window.dispatchEvent(
      new CustomEvent<DeliveryChangeEvent>(EVENT_NAME, {
        detail: {
          ...event,
          impactedDateKeys: Array.from(new Set(event.impactedDateKeys)),
          clearedClusterDateKeys: Array.from(new Set(event.clearedClusterDateKeys)),
          failedClusterDateKeys: Array.from(new Set(event.failedClusterDateKeys)),
        },
      })
    );
  }
}

export const deliveryEventEmitter = new DeliveryEventEmitter();
export type { DeliveryChangeReason };
