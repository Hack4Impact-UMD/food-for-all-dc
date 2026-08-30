import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Profile from "./Profile";

const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockRefresh = jest.fn();
const mockUpdateClient = jest.fn();
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
  options?: google.maps.places.AutocompleteOptions;
  place: google.maps.places.PlaceResult = {};
  placeChanged: (() => Promise<void>) | null = null;

  constructor(input: HTMLInputElement, options?: google.maps.places.AutocompleteOptions) {
    this.input = input;
    this.options = options;
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

jest.mock("../../auth/firebaseConfig", () => ({
  auth: { currentUser: { getIdToken: async () => "test-token" } },
  db: {},
}));

jest.mock("../../config/apiKeys", () => ({
  googleMapsApiKey: "test-google-maps-key",
}));

jest.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { uid: "staff-user", email: "staff@example.com" },
    name: "Staff Member",
    loading: false,
    userRole: "Admin",
  }),
}));

jest.mock("../../context/ClientDataContext", () => ({
  useClientData: () => ({
    refresh: (...args: unknown[]) => mockRefresh(...args),
    updateClient: (...args: unknown[]) => mockUpdateClient(...args),
  }),
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
      {renderField("quadrant", "text")}
      {renderField("phone", "text")}
      {renderField("alternativePhone", "text")}
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
      <output data-testid="phone-fields">
        {[clientProfile.phone, clientProfile.alternativePhone].join("|")}
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
    mockUpdateClient.mockReset();

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
    expect(autocompleteInstances[0].options).toEqual(
      expect.objectContaining({
        types: ["address"],
        componentRestrictions: { country: "us" },
        bounds: { north: 39.35, south: 38.3, east: -76.7, west: -77.8 },
        strictBounds: true,
      })
    );

    fireEvent.click(screen.getAllByRole("button", { name: "save" })[0]);
    await waitFor(() => expect(mockSetDoc).toHaveBeenCalled());
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        updatedAt: { _methodName: "serverTimestamp" },
        updatedBy: {
          uid: "staff-user",
          name: "Staff Member",
          email: "staff@example.com",
        },
      }),
      { merge: true }
    );
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
          long_name: "Pennsylvania Avenue Northwest",
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
      "1600 Pennsylvania Avenue NW|Washington|DC|20006|NW|2"
    );
  });

  it("shows the quadrant derived from the address while it is being edited", async () => {
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

    expect(
      ((await screen.findByRole("textbox", { name: "quadrant" })) as HTMLInputElement).value
    ).toBe("NW");

    fireEvent.change(screen.getByRole("textbox", { name: "address" }), {
      target: { name: "address", value: "250 Elm Street SE" },
    });

    expect(
      (screen.getByRole("textbox", { name: "quadrant" }) as HTMLInputElement).value
    ).toBe("SE");
  });

  it("keeps the stored quadrant when the edited address has no quadrant token", async () => {
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

    fireEvent.change(await screen.findByRole("textbox", { name: "address" }), {
      target: { name: "address", value: "250 Elm Street" },
    });

    expect(
      (screen.getByRole("textbox", { name: "quadrant" }) as HTMLInputElement).value
    ).toBe("NW");
  });

  it("formats profile phone numbers when saving while accepting allowed input formats", async () => {
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
    fireEvent.change(await screen.findByRole("textbox", { name: "phone" }), {
      target: { name: "phone", value: "202.555.0101" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "alternativePhone" }), {
      target: { name: "alternativePhone", value: "+1 202-555-0102" },
    });

    fireEvent.click(screen.getAllByRole("button", { name: "save" })[0]);

    await waitFor(() => {
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          phone: "(202) 555-0101",
          alternativePhone: "(202) 555-0102",
        }),
        { merge: true }
      );
    });
  });

  it("removes invisible pasted characters from phone fields before display and save", async () => {
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
    fireEvent.change(await screen.findByRole("textbox", { name: "phone" }), {
      target: { name: "phone", value: "202\u200B.555\u200E.0101\u2060" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "alternativePhone" }), {
      target: { name: "alternativePhone", value: "+1\u00A0202-555-0102\uFEFF" },
    });

    expect((screen.getByRole("textbox", { name: "phone" }) as HTMLInputElement).value).toBe(
      "202.555.0101"
    );
    expect(
      (screen.getByRole("textbox", { name: "alternativePhone" }) as HTMLInputElement).value
    ).toBe("+1 202-555-0102");

    fireEvent.click(screen.getAllByRole("button", { name: "save" })[0]);

    await waitFor(() => {
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          phone: "(202) 555-0101",
          alternativePhone: "(202) 555-0102",
        }),
        { merge: true }
      );
    });
  });

  it("keeps visible invalid characters and blocks the save", async () => {
    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => undefined);

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
    fireEvent.change(await screen.findByRole("textbox", { name: "alternativePhone" }), {
      target: { name: "alternativePhone", value: "call 202/555/0102" },
    });

    expect(
      (screen.getByRole("textbox", { name: "alternativePhone" }) as HTMLInputElement).value
    ).toBe("call 202/555/0102");
    fireEvent.click(screen.getAllByRole("button", { name: "save" })[0]);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("invalid format"));
    });
    expect(mockSetDoc).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it("clears an existing invisible-only alternative phone on save", async () => {
    mockGetDoc.mockImplementation(async (reference: unknown) => {
      const referenceArgs = (reference as { args: unknown[] }).args;
      const documentId = referenceArgs[referenceArgs.length - 1];
      if (documentId === "client-1") {
        return {
          exists: () => true,
          data: () => ({ ...savedProfile, alternativePhone: "\u200B\u2060" }),
        };
      }
      return { exists: () => true, data: () => ({ tags: [] }) };
    });

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
    fireEvent.click(screen.getAllByRole("button", { name: "save" })[0]);

    await waitFor(() => {
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ alternativePhone: "" }),
        { merge: true }
      );
    });
  });

  it("synchronizes a conflicting stored quadrant from the street before saving", async () => {
    mockGetDoc.mockImplementation(async (reference: unknown) => {
      const referenceArgs = (reference as { args: unknown[] }).args;
      const documentId = referenceArgs[referenceArgs.length - 1];
      if (documentId === "client-1") {
        return {
          exists: () => true,
          data: () => ({ ...savedProfile, quadrant: "SW" }),
        };
      }
      return { exists: () => true, data: () => ({ tags: [] }) };
    });

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
    fireEvent.click(screen.getAllByRole("button", { name: "save" })[0]);

    await waitFor(() => {
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ quadrant: "NW" }),
        { merge: true }
      );
    });
  });

  it("rejects unsupported international phone prefixes before saving", async () => {
    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => undefined);

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
    fireEvent.change(await screen.findByRole("textbox", { name: "phone" }), {
      target: { name: "phone", value: "+91 202-555-0101" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "save" })[0]);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("invalid format"));
    });
    expect(mockSetDoc).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it("does not erase location data when geocoding fails during save", async () => {
    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => undefined);
    jest.mocked(global.fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("profile-fields.json")) {
        return { ok: true, json: async () => ({ miscellaneousFields: [] }) } as Response;
      }
      if (url.includes("geocode-addresses-endpoint")) {
        return { ok: true, json: async () => ({ coordinates: [[0, -77.02]] }) } as Response;
      }
      return { ok: true, json: async () => ({ features: [] }) } as Response;
    });

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
    fireEvent.change(await screen.findByRole("textbox", { name: "address" }), {
      target: { name: "address", value: "200 Valid Street" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "save" })[0]);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("profile was not saved"));
    });
    expect(mockSetDoc).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it("standardizes Google Places dropdown direction words to DC quadrant abbreviations", async () => {
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
    await screen.findByRole("textbox", { name: "address" });
    await waitFor(() => expect(autocompleteInstances).toHaveLength(1));

    const container = document.createElement("div");
    container.className = "pac-container";
    const item = document.createElement("div");
    item.className = "pac-item";
    item.textContent = "1600 Pennsylvania Avenue Northwest, Washington, DC";
    container.appendChild(item);

    await act(async () => {
      document.body.appendChild(container);
    });

    await waitFor(() => {
      expect(item.textContent).toBe("1600 Pennsylvania Avenue NW, Washington, DC");
    });

    document.body.removeChild(container);
  });

  it("stores quadrant abbreviation when neighborhood includes non-quadrant text", async () => {
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
    await screen.findByRole("textbox", { name: "address" });
    await waitFor(() => expect(autocompleteInstances).toHaveLength(1));

    autocompleteInstances[0].place = {
      formatted_address: "1738 Massachusetts Avenue Southeast, Washington, DC 20003, USA",
      address_components: [
        { long_name: "1738", short_name: "1738", types: ["street_number"] },
        {
          long_name: "Massachusetts Avenue Southeast",
          short_name: "Massachusetts Ave SE",
          types: ["route"],
        },
        {
          long_name: "Barney Circle Southeast",
          short_name: "Barney Circle Southeast",
          types: ["neighborhood"],
        },
        { long_name: "Washington", short_name: "Washington", types: ["locality"] },
        {
          long_name: "District of Columbia",
          short_name: "DC",
          types: ["administrative_area_level_1"],
        },
        { long_name: "20003", short_name: "20003", types: ["postal_code"] },
      ],
    } as google.maps.places.PlaceResult;

    await act(async () => {
      await autocompleteInstances[0].placeChanged?.();
    });

    expect(screen.getByTestId("address-fields").textContent).toBe(
      "1738 Massachusetts Avenue SE|Washington|DC|20003|SE|2"
    );
  });

  it("normalizes autocomplete quadrants to NW/NE/SW/SE across direction variants", async () => {
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
    await screen.findByRole("textbox", { name: "address" });
    await waitFor(() => expect(autocompleteInstances).toHaveLength(1));

    const cases = [
      {
        streetNumber: "1",
        zip: "20001",
        route: "First Street Northwest",
        neighborhood: "Barney Circle Northwest",
        formattedAddress: "1 First Street Northwest, Washington, DC 20001, USA",
        expectedAddress: "1 First Street NW|Washington|DC|20001|NW|2",
      },
      {
        streetNumber: "2",
        zip: "20002",
        route: "Second Street Northeast",
        neighborhood: "Barney Circle Northeast",
        formattedAddress: "2 Second Street Northeast, Washington, DC 20002, USA",
        expectedAddress: "2 Second Street NE|Washington|DC|20002|NE|2",
      },
      {
        streetNumber: "3",
        zip: "20024",
        route: "Third Street Southwest",
        neighborhood: "Barney Circle Southwest",
        formattedAddress: "3 Third Street Southwest, Washington, DC 20024, USA",
        expectedAddress: "3 Third Street SW|Washington|DC|20024|SW|2",
      },
      {
        streetNumber: "1738",
        zip: "20003",
        route: "Massachusetts Avenue Southeast",
        neighborhood: "Barney Circle Southeast",
        formattedAddress: "1738 Massachusetts Avenue Southeast, Washington, DC 20003, USA",
        expectedAddress: "1738 Massachusetts Avenue SE|Washington|DC|20003|SE|2",
      },
    ];

    for (const entry of cases) {
      autocompleteInstances[0].place = {
        formatted_address: entry.formattedAddress,
        address_components: [
          {
            long_name: entry.streetNumber,
            short_name: entry.streetNumber,
            types: ["street_number"],
          },
          {
            long_name: entry.route,
            short_name: entry.route,
            types: ["route"],
          },
          {
            long_name: entry.neighborhood,
            short_name: entry.neighborhood,
            types: ["neighborhood"],
          },
          { long_name: "Washington", short_name: "Washington", types: ["locality"] },
          {
            long_name: "District of Columbia",
            short_name: "DC",
            types: ["administrative_area_level_1"],
          },
          {
            long_name: entry.zip,
            short_name: entry.zip,
            types: ["postal_code"],
          },
        ],
      } as google.maps.places.PlaceResult;

      await act(async () => {
        await autocompleteInstances[0].placeChanged?.();
      });

      expect(screen.getByTestId("address-fields").textContent).toBe(entry.expectedAddress);
    }
  });
});
