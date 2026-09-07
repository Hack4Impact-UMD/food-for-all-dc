import { clientService } from "./client-service";
import DeliveryService from "./delivery-service";
import DriverService from "./driver-service";
export { clientService, DeliveryService, DriverService };

// TEFAP services are intentionally not re-exported here. This barrel is pulled
// into the main bundle by the Calendar components, and these singletons
// instantiate on import and drag in firebase/storage with them. Import them
// directly from their modules instead.

export * from "./AuthUserService";
