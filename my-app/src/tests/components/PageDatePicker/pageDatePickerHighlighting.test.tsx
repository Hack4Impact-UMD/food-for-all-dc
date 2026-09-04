import "@testing-library/jest-dom";
import { describe, expect, it } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import PageDatePicker from "../../../components/PageDatePicker/PageDatePicker";

/**
 * `pagedatepicker.css` resets `--keyboard-selected` back to a plain day so the
 * preSelection day -- which follows the visible month -- stops looking selected.
 * That reset is only safe because react-datepicker never puts both classes on one
 * day: `Day.isKeyboardSelected()` returns false for the selected date. These tests
 * pin that behavior, so a react-datepicker upgrade that changed it would fail here
 * rather than silently clearing the selected day's green fill.
 */
describe("PageDatePicker day highlighting", () => {
  const SELECTED = new Date(2027, 2, 2); // Tue Mar 2 2027
  const MAR_2 = "Choose Tuesday, March 2nd, 2027";
  const MAR_1 = "Choose Monday, March 1st, 2027";
  const FEB_2 = "Choose Tuesday, February 2nd, 2027";

  const openPicker = () => {
    render(<PageDatePicker selectedDate={SELECTED} setSelectedDate={() => undefined} />);
    fireEvent.click(screen.getByLabelText("Pick a date"));
  };

  const days = () => Array.from(document.querySelectorAll(".react-datepicker__day"));
  const day = (ariaLabel: string) => days().find((d) => d.getAttribute("aria-label") === ariaLabel);
  const daysWithBothClasses = () =>
    days()
      .filter(
        (d) =>
          d.classList.contains("react-datepicker__day--selected") &&
          d.classList.contains("react-datepicker__day--keyboard-selected")
      )
      .map((d) => d.getAttribute("aria-label"));

  it("marks the selected day as selected only, never also keyboard-selected", () => {
    openPicker();

    expect(day(MAR_2)).toHaveClass("react-datepicker__day--selected");
    expect(day(MAR_2)).not.toHaveClass("react-datepicker__day--keyboard-selected");
    expect(daysWithBothClasses()).toEqual([]);
  });

  it("keeps the two markers on separate days while arrowing across the selection", () => {
    openPicker();

    fireEvent.keyDown(day(MAR_2)!, { key: "ArrowLeft" });
    expect(day(MAR_1)).toHaveClass("react-datepicker__day--keyboard-selected");
    expect(day(MAR_1)).not.toHaveClass("react-datepicker__day--selected");
    expect(daysWithBothClasses()).toEqual([]);

    // Arrowing back onto the selection drops the keyboard marker rather than stacking it.
    fireEvent.keyDown(day(MAR_1)!, { key: "ArrowRight" });
    expect(day(MAR_2)).not.toHaveClass("react-datepicker__day--keyboard-selected");
    expect(daysWithBothClasses()).toEqual([]);
  });

  it("does not mark the previous month's same day number as selected", () => {
    openPicker();
    fireEvent.click(document.querySelector(".react-datepicker__navigation--previous")!);

    // The original bug: Feb 2 and Mar 2 were both painted as the selection.
    expect(day(FEB_2)).toHaveClass("react-datepicker__day--keyboard-selected");
    expect(day(FEB_2)).not.toHaveClass("react-datepicker__day--selected");
    expect(day(MAR_2)).toHaveClass("react-datepicker__day--selected");
    expect(daysWithBothClasses()).toEqual([]);
  });
});
