export interface MapDeliverySelectionState {
  selectedDeliveryIds: Set<string>;
  visiblePopupDeliveryIds: Set<string>;
}

export type MapDeliverySelectionAction =
  | { type: "toggle-table-delivery"; deliveryId: string; popupAvailable: boolean }
  | { type: "open-marker-delivery"; deliveryId: string }
  | { type: "toggle-popup"; deliveryId: string; popupAvailable: boolean }
  | { type: "close-popup"; deliveryId: string }
  | { type: "show-all-popups"; popupAvailableDeliveryIds: Set<string> }
  | { type: "hide-all-popups" }
  | { type: "retain-deliveries"; deliveryIds: Set<string>; popupAvailableDeliveryIds: Set<string> }
  | { type: "clear" };

export const EMPTY_MAP_DELIVERY_SELECTION: MapDeliverySelectionState = {
  selectedDeliveryIds: new Set(),
  visiblePopupDeliveryIds: new Set(),
};

const setsEqual = (left: Set<string>, right: Set<string>): boolean => {
  if (left.size !== right.size) return false;
  return Array.from(left).every((value) => right.has(value));
};

const preserveStateWhenUnchanged = (
  current: MapDeliverySelectionState,
  selectedDeliveryIds: Set<string>,
  visiblePopupDeliveryIds: Set<string>
): MapDeliverySelectionState => {
  if (
    setsEqual(current.selectedDeliveryIds, selectedDeliveryIds) &&
    setsEqual(current.visiblePopupDeliveryIds, visiblePopupDeliveryIds)
  ) {
    return current;
  }

  return { selectedDeliveryIds, visiblePopupDeliveryIds };
};

export const mapDeliverySelectionReducer = (
  state: MapDeliverySelectionState,
  action: MapDeliverySelectionAction
): MapDeliverySelectionState => {
  switch (action.type) {
    case "toggle-table-delivery": {
      const selectedDeliveryIds = new Set(state.selectedDeliveryIds);
      const visiblePopupDeliveryIds = new Set(state.visiblePopupDeliveryIds);

      if (selectedDeliveryIds.has(action.deliveryId)) {
        selectedDeliveryIds.delete(action.deliveryId);
        visiblePopupDeliveryIds.delete(action.deliveryId);
      } else {
        selectedDeliveryIds.add(action.deliveryId);
        if (action.popupAvailable) {
          visiblePopupDeliveryIds.add(action.deliveryId);
        }
      }

      return { selectedDeliveryIds, visiblePopupDeliveryIds };
    }

    case "open-marker-delivery":
      return {
        selectedDeliveryIds: new Set([...state.selectedDeliveryIds, action.deliveryId]),
        visiblePopupDeliveryIds: new Set([...state.visiblePopupDeliveryIds, action.deliveryId]),
      };

    case "toggle-popup": {
      if (!action.popupAvailable || !state.selectedDeliveryIds.has(action.deliveryId)) {
        return state;
      }

      const visiblePopupDeliveryIds = new Set(state.visiblePopupDeliveryIds);
      if (visiblePopupDeliveryIds.has(action.deliveryId)) {
        visiblePopupDeliveryIds.delete(action.deliveryId);
      } else {
        visiblePopupDeliveryIds.add(action.deliveryId);
      }

      return { ...state, visiblePopupDeliveryIds };
    }

    case "close-popup": {
      const selectedDeliveryIds = new Set(state.selectedDeliveryIds);
      const visiblePopupDeliveryIds = new Set(state.visiblePopupDeliveryIds);
      selectedDeliveryIds.delete(action.deliveryId);
      visiblePopupDeliveryIds.delete(action.deliveryId);
      return preserveStateWhenUnchanged(state, selectedDeliveryIds, visiblePopupDeliveryIds);
    }

    case "show-all-popups": {
      const visiblePopupDeliveryIds = new Set(
        Array.from(state.selectedDeliveryIds).filter((deliveryId) =>
          action.popupAvailableDeliveryIds.has(deliveryId)
        )
      );
      return preserveStateWhenUnchanged(state, state.selectedDeliveryIds, visiblePopupDeliveryIds);
    }

    case "hide-all-popups":
      return preserveStateWhenUnchanged(state, state.selectedDeliveryIds, new Set());

    case "retain-deliveries": {
      const selectedDeliveryIds = new Set(
        Array.from(state.selectedDeliveryIds).filter((deliveryId) =>
          action.deliveryIds.has(deliveryId)
        )
      );
      const visiblePopupDeliveryIds = new Set(
        Array.from(state.visiblePopupDeliveryIds).filter(
          (deliveryId) =>
            selectedDeliveryIds.has(deliveryId) && action.popupAvailableDeliveryIds.has(deliveryId)
        )
      );
      return preserveStateWhenUnchanged(state, selectedDeliveryIds, visiblePopupDeliveryIds);
    }

    case "clear":
      return preserveStateWhenUnchanged(state, new Set(), new Set());
  }
};
