// Jest manual mock for retry utility
// Allows error simulation for error tests
export const retry = async (fn: any, retries = 3) => {
  try {
    const result = await fn();
    return result;
  } catch (e) {
    return Promise.reject(e);
  }
};
