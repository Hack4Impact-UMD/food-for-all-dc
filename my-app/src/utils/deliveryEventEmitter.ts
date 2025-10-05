type EventCallback = () => void;

class DeliveryEventEmitter {
  private listeners: EventCallback[] = [];

  subscribe(callback: EventCallback): () => void {
    const wrappedCallback = () => callback();
    const eventListener = () => wrappedCallback();

    this.listeners.push(callback);
    window.addEventListener('deliveriesModified', eventListener);

    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
      window.removeEventListener('deliveriesModified', eventListener);
    };
  }

  emit(): void {
    window.dispatchEvent(new CustomEvent('deliveriesModified', {
      detail: { timestamp: Date.now() }
    }));
  }
}

export const deliveryEventEmitter = new DeliveryEventEmitter();
