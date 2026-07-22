import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Profile from "./Profile";

const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockRefresh = jest.fn();
const mockClearInstanceListeners = jest.fn();
const autocompleteInstances: MockAutocomplete[] = [];

const savedProfile = {
  uid: "client-1",
  firstName: "Test",
  lastName: "Client",
  address: "100 Main Street NW",
  address2: "",
  city: "Washington",
  state: "DC",
  zipCode: "20001",
  email: "",
  dob: "",
  deliveryFreq: "",
  phone: "202-555-0100",
  alternativePhone: "",
  adults: 1,
  children: 0,
  seniors: 0,
  total: 1,
  headOfHousehold: "Adult",
  gender: "Male",
  ethnicity: "",
  language: "English",
  startDate: "07/01/2026",
  endDate: "12/31/2026",
  recurrence: "None",
  tags: [],
  ward: "Ward 1",
  quadrant: "NW",
  coordinates: [38.9, -77.0],
  tefapCert: false,
  referralEntity: null,
  referredDate: "",
  notes: "",
  lifeChallenges: "",
  lifestyleGoals: "",
  deliveryDetails: {
    deliveryInstructions: "",
    dietaryRestrictions: { foodAllergens: [] },
  },
  physicalAilments: {},
  physicalDisability: {},
  mentalHealthConditions: {},
};

class MockAutocomplete {
  input: HTMLInputElement;
  place: google.maps.places.PlaceResult = {};
  placeChanged: (() => Promise<void>) | null = null;

  constructor(input: HTMLInputElement) {
    this.input = input;
    autocompleteInstances.push(this);
  }

  addListener(eventName: string, callback: () => Promise<void>) {
    if (eventName === "place_changed") {
      this.placeChanged = callback;
    }
    return { remove: jest.fn() };
  }

  getPlace() {
    return this.place;
  }
}

jest.mock("firebase/firestore", () => ({
  addDoc: async () => undefined,
  collection: (...args: unknown[]) => ({ kind: "collection", args }),
  doc: (...args: unknown[]) => ({ kind: "doc", args }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  limit: (...args: unknown[]) => ({ kind: "limit", args }),
  orderBy: (...args: unknown[]) => ({ kind: "orderBy", args }),
  query: (...args: unknown[]) => ({ kind: "query", args }),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: async () => undefined,
  where: (...args: unknown[]) => ({ kind: "where", args }),
  Timestamp: class {
    toDate() {
      return new Date();
    }
  },
}));

jest.mock("../../auth/firebaseConfig", () => ({
  auth: { currentUser: { getIdToken: async () => "test-token" } },
  db: {},
}));

jest.mock("../../config/apiKeys", () => ({
  googleMapsApiKey: "test-google-maps-key",
}));

jest.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "staff-user" }, loading: false, userRole: "Admin" }),
}));

jest.mock("../../context/ClientDataContext", () => ({
  useClientData: () => ({ refresh: (...args: unknown[]) => mockRefresh(...args) }),
}));

jest.mock("../../services/firebase-storage", () => ({
  getProfileFieldsConfigUrl: async () => "https://test.local/profile-fields.json",
}));

jest.mock("../../services/client-service", () => ({
  clientService: { db: {}, clientsCollection: "clients" },
  normalizeBooleanField: (value: unknown) => Boolean(value),
}));

const mockDeliveryService = {
  getClientDeliveryHistory: async () => ({ pastDeliveries: [], futureDeliveries: [] }),
  getLatestScheduledDateForClient: async () => null,
  getRecurringSeriesSummariesForClient: async () => [],
  getEventsByClientId: async () => [],
  getDailyLimits: async () => [],
  enforceClientEndDate: async () => undefined,
  deleteMissedEventsByClientId: async () => undefined,
};

jest.mock("../../services/delivery-service", () => ({
  __esModule: true,
  default: { getInstance: () => mockDeliveryService },
}));

jest.mock("../../utils/deliveryEventEmitter", () => ({
  deliveryEventEmitter: { subscribe: () => () => undefined },
}));

jest.mock("../Calendar/components/useLimits", () => ({ useLimits: () => [] }));
jest.mock("../../components/CaseWorkerManagementModal", () => () => null);
jest.mock("../../components/PopUp", () => () => null);
jest.mock("../../components/ErrorPopUp", () => () => null);
jest.mock("../Calendar/components/AddDeliveryDialog", () => () => null);
jest.mock("./components/DeliveryInfoForm", () => () => null);
jest.mock("./components/DietaryPreferencesForm", () => () => null);
jest.mock("./components/DeliveryLogForm", () => () => null);
jest.mock("./components/HealthConditionsForm", () => () => null);
jest.mock("./components/HealthCheckbox", () => () => null);
jest.mock("./components/MiscellaneousForm", () => () => null);
jest.mock("./components/ProfileHeader", () => () => null);
jest.mock("./Tags/TagManager", () => () => null);

jest.mock("./components/BasicInfoForm", () => ({
  __esModule: true,
  default: ({ clientProfile, renderField, addressInputRef }: any) => (
    <div>
      {renderField("address", "text", addressInputRef)}
      <output data-testid="address-fields">
        {[
          clientProfile.address,
          clientProfile.city,
          clientProfile.state,
          clientProfile.zipCode,
          clientProfile.quadrant,
          clientProfile.ward,
        ].join("|")}
      </output>
    </div>
  ),
}));

jest.mock("./components/FormField", () => ({
  __esModule: true,
  default: ({ fieldPath, value, isEditing, handleChange, addressInputRef }: any) =>
    isEditing ? (
      <input
        aria-label={fieldPath}
        name={fieldPath}
        ref={fieldPath === "address" ? addressInputRef : undefined}
        value={String(value || "")}
        onChange={handleChange}
      />
    ) : (
      <span>{String(value || "")}</span>
    ),
}));

const emptySnapshot = {
  docs: [],
  empty: true,
  forEach: () => undefined,
};

describe("Profile address autocomplete lifecycle", () => {
  beforeEach(() => {
    autocompleteInstances.length = 0;
    mockClearInstanceListeners.mockReset();
    mockGetDoc.mockReset();
    mockGetDocs.mockReset();
    mockSetDoc.mockReset();
    mockRefresh.mockReset();

    mockGetDoc.mockImplementation(async (reference: unknown) => {
      const referenceArgs = (reference as { args: unknown[] }).args;
      const documentId = referenceArgs[referenceArgs.length - 1];
      if (documentId === "client-1") {
        return { exists: () => true, data: () => savedProfile };
      }
      return { exists: () => true, data: () => ({ tags: [] }) };
    });
    mockGetDocs.mockImplementation(async () => emptySnapshot);
    mockSetDoc.mockImplementation(async () => undefined);
    mockRefresh.mockImplementation(async () => undefined);

    window.google = {
      maps: {
        places: { Autocomplete: MockAutocomplete },
        event: { clearInstanceListeners: mockClearInstanceListeners },
      },
    } as any;

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("profile-fields.json")) {
        return { ok: true, json: async () => ({ miscellaneousFields: [] }) } as Response;
      }
      if (url.includes("geocode-addresses-endpoint")) {
        return { ok: true, json: async () => ({ coordinates: [[38.91, -77.02]] }) } as Response;
      }
      return {
        ok: true,
        json: async () => ({ features: [{ attributes: { NAME: "Ward 2", WARD: "2" } }] }),
      } as Response;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("rebinds autocomplete after save and still populates the selected address", async () => {
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

    await screen.findByText("100 Main Street NW");

    fireEvent.click(screen.getAllByTestId("EditIcon")[0].closest("button")!);
    const firstInput = await screen.findByRole("textbox", { name: "address" });
    await waitFor(() => expect(autocompleteInstances).toHaveLength(1));
    expect(autocompleteInstances[0].input).toBe(firstInput);

    fireEvent.click(screen.getAllByRole("button", { name: "save" })[0]);
    await waitFor(() => expect(mockSetDoc).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "address" })).toBeNull());
    expect(mockClearInstanceListeners).toHaveBeenCalledWith(autocompleteInstances[0]);

    fireEvent.click(screen.getAllByTestId("EditIcon")[0].closest("button")!);
    const secondInput = await screen.findByRole("textbox", { name: "address" });
    await waitFor(() => expect(autocompleteInstances).toHaveLength(2));
    expect(autocompleteInstances[1].input).toBe(secondInput);
    expect(secondInput).not.toBe(firstInput);

    autocompleteInstances[1].place = {
      formatted_address: "1600 Pennsylvania Avenue NW, Washington, DC 20006, USA",
      address_components: [
        { long_name: "1600", short_name: "1600", types: ["street_number"] },
        {
          long_name: "Pennsylvania Avenue NW",
          short_name: "Pennsylvania Ave NW",
          types: ["route"],
        },
        { long_name: "Washington", short_name: "Washington", types: ["locality"] },
        {
          long_name: "District of Columbia",
          short_name: "DC",
          types: ["administrative_area_level_1"],
        },
        { long_name: "20006", short_name: "20006", types: ["postal_code"] },
      ],
    } as google.maps.places.PlaceResult;

    await act(async () => {
      await autocompleteInstances[1].placeChanged?.();
    });

    expect(screen.getByTestId("address-fields").textContent).toBe(
      "1600 Pennsylvania Avenue NW|Washington|DC|20006|NW|Ward 2"
    );
  });
});
