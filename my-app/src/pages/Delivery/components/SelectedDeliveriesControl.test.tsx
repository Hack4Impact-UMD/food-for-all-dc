import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, jest } from "@jest/globals";
import SelectedDeliveriesControl from "./SelectedDeliveriesControl";

describe("SelectedDeliveriesControl", () => {
  it("shows selected deliveries and exposes independent popup controls", () => {
    const onTogglePopup = jest.fn();
    const onRemoveSelected = jest.fn();
    const onShowAll = jest.fn();
    const onHideAll = jest.fn();
    const onClearSelected = jest.fn();

    render(
      <SelectedDeliveriesControl
        deliveries={[
          {
            id: "delivery-a",
            label: "Alex Adams",
            popupVisible: true,
            clusterColor: "#ff0000",
          },
          { id: "delivery-b", label: "Blair Brown", popupVisible: false },
        ]}
        onTogglePopup={onTogglePopup}
        onRemoveSelected={onRemoveSelected}
        onShowAll={onShowAll}
        onHideAll={onHideAll}
        onClearSelected={onClearSelected}
      />
    );

    expect(screen.getByText("Selected: 2")).toBeTruthy();
    const coloredRow = screen.getByTestId("selected-delivery-delivery-a");
    const coloredRowStyle = getComputedStyle(coloredRow);
    expect(coloredRowStyle.borderLeft).toBe("6px solid #ff0000");
    expect(coloredRowStyle.backgroundColor).toBe("rgba(255, 0, 0, 0.122)");
    fireEvent.click(screen.getByRole("button", { name: "Hide popup for Alex Adams" }));
    fireEvent.click(screen.getByRole("button", { name: "Show popup for Blair Brown" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Alex Adams from selection" }));
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear selected" }));

    expect(onTogglePopup).toHaveBeenNthCalledWith(1, "delivery-a");
    expect(onTogglePopup).toHaveBeenNthCalledWith(2, "delivery-b");
    expect(onRemoveSelected).toHaveBeenCalledWith("delivery-a");
    expect(onShowAll).toHaveBeenCalledTimes(1);
    expect(onHideAll).not.toHaveBeenCalled();
    expect(onClearSelected).toHaveBeenCalledTimes(1);
  });

  it("changes the bulk eye to hide all when every popup is visible", () => {
    const onShowAll = jest.fn();
    const onHideAll = jest.fn();

    render(
      <SelectedDeliveriesControl
        deliveries={[
          { id: "delivery-a", label: "Alex Adams", popupVisible: true },
          { id: "delivery-b", label: "Blair Brown", popupVisible: true },
        ]}
        onTogglePopup={jest.fn()}
        onRemoveSelected={jest.fn()}
        onShowAll={onShowAll}
        onHideAll={onHideAll}
        onClearSelected={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide all" }));

    expect(onHideAll).toHaveBeenCalledTimes(1);
    expect(onShowAll).not.toHaveBeenCalled();
  });

  it("expands and collapses the vertical delivery drawer", () => {
    render(
      <SelectedDeliveriesControl
        deliveries={[{ id: "delivery-a", label: "Alex Adams", popupVisible: true }]}
        onTogglePopup={jest.fn()}
        onRemoveSelected={jest.fn()}
        onShowAll={jest.fn()}
        onHideAll={jest.fn()}
        onClearSelected={jest.fn()}
      />
    );

    expect(screen.getByText("Alex Adams")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Collapse selected deliveries" }));
    const expandButton = screen.getByRole("button", { name: "Expand selected deliveries" });
    expect(expandButton.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(expandButton);
    expect(
      screen
        .getByRole("button", { name: "Collapse selected deliveries" })
        .getAttribute("aria-expanded")
    ).toBe("true");
    expect(screen.getByText("Alex Adams")).toBeTruthy();
  });

  it("stays out of the map when no deliveries are selected", () => {
    const { container } = render(
      <SelectedDeliveriesControl
        deliveries={[]}
        onTogglePopup={jest.fn()}
        onRemoveSelected={jest.fn()}
        onShowAll={jest.fn()}
        onHideAll={jest.fn()}
        onClearSelected={jest.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});