import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Timestamp } from "firebase/firestore";
import { DateTime } from "luxon";
import { MemoryRouter, useLocation } from "react-router-dom";
import DeliverySpreadsheet from "./DeliverySpreadsheet";
import { deliveryDate } from "../../utils/deliveryDate";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

type MockQuery = {
  collectionName: string;
  constraints: Array<{ field: string; value: unknown }>;
};

const mockGetEventsByViewType = jest.fn();
const mockGetDocs = jest.fn();
const mockGetClientDeliverySummaries = jest.fn();
const mockShowError = jest.fn();
const mockShowInfo = jest.fn();
const mockShowSuccess = jest.fn();
const mockShowWarning = jest.fn();
const mockDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockRunTransaction = jest.fn();

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: { uid: string }) => void) => {
    callback({ uid: "staff-user" });
    return () => undefined;
  },
}));

jest.mock("firebase/firestore", () => {
  class MockTimestamp {
    constructor(private readonly mockValue: Date) {}

    static fromDate(mockValue: Date) {
      return new MockTimestamp(mockValue);
    }

    toDate() {
      return this.mockValue;
    }
  }

  return {
    Timestamp: MockTimestamp,
    collection: (_db: unknown, collectionName: string) => ({ collectionName }),
    where: (field: string, _operator: string, value: unknown) => ({ field, value }),
    orderBy: (field: string) => ({ field, value: undefined }),
    query: (
      collectionRef: { collectionName: string },
      ...constraints: Array<{ field: string; value: unknown }>
    ) => ({
      ...collectionRef,
      constraints,
    }),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    doc: (...args: unknown[]) => mockDoc(...args),
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  };
});

jest.mock("../../auth/firebaseConfig", () => ({
  auth: {
    currentUser: {
      uid: "staff-user",
      getIdToken: async () => "test-token",
    },
  },
  db: {},
}));

jest.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ userRole: "Admin" }),
}));

jest.mock("../Calendar/components/useLimits", () => ({
  useLimits: () => [10, 10, 10, 10, 10, 10, 10],
}));

jest.mock("../Calendar/components/getEventsByViewType", () => ({
  getEventsByViewType: (...args: unknown[]) => mockGetEventsByViewType(...args),
}));

jest.mock("../../services/client-service", () => ({
  clientService: {
    getClientDeliverySummaries: (...args: unknown[]) => mockGetClientDeliverySummaries(...args),
    updateClientCoordinatesBatch: async () => undefined,
  },
}));

jest.mock("../../hooks/useCustomColumns", () => ({
  allowedPropertyKeys: ["none"],
  useCustomColumns: () => ({
    customColumns: [],
    handleAddCustomColumn: () => undefined,
    handleCustomHeaderChange: () => undefined,
    handleRemoveCustomColumn: () => undefined,
  }),
}));

jest.mock("../../hooks/useSearchKeyAutocomplete", () => ({
  useSearchKeyAutocomplete: ({ onValueChange }: { onValueChange: (value: string) => void }) => ({
    inputRef: { current: null },
    handleInputChange: (event: { target: { value: string } }) => onValueChange(event.target.value),
    handleInputFocus: () => undefined,
    handleInputClick: () => undefined,
    handleInputBlur: () => undefined,
    handleInputKeyDown: () => undefined,
    handleInputKeyUp: () => undefined,
  }),
}));

jest.mock("../../hooks/useSavedSearches", () => ({
  useSavedSearches: () => ({
    savedSearches: [],
    saveCurrentSearch: () => undefined,
    applySavedSearch: () => undefined,
    overwriteSavedSearch: () => undefined,
    deleteSavedSearch: () => undefined,
  }),
}));

jest.mock("../../components/NotificationProvider", () => ({
  useNotifications: () => ({
    showError: (...args: unknown[]) => mockShowError(...args),
    showInfo: (...args: unknown[]) => mockShowInfo(...args),
    showSuccess: (...args: unknown[]) => mockShowSuccess(...args),
    showWarning: (...args: unknown[]) => mockShowWarning(...args),
  }),
}));

jest.mock("../../utils/deliveryEventEmitter", () => ({
  deliveryEventEmitter: {
    subscribe: () => () => undefined,
  },
}));

jest.mock("../../components/PageDatePicker/PageDatePicker", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("./components/AssignDriverPopup", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("./components/GenerateClustersPopup", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("./components/RouteSearchSavedFilters", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("./components/RouteExportOptions", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("./RouteExport", () => ({
  exportDeliveries: () => undefined,
  exportDoordashDeliveries: () => undefined,
}));

jest.mock("../../components/DietaryRestrictionsLegend", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("react-virtuoso", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mockReact = require("react") as {
    forwardRef: (typeof import("react"))["forwardRef"];
  };
  const MockTableVirtuoso = mockReact.forwardRef<HTMLDivElement, { data: Array<{ id: string }> }>(
    ({ data }, ref) => (
      <div ref={ref} data-testid="table-rows">
        {data.map((row) => row.id).join(",")}
      </div>
    )
  );
  MockTableVirtuoso.displayName = "MockTableVirtuoso";

  return {
    TableVirtuoso: MockTableVirtuoso,
  };
});

jest.mock("./ClusterMap", () => ({
  __esModule: true,
  default: ({
    allRows,
    clusters,
  }: {
    allRows: Array<{ id: string }>;
    clusters: Array<{ id: string; deliveries: string[] }>;
  }) => (
    <div data-testid="route-state">
      {allRows.map((row) => row.id).join(",")}|
      {clusters.map((cluster) => `${cluster.id}:${cluster.deliveries.join(",")}`).join(";")}
    </div>
  ),
}));

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const buildEvent = (dateKey: string, clientId: string) => ({
  id: `${dateKey}-event`,
  assignedDriverId: "",
  assignedDriverName: "",
  clientId,
  clientName: clientId,
  deliveryDate: new Date(`${dateKey}T12:00:00-04:00`),
  time: "12:00",
  recurrence: "None" as const,
});

const buildClientSnapshot = (clientId: string) => ({
  docs: [
    {
      id: clientId,
      data: () => ({
        clientid: clientId,
        firstName: clientId,
        lastName: "Client",
        address: "123 Test Street",
        phone: "202-555-0100",
        startDate: "2020-01-01",
        coordinates: [38.9, -77.0],
        deliveryDetails: {
          deliveryInstructions: "",
          dietaryRestrictions: {},
        },
      }),
    },
  ],
});

const buildClusterSnapshot = (dateKey: string, clientId: string) => ({
  empty: false,
  docs: [
    {
      id: `${dateKey}-routes`,
      data: () => ({
        date: Timestamp.fromDate(new Date(`${dateKey}T12:00:00Z`)),
        clusters: [{ id: "1", driver: "", time: "", deliveries: [clientId] }],
        clientOverrides: [],
      }),
    },
  ],
});

const getQueryDateKey = (query: MockQuery): string => {
  const dateConstraint = query.constraints.find(
    (constraint) => constraint.field === "date" && constraint.value instanceof Timestamp
  );
  return (dateConstraint?.value as Timestamp).toDate().toISOString().slice(0, 10);
};

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
};

const renderRoutes = () =>
  render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={["/routes?date=2026-07-25"]}
    >
      <LocationProbe />
      <DeliverySpreadsheet />
    </MemoryRouter>
  );

describe("DeliverySpreadsheet date navigation", () => {
  let deliveryRequests: Map<string, Deferred<{ updatedEvents: ReturnType<typeof buildEvent>[] }>>;
  let clusterRequests: Map<string, Deferred<ReturnType<typeof buildClusterSnapshot>>>;
  let tomorrowClientRequest: Deferred<ReturnType<typeof buildClientSnapshot>> | null;

  beforeEach(() => {
    deliveryRequests = new Map([
      ["2026-07-24", createDeferred()],
      ["2026-07-25", createDeferred()],
    ]);
    clusterRequests = new Map([
      ["2026-07-24", createDeferred()],
      ["2026-07-25", createDeferred()],
    ]);
    tomorrowClientRequest = null;

    mockGetEventsByViewType.mockReset();
    mockGetDocs.mockReset();
    mockGetClientDeliverySummaries.mockReset();
    mockGetClientDeliverySummaries.mockImplementation(async () => new Map());

    mockGetEventsByViewType.mockImplementation((...args: unknown[]) => {
      const [{ currentDate }] = args as [{ currentDate: { toString: (format: string) => string } }];
      const dateKey = currentDate.toString("yyyy-MM-dd");
      return deliveryRequests.get(dateKey)?.promise;
    });

    mockGetDocs.mockImplementation((...args: unknown[]) => {
      const [query] = args as [MockQuery];

      if (query.collectionName === "clusters") {
        return clusterRequests.get(getQueryDateKey(query))?.promise;
      }

      const clientIds = query.constraints.find((constraint) => constraint.field === "__name__")
        ?.value as string[];
      const clientId = clientIds[0];

      if (clientId === "tomorrow-client" && tomorrowClientRequest) {
        return tomorrowClientRequest.promise;
      }

      return Promise.resolve(buildClientSnapshot(clientId));
    });

    jest
      .spyOn(deliveryDate, "today")
      .mockReturnValue(DateTime.fromISO("2026-07-24T12:00:00", { zone: deliveryDate.zone }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps today's deliveries and clusters when tomorrow's requests resolve last", async () => {
    renderRoutes();

    await waitFor(() => {
      expect(mockGetEventsByViewType).toHaveBeenCalledTimes(1);
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /today/i }));

    expect(screen.getByTestId("location-search").textContent).toBe("?date=2026-07-24");

    await waitFor(() => {
      expect(mockGetEventsByViewType).toHaveBeenCalledTimes(2);
      expect(mockGetDocs).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      deliveryRequests
        .get("2026-07-24")
        ?.resolve({ updatedEvents: [buildEvent("2026-07-24", "today-client")] });
      clusterRequests
        .get("2026-07-24")
        ?.resolve(buildClusterSnapshot("2026-07-24", "today-client"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("route-state").textContent).toBe("today-client|1:today-client");
    });

    await act(async () => {
      deliveryRequests
        .get("2026-07-25")
        ?.resolve({ updatedEvents: [buildEvent("2026-07-25", "tomorrow-client")] });
      clusterRequests
        .get("2026-07-25")
        ?.resolve(buildClusterSnapshot("2026-07-25", "tomorrow-client"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("route-state").textContent).toBe("today-client|1:today-client");
      expect(screen.queryByText("tomorrow-client")).toBeNull();
    });
  });

  it("ignores client details from the previous date when they resolve after today", async () => {
    tomorrowClientRequest = createDeferred();
    renderRoutes();

    await waitFor(() => {
      expect(mockGetEventsByViewType).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      deliveryRequests
        .get("2026-07-25")
        ?.resolve({ updatedEvents: [buildEvent("2026-07-25", "tomorrow-client")] });
      clusterRequests
        .get("2026-07-25")
        ?.resolve(buildClusterSnapshot("2026-07-25", "tomorrow-client"));
    });

    await waitFor(() => {
      expect(mockGetDocs).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole("button", { name: /today/i }));

    await act(async () => {
      deliveryRequests
        .get("2026-07-24")
        ?.resolve({ updatedEvents: [buildEvent("2026-07-24", "today-client")] });
      clusterRequests
        .get("2026-07-24")
        ?.resolve(buildClusterSnapshot("2026-07-24", "today-client"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("route-state").textContent).toBe("today-client|1:today-client");
    });

    await act(async () => {
      tomorrowClientRequest?.resolve(buildClientSnapshot("tomorrow-client"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("route-state").textContent).toBe("today-client|1:today-client");
      expect(screen.queryByText("tomorrow-client")).toBeNull();
    });
  });
});
