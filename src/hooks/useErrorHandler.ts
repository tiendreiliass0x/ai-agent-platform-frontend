import { useCallback } from 'react';
import { useUIStore } from '@/stores/uiStore';

interface ErrorWithStatus {
  response?: {
    status: number;
    data?: {
      message?: string;
    };
  };
  message: string;
}

export function useErrorHandler() {
  const addNotification = useUIStore((state) => state.addNotification);

  const handleError = useCallback(
    (error: ErrorWithStatus, customMessage?: string) => {
      console.error('Error occurred:', error);

      let message = customMessage || 'An unexpected error occurred';

      // Handle different error types
      if (error.response?.status) {
        switch (error.response.status) {
          case 400:
            message = error.response.data?.message || 'Invalid request';
            break;
          case 401:
            message = 'Authentication required. Please log in.';
            break;
          case 403:
            message = 'Access denied. You don\'t have permission for this action.';
            break;
          case 404:
            message = 'The requested resource was not found.';
            break;
          case 429:
            message = 'Too many requests. Please wait and try again.';
            break;
          case 500:
            message = 'Server error. Please try again later.';
            break;
          default:
            message = error.response.data?.message || message;
        }
      } else if (error.message) {
        message = error.message;
      }

      // Add notification
      addNotification({
        type: 'error',
        title: 'Error',
        message,
      });

      return message;
    },
    [addNotification]
  );

  const handleSuccess = useCallback(
    (message: string, title: string = 'Success') => {
      addNotification({
        type: 'success',
        title,
        message,
      });
    },
    [addNotification]
  );

  const handleWarning = useCallback(
    (message: string, title: string = 'Warning') => {
      addNotification({
        type: 'warning',
        title,
        message,
      });
    },
    [addNotification]
  );

  const handleInfo = useCallback(
    (message: string, title: string = 'Info') => {
      addNotification({
        type: 'info',
        title,
        message,
      });
    },
    [addNotification]
  );

  return {
    handleError,
    handleSuccess,
    handleWarning,
    handleInfo,
  };
}