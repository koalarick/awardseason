type ErrorResponseData = {
  error?: string;
};

type ErrorWithResponse = {
  response?: {
    data?: ErrorResponseData;
  } | null;
};

export const hasApiResponse = (error: unknown): error is ErrorWithResponse => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  if (!('response' in error)) {
    return false;
  }

  const response = (error as ErrorWithResponse).response;
  return response != null;
};

export const getApiErrorMessage = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const response = (error as ErrorWithResponse).response;
  const message = response?.data?.error;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return null;
};
