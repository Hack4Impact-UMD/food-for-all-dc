import React, { createContext, useContext, useState, useCallback } from "react";
import PopUp from "./PopUp";

/**
 * Notification types for different message categories
 */
export type NotificationType = "success" | "error" | "warning" | "info";

/**
 * Individual notification object
 */
export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  duration?: number;
  position?: "top" | "bottom";
}

/**
 * Context for notification management
 */
interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id">) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Hook to use notifications in components
 *
 * @example
 * const { showSuccess, showError } = useNotifications();
 *
 * const handleSave = async () => {
 *   try {
 *     await saveData();
 *     showSuccess('Data saved successfully!');
 *   } catch (error) {
 *     showError('Failed to save data');
 *   }
 * };
 */
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};

/**
 * Provider component for notification management
 */
interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, "id">) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newNotification: Notification = {
      id,
      duration: 3000,
      position: "bottom",
      ...notification,
    };

    setNotifications((prev) => [...prev, newNotification]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const showSuccess = useCallback(
    (message: string, duration?: number) => {
      addNotification({ message, type: "success", duration });
    },
    [addNotification]
  );

  const showError = useCallback(
    (message: string, duration?: number) => {
      addNotification({ message, type: "error", duration: duration || 5000 });
    },
    [addNotification]
  );

  const showWarning = useCallback(
    (message: string, duration?: number) => {
      addNotification({ message, type: "warning", duration });
    },
    [addNotification]
  );

  const showInfo = useCallback(
    (message: string, duration?: number) => {
      addNotification({ message, type: "info", duration });
    },
    [addNotification]
  );

  const value: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
};

/**
 * Container component that renders all active notifications
 */
const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  return (
    <>
      {notifications.map((notification) => (
        <PopUp
          key={notification.id}
          message={notification.message}
          type={notification.type}
          duration={notification.duration}
          onDismiss={() => removeNotification(notification.id)}
        />
      ))}
    </>
  );
};
