# Services

Singleton service layer for Firebase operations and business logic.

## Services

- **ClientService** - Client profile CRUD operations
- **DeliveryService** - Delivery event management
- **DriverService** - Driver management
- **ClusterService** - Geographic clustering for routes
- **AuthUserService** - User authentication and management
- **firebase-storage** - File upload/download operations
- **performance-monitor** - Performance tracking utilities

## Pattern

All services follow the singleton pattern:
```typescript
const service = ClientService.getInstance();
```

Always use `formatServiceError()` for error handling and show errors via `NotificationProvider`.

