// Lazy-loaded services to reduce initial bundle size

// Create a service loader utility
export class ServiceLoader {
  private static loadedServices = new Map<string, any>();

  static async loadService<T>(serviceName: string, loader: () => Promise<T>): Promise<T> {
    if (this.loadedServices.has(serviceName)) {
      return this.loadedServices.get(serviceName);
    }

    const service = await loader();
    this.loadedServices.set(serviceName, service);
    return service;
  }

  static async getAuthUserService() {
    return this.loadService("AuthUserService", () => import("./AuthUserService"));
  }

  static async getDeliveryService() {
    return this.loadService("DeliveryService", () => import("./delivery-service"));
  }

  static async getClientService() {
    return this.loadService("ClientService", () => import("./client-service"));
  }

  static async getClusterService() {
    return this.loadService("ClusterService", () => import("./cluster-service"));
  }

  static async getDriverService() {
    return this.loadService("DriverService", () => import("./driver-service"));
  }

  static async getFirebaseService() {
    return this.loadService("FirebaseService", () => import("./firebase-service"));
  }
}
