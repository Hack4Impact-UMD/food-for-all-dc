import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import TefapPdfForm from "../../../pages/Profile/components/TefapPdfForm";
import type { TefapFormField, TefapPdfInspection } from "../../../types/tefap-types";

const mockAnnotations = [
  { id: "yes1", fieldName: "assistance", buttonValue: "0", rect: [410, 317, 421, 324] },
  { id: "yes2", fieldName: "assistance", buttonValue: "1", rect: [410, 296, 421, 303] },
  { id: "no1", fieldName: "undefined", buttonValue: "No", rect: [442, 317, 453, 324] },
  { id: "no2", fieldName: "undefined", buttonValue: "No_2", rect: [442, 296, 453, 303] },
];
const mockPdfChange = jest.fn();
const mockStorage = { setValue: jest.fn() };

jest.mock("react-pdf/dist/Page/AnnotationLayer.css", () => ({}), { virtual: true });

jest.mock("react-pdf", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require("react");
  return {
    pdfjs: { version: "test", GlobalWorkerOptions: {} },
    Document: ({ children, onLoadSuccess }: any) => {
      React.useEffect(() => {
        void onLoadSuccess({
          numPages: 1,
          annotationStorage: mockStorage,
          getPage: async () => ({ getAnnotations: async () => mockAnnotations }),
        });
      }, [onLoadSuccess]);
      return <div>{children}</div>;
    },
    Page: () => (
      <div>
        {mockAnnotations.map((annotation) => (
          <section key={annotation.id}>
            <input
              data-testid={annotation.id}
              data-element-id={annotation.id}
              type="radio"
              name={annotation.fieldName}
              ref={(element) => element?.addEventListener("change", mockPdfChange)}
            />
          </section>
        ))}
      </div>
    ),
  };
});

const inspection: TefapPdfInspection = {
  pageCount: 1,
  pageSizes: [{ page: 1, width: 612, height: 792 }],
  diagnostics: [],
  acroFields: [
    {
      name: "assistance",
      type: "radio",
      options: ["Yes", "Yes_2"],
      widgets: [
        { page: 1, x: 410, y: 317, width: 11, height: 7 },
        { page: 1, x: 410, y: 296, width: 11, height: 7 },
      ],
    },
  ],
};
const question = (key: string, bottom: number): TefapFormField => ({
  key,
  label: key,
  type: "radio",
  required: true,
  order: 0,
  prefill: { source: "none" },
  placement: { kind: "acroform", pdfFieldName: "assistance" },
  options: ["Yes", "No"],
  radioOptions: [410, 442].map((left, index) => ({
    value: index === 0 ? "Yes" : "No",
    placement: {
      kind: "overlay",
      page: 1,
      x: left,
      y: bottom,
      width: 11,
      height: 7,
      fontSize: 7,
      align: "center",
    },
  })),
});

const originalResizeObserver = global.ResizeObserver;
const originalCss = global.CSS;
beforeAll(() => {
  global.ResizeObserver = class {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  } as unknown as typeof ResizeObserver;
  global.CSS = { ...originalCss, escape: (value: string) => value };
});
afterAll(() => {
  global.ResizeObserver = originalResizeObserver;
  global.CSS = originalCss;
});

describe("TefapPdfForm", () => {
  it("recognizes native export options and seeds the selected widget", async () => {
    const mapped: TefapFormField = {
      ...question("assistance", 317),
      radioOptions: undefined,
      options: ["Yes", "Yes_2"],
    };
    render(
      <TefapPdfForm
        bytes={new Uint8Array([1])}
        inspection={inspection}
        fields={[mapped]}
        values={new Map([["assistance", "Yes_2"]])}
        onChange={jest.fn()}
      />
    );

    await waitFor(() => expect(screen.getByTestId<HTMLInputElement>("yes2").checked).toBe(true));
    expect(screen.getByTestId<HTMLInputElement>("yes1").checked).toBe(false);
    expect(screen.queryByText(/Some mapped fields/)).toBeNull();
  });

  it("keeps repaired questions independent and syncs externally changed values", async () => {
    mockPdfChange.mockClear();
    const fields = [question("TANF", 317), question("SNAP", 296)];
    const Harness = () => {
      const [values, setValues] = useState(new Map<string, string | boolean>());
      return (
        <>
          <button
            onClick={() =>
              setValues(
                new Map([
                  ["TANF", "Yes"],
                  ["SNAP", "Yes"],
                ])
              )
            }
          >
            Restore
          </button>
          <TefapPdfForm
            bytes={new Uint8Array([1])}
            inspection={inspection}
            fields={fields}
            values={values}
            onChange={(key, value) => setValues((current) => new Map(current).set(key, value))}
          />
          <output>{JSON.stringify(Array.from(values))}</output>
        </>
      );
    };
    render(<Harness />);
    await waitFor(() =>
      expect(screen.getByTestId<HTMLInputElement>("yes1").name).toBe("tefap-TANF")
    );

    fireEvent.click(screen.getByTestId("yes1"));
    fireEvent.click(screen.getByTestId("yes2"));
    expect(screen.getByTestId<HTMLInputElement>("yes1").checked).toBe(true);
    expect(screen.getByTestId<HTMLInputElement>("yes2").checked).toBe(true);
    expect(screen.getByRole("status").textContent).toBe('[["TANF","Yes"],["SNAP","Yes"]]');

    fireEvent.click(screen.getByTestId("no1"));
    expect(screen.getByTestId<HTMLInputElement>("yes1").checked).toBe(false);
    expect(screen.getByTestId<HTMLInputElement>("no1").checked).toBe(true);
    expect(screen.getByTestId<HTMLInputElement>("yes2").checked).toBe(true);
    expect(screen.getByRole("status").textContent).toBe('[["TANF","No"],["SNAP","Yes"]]');
    expect(mockPdfChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Restore"));
    expect(screen.getByTestId<HTMLInputElement>("yes1").checked).toBe(true);
    expect(screen.getByTestId<HTMLInputElement>("no1").checked).toBe(false);
    expect(screen.getByTestId<HTMLInputElement>("yes2").checked).toBe(true);
    expect(mockStorage.setValue).toHaveBeenCalledWith("yes2", { value: true });
  });
});
