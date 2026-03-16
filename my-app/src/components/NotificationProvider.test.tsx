import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createRoot, Root } from "react-dom/client";
import { NotificationProvider, useNotifications } from "./NotificationProvider";
import styles from "./PopUp.module.css";

type ActEnvironmentGlobal = typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

let notificationsApi: ReturnType<typeof useNotifications> | null = null;
const actEnvironmentGlobal = globalThis as ActEnvironmentGlobal;

const NotificationHarness: React.FC = () => {
  notificationsApi = useNotifications();
  return null;
};

const getNotificationsApi = () => {
  if (!notificationsApi) {
    throw new Error("Notification API was not initialized");
  }

  return notificationsApi;
};

describe("NotificationProvider", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    actEnvironmentGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    notificationsApi = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <NotificationProvider>
          <NotificationHarness />
        </NotificationProvider>
      );
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    notificationsApi = null;
    jest.useRealTimers();
    actEnvironmentGlobal.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("renders concurrent notifications without resetting existing timers", () => {
    const api = getNotificationsApi();

    act(() => {
      api.showSuccess("First notification", 1000);
    });

    expect(container.querySelector(`.${styles.popupViewport}`)?.childElementCount).toBe(1);
    expect(container.textContent).toContain("First notification");
    expect(container.querySelector('[role="status"]')?.textContent).toBe("First notification");

    act(() => {
      jest.advanceTimersByTime(500);
      api.showWarning("Second notification", 2000);
    });

    expect(container.querySelector(`.${styles.popupViewport}`)?.childElementCount).toBe(2);
    expect(container.textContent).toContain("First notification");
    expect(container.textContent).toContain("Second notification");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Second notification");

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(container.textContent).not.toContain("First notification");
    expect(container.textContent).toContain("Second notification");

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(container.textContent).not.toContain("Second notification");
    expect(container.querySelector(`.${styles.popupViewport}`)).toBeNull();
  });
});
