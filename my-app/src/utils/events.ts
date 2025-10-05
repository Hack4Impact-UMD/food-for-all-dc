const DELIVERIES_MODIFIED_EVENT = 'deliveriesModified';

export const dispatchDeliveriesModified = (): void => {
  window.dispatchEvent(new CustomEvent(DELIVERIES_MODIFIED_EVENT));
};

export const addDeliveriesModifiedListener = (callback: () => void): (() => void) => {
  const handler = () => callback();
  window.addEventListener(DELIVERIES_MODIFIED_EVENT, handler);
  return () => window.removeEventListener(DELIVERIES_MODIFIED_EVENT, handler);
};
