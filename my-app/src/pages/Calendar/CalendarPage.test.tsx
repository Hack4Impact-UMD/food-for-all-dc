import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { DayPilot } from "@daypilot/daypilot-lite-react";
import { MemoryRouter } from "react-router-dom";
import CalendarPage from "./CalendarPage";
import { DeliveryEvent } from "../../types/calendar-types";

const mockGetEventsByDateRange = jest.fn();
const mockGetDailyLimits = jest.fn();
const mockScheduleClientDeliveries = jest.fn();
const mockGetAllDrivers = jest.fn();
const mockGetClientsByIds = jest.fn();
const mockGetClientDeliverySummaries = jest.fn();
const mockGetAllClients = jest.fn();
const mockGetClientById = jest.fn();
const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: { uid: string }) => void) => {
    callback({ uid: "staff-user" });
    return () => undefined;
  },
}));

jest.mock("../../auth/firebaseConfig", () => ({
  auth: {},
  db: {},
}));

jest.mock("../../components/NotificationProvider", () => ({
  useNotifications: () => ({
    showSuccess: (...args: Parameters<typeof mockShowSuccess>) => mockShowSuccess(...args),
    showError: (...args: Parameters<typeof mockShowError>) => mockShowError(...args),
  }),
}));

jest.mock("../../context/RecurringDeliveryContext", () => ({
  RecurringDeliveryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("./components/useLimits", () => ({
  useLimits: () => [5, 5, 5, 5, 5, 5, 5],
}));

jest.mock("../../utils/deliveryEventEmitter", () => ({
  deliveryEventEmitter: {
    subscribe: () => () => undefined,
  },
}));

jest.mock("../../services/delivery-service", () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      getEventsByDateRange: (...args: Parameters<typeof mockGetEventsByDateRange>) =>
        mockGetEventsByDateRange(...args),
      getDailyLimits: (...args: Parameters<typeof mockGetDailyLimits>) =>
        mockGetDailyLimits(...args),
      scheduleClientDeliveries: (...args: Parameters<typeof mockScheduleClientDeliveries>) =>
        mockScheduleClientDeliveries(...args),
    }),
  },
}));

jest.mock("../../services/driver-service", () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      getAllDrivers: (...args: Parameters<typeof mockGetAllDrivers>) => mockGetAllDrivers(...args),
    }),
  },
}));

jest.mock("../../services/client-service", () => ({
  clientService: {
    getClientsByIds: (...args: Parameters<typeof mockGetClientsByIds>) =>
      mockGetClientsByIds(...args),
    getClientDeliverySummaries: (...args: Parameters<typeof mockGetClientDeliverySummaries>) =>
      mockGetClientDeliverySummaries(...args),
    getAllClients: (...args: Parameters<typeof mockGetAllClients>) => mockGetAllClients(...args),
    getClientById: (...args: Parameters<typeof mockGetClientById>) => mockGetClientById(...args),
  },
}));

jest.mock("./components/CalendarHeader", () => ({
  __esModule: true,
  default: ({
    currentDate,
    viewType,
    onViewTypeChange,
    onNavigatePrev,
    onNavigateNext,
  }: {
    currentDate: { toString: (format: string) => string };
    viewType: "Day" | "Month";
    onViewTypeChange: (viewType: "Day" | "Month") => void;
    onNavigatePrev: () => void;
    onNavigateNext: () => void;
  }) => (
    <div>
      <div data-testid="current-date">{currentDate.toString("yyyy-MM-dd")}</div>
      <div data-testid="view-type">{viewType}</div>
      <button
        type="button"
        onClick={() => onViewTypeChange(viewType === "Day" ? "Month" : "Day")}
      >
        toggle-view
      </button>
      <button type="button" onClick={onNavigatePrev}>
        prev-day
      </button>
      <button type="button" onClick={onNavigateNext}>
        next-day
      </button>
    </div>
  ),
}));

jest.mock("./components/MonthView", () => ({
  __esModule: true,
  default: ({
    onTimeRangeSelected,
  }: {
    onTimeRangeSelected: (args: { start: unknown }) => void;
  }) => {
    const { DayPilot: MockDayPilot } = require("@daypilot/daypilot-lite-react");

    return (
      <button
        type="button"
        onClick={() => onTimeRangeSelected({ start: new MockDayPilot.Date("2026-03-16") })}
      >
        select-month-day
      </button>
    );
  },
}));

jest.mock("./components/DayView", () => ({
  __esModule: true,
  default: ({ events }: { events: Array<{ id: string }> }) => (
    <div>
      <div data-testid="day-count">{events.length}</div>
      <div data-testid="event-ids">{events.map((event) => event.id).join(",")}</div>
    </div>
  ),
}));

jest.mock("./components/AddDeliveryDialog", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("./components/CalendarPopper", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("../../components/skeletons/CalendarSkeleton", () => ({
  __esModule: true,
  default: () => <div>loading calendar</div>,
}));

jest.mock("../../components/skeletons/CalendarHeaderSkeleton", () => ({
  __esModule: true,
  default: () => <div>loading header</div>,
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error?: unknown) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

const buildEvent = (id: string, deliveryDate: string, clientId = `${id}-client`): DeliveryEvent => ({
  id,
  assignedDriverId: "driver-1",
  assignedDriverName: "Driver One",
  clientId,
  clientName: `${id} client`,
  deliveryDate,
  time: "12:00",
  cluster: 1,
  recurrence: "None",
});

const renderCalendarPage = (date = "2026-03-10") =>
  render(
    <MemoryRouter initialEntries={[`/calendar?date=${date}`]}>
      <CalendarPage />
    </MemoryRouter>
  );

describe("CalendarPage stale fetch protection", () => {
  beforeEach(() => {
    mockGetEventsByDateRange.mockReset();
    mockGetDailyLimits.mockReset();
    mockScheduleClientDeliveries.mockReset();
    mockGetAllDrivers.mockReset();
    mockGetClientsByIds.mockReset();
    mockGetClientDeliverySummaries.mockReset();
    mockGetAllClients.mockReset();
    mockGetClientById.mockReset();
    mockShowSuccess.mockReset();
    mockShowError.mockReset();

    mockGetDailyLimits.mockImplementation(async () => []);
    mockGetAllDrivers.mockImplementation(async () => []);
    mockGetClientsByIds.mockImplementation(async () => []);
    mockGetClientDeliverySummaries.mockImplementation(async () => new Map());
    mockGetAllClients.mockImplementation(async () => ({ clients: [] }));
    mockGetClientById.mockImplementation(async () => null);

    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps the selected day count after switching from month view even if older requests finish later", async () => {
    const initialDayRequest = createDeferred<DeliveryEvent[]>();
    const monthRequest = createDeferred<DeliveryEvent[]>();
    const selectedDayRequest = createDeferred<DeliveryEvent[]>();

    mockGetEventsByDateRange
      .mockImplementationOnce(() => initialDayRequest.promise)
      .mockImplementationOnce(() => monthRequest.promise)
      .mockImplementationOnce(() => selectedDayRequest.promise);

    renderCalendarPage();

    await screen.findByTestId("current-date");

    fireEvent.click(screen.getByRole("button", { name: "toggle-view" }));
    await waitFor(() => {
      expect(screen.getByTestId("view-type").textContent).toBe("Month");
      expect(mockGetEventsByDateRange).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole("button", { name: "select-month-day" }));
    await waitFor(() => {
      expect(screen.getByTestId("view-type").textContent).toBe("Day");
      expect(screen.getByTestId("current-date").textContent).toBe("2026-03-16");
      expect(mockGetEventsByDateRange).toHaveBeenCalledTimes(3);
    });

    await act(async () => {
      selectedDayRequest.resolve([buildEvent("selected-day", "2026-03-16")]);
    });

    await waitFor(() => {
      expect(screen.getByTestId("day-count").textContent).toBe("1");
      expect(screen.getByTestId("event-ids").textContent).toBe("selected-day");
    });

    await act(async () => {
      monthRequest.resolve([
        buildEvent("month-a", "2026-03-01"),
        buildEvent("month-b", "2026-03-02"),
      ]);
      initialDayRequest.resolve([buildEvent("initial-day", "2026-03-10")]);
    });

    await waitFor(() => {
      expect(screen.getByTestId("current-date").textContent).toBe("2026-03-16");
      expect(screen.getByTestId("view-type").textContent).toBe("Day");
      expect(screen.getByTestId("day-count").textContent).toBe("1");
      expect(screen.getByTestId("event-ids").textContent).toBe("selected-day");
    });
  });

  it("keeps the latest day count when navigating next and back while requests resolve out of order", async () => {
    const initialDayRequest = createDeferred<DeliveryEvent[]>();
    const nextDayRequest = createDeferred<DeliveryEvent[]>();
    const returnedDayRequest = createDeferred<DeliveryEvent[]>();

    mockGetEventsByDateRange
      .mockImplementationOnce(() => initialDayRequest.promise)
      .mockImplementationOnce(() => nextDayRequest.promise)
      .mockImplementationOnce(() => returnedDayRequest.promise);

    renderCalendarPage("2026-03-16");

    await screen.findByTestId("current-date");

    fireEvent.click(screen.getByRole("button", { name: "next-day" }));
    await waitFor(() => {
      expect(screen.getByTestId("current-date").textContent).toBe("2026-03-17");
      expect(mockGetEventsByDateRange).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole("button", { name: "prev-day" }));
    await waitFor(() => {
      expect(screen.getByTestId("current-date").textContent).toBe("2026-03-16");
      expect(mockGetEventsByDateRange).toHaveBeenCalledTimes(3);
    });

    await act(async () => {
      returnedDayRequest.resolve([buildEvent("returned-day", "2026-03-16")]);
    });

    await waitFor(() => {
      expect(screen.getByTestId("day-count").textContent).toBe("1");
      expect(screen.getByTestId("event-ids").textContent).toBe("returned-day");
    });

    await act(async () => {
      nextDayRequest.resolve([
        buildEvent("next-day-a", "2026-03-17"),
        buildEvent("next-day-b", "2026-03-17"),
      ]);
      initialDayRequest.resolve([buildEvent("initial-day", "2026-03-16")]);
    });

    await waitFor(() => {
      expect(screen.getByTestId("current-date").textContent).toBe("2026-03-16");
      expect(screen.getByTestId("day-count").textContent).toBe("1");
      expect(screen.getByTestId("event-ids").textContent).toBe("returned-day");
    });
  });
});
