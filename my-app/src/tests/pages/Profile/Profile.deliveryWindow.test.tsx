import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Profile from "../../../pages/Profile/Profile";
import { deliveryDate } from "../../../utils/deliveryDate";

const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();

const today = deliveryDate.today();
const lastScheduledDelivery = today.plus({ days: 13 }).toISODate() as string;
const clientEndDate = today.plus({ years: 1 }).toFormat("MM/dd/yyyy");
const clientEndDateISO = today.plus({ years: 1 }).toISODate() as string;

const savedProfile = {
  uid: "client-1",
  firstName: "Belen",
  lastName: "A",
  address: "100 Main Street NW",
  address2: "",
  city: "Washington",
  state: "DC",
  zipCode: "20001",
  email: "",
  dob: "",
  phone: "202-555-0100",
  alternativePhone: "",
  adults: 1,
  children: 0,
  seniors: 0,
  total: 1,
  headOfHousehold: "Adult",
  gender: "Female",
  ethnicity: "Other",
  language: "English",
  startDate: today.minus({ months: 6 }).toFormat("MM/dd/yyyy"),
  endDate: clientEndDate,
  recurrence: "Weekly",
  tags: [],
  ward: "2",
  quadrant: "NW",
  coordinates: [38.9, -77.0],
  tefapCert: false,
  referralEntity: { id: "case-worker-1", name: "CW", organization: "Org" },
  referredDate: "",
  notes: "",
  lifeChallenges: "",
  lifestyleGoals: "",
  deliveryDetails: { deliveryInstructions: "", dietaryRestrictions: { foodAllergens: [] } },
  physicalAilments: {},
  physicalDisability: {},
  mentalHealthConditions: {},
};

jest.mock("firebase/firestore", () => ({
  addDoc: async () => undefined,
  collection: (...args: unknown[]) => ({ kind: "collection", args }),
  doc: (...args: unknown[]) => ({ kind: "doc", args }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  limit: (...args: unknown[]) => ({ kind: "limit", args }),
  orderBy: (...args: unknown[]) => ({ kind: "orderBy", args }),
  query: (...args: unknown[]) => ({ kind: "query", args }),
  serverTimestamp: () => ({ _methodName: "serverTimestamp" }),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: async () => undefined,
  where: (...args: unknown[]) => ({ kind: "where", args }),
  Timestamp: class {
    toDate() {
      return new Date();
    }
  },
}));

jest.mock("../../../auth/firebaseConfig", () => ({
  auth: { currentUser: { getIdToken: async () => "test-token" } },
  db: {},
}));
jest.mock("../../../config/apiKeys", () => ({ googleMapsApiKey: "test-google-maps-key" }));
jest.mock("../../../auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { uid: "staff-user", email: "staff@example.com" },
    name: "Staff Member",
    loading: false,
    userRole: "Admin",
  }),
}));
jest.mock("../../../context/ClientDataContext", () => ({
  useClientData: () => ({ refresh: async () => undefined, updateClient: async () => undefined }),
}));
jest.mock("../../../services/firebase-storage", () => ({
  getProfileFieldsConfigUrl: async () => "https://test.local/profile-fields.json",
}));
jest.mock("../../../services/client-service", () => ({
  clientService: { db: {}, clientsCollection: "clients" },
  normalizeBooleanField: (value: unknown) => Boolean(value),
}));

const recurringSeries = {
  key: "series-1",
  clientId: "client-1",
  recurrence: "Weekly",
  recurrenceId: "series-1",
  eventIds: ["event-1"],
  earliestDate: today.minus({ months: 1 }).toISODate() as string,
  latestDate: lastScheduledDelivery,
  effectiveEndDate: lastScheduledDelivery,
  supportsFutureOperations: true,
  unresolvedLegacy: false,
};

const futureDelivery = {
  id: "event-1",
  clientId: "client-1",
  clientName: "Belen A",
  deliveryDate: lastScheduledDelivery,
  recurrence: "Weekly",
  recurrenceId: "series-1",
  time: "",
  cluster: 0,
  assignedDriverId: "",
  assignedDriverName: "",
  deliveryStatus: "Scheduled",
};

const deliveryData = {
  futureDeliveries: [] as any[],
  latestScheduledDate: null as string | null,
  recurringSeries: [] as any[],
};

// The service instance is grabbed at module load by CalendarUtils, so the mock delegates to
// deliveryData at call time rather than closing over values defined later in this file.
jest.mock("../../../services/delivery-service", () => {
  const instance = {
    getClientDeliveryHistory: async () => ({
      pastDeliveries: [],
      futureDeliveries: (globalThis as any).__deliveryData.futureDeliveries,
    }),
    getLatestScheduledDateForClient: async () =>
      (globalThis as any).__deliveryData.latestScheduledDate,
    getRecurringSeriesSummariesForClient: async () =>
      (globalThis as any).__deliveryData.recurringSeries,
    getEventsByClientId: async () => (globalThis as any).__deliveryData.futureDeliveries,
    getDailyLimits: async () => [],
    getWeeklyLimits: async () => ({}),
    enforceClientEndDate: async () => undefined,
    deleteMissedEventsByClientId: async () => undefined,
  };
  const DeliveryService = { getInstance: () => instance };
  return { __esModule: true, default: DeliveryService, DeliveryService };
});
jest.mock("../../../utils/deliveryEventEmitter", () => ({
  deliveryEventEmitter: { subscribe: () => () => undefined },
}));
jest.mock("../../../pages/Calendar/components/useLimits", () => ({ useLimits: () => [] }));
jest.mock("../../../components/CaseWorkerManagementModal", () => () => null);
jest.mock("../../../pages/Profile/components/DeliveryLogForm", () => () => null);
jest.mock("../../../pages/Profile/components/ProfileHeader", () => () => null);
jest.mock("../../../pages/Profile/Tags/TagManager", () => () => null);

const emptySnapshot = { docs: [], empty: true, forEach: () => undefined };

const renderProfile = () =>
  render(
    <MemoryRouter
      initialEntries={["/profile/client-1"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/profile/:clientId" element={<Profile />} />
      </Routes>
    </MemoryRouter>
  );

describe("scheduling window offered by the profile's Add Delivery dialog", () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
    mockGetDoc.mockImplementation(async (reference: any) => {
      const args = reference.args;
      const id = args[args.length - 1];
      if (id === "client-1") return { exists: () => true, data: () => savedProfile };
      return { exists: () => true, data: () => ({ tags: [] }) };
    });
    mockGetDocs.mockImplementation(async () => emptySnapshot);
    mockSetDoc.mockImplementation(async () => undefined);
    deliveryData.futureDeliveries = [futureDelivery];
    deliveryData.latestScheduledDate = lastScheduledDelivery;
    deliveryData.recurringSeries = [recurringSeries];
    (globalThis as any).__deliveryData = deliveryData;
    window.google = {
      maps: {
        places: {
          Autocomplete: class {
            addListener() {
              return { remove: () => undefined };
            }
            getPlace() {
              return {};
            }
          },
        },
        event: { clearInstanceListeners: () => undefined },
      },
    } as any;
    global.fetch = jest.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("profile-fields.json"))
        return { ok: true, json: async () => ({ miscellaneousFields: [] }) } as Response;
      if (url.includes("geocode-addresses-endpoint"))
        return { ok: true, json: async () => ({ coordinates: [[38.91, -77.02]] }) } as Response;
      return {
        ok: true,
        json: async () => ({ features: [{ attributes: { NAME: "Ward 2", WARD: "2" } }] }),
      } as Response;
    }) as any;
  });

  it("lets deliveries be scheduled through the client's end date, not the last scheduled delivery", async () => {
    renderProfile();

    await screen.findByText("Delivery Information");
    fireEvent.click(screen.getByRole("button", { name: /add delivery/i }));

    const deliveryDateInput = (await screen.findByTestId("date-input")) as HTMLInputElement;

    await waitFor(() => expect(deliveryDateInput.getAttribute("max")).toBe(clientEndDateISO));
  });

  it("keeps the recurrence end date calendar usable when the delivery date is past the window", async () => {
    renderProfile();

    await screen.findByText("Delivery Information");
    fireEvent.click(screen.getByRole("button", { name: /add delivery/i }));

    const deliveryDateInput = (await screen.findByTestId("date-input")) as HTMLInputElement;
    const pastClientEnd = today.plus({ years: 2 }).toISODate() as string;
    fireEvent.change(deliveryDateInput, { target: { value: pastClientEnd } });

    const repeatsEndInput = screen.getByLabelText(/end date/i) as HTMLInputElement;
    const min = repeatsEndInput.getAttribute("min");
    const max = repeatsEndInput.getAttribute("max");

    // A native date picker whose min is after its max disables every day: the calendar opens but
    // nothing in it can be clicked.
    expect(min && max && min > max).toBe(false);
  });
});
