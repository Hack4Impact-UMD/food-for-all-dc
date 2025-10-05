type EventCallback = () => void;

class DeliveryEventEmitter {
  private listeners: EventCallback[] = [];

  subscribe(callback: EventCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  emit(): void {
    this.listeners.forEach(callback => callback());
  }
}

export const deliveryEventEmitter = new DeliveryEventEmitter();
