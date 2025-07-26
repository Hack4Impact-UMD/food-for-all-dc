// Jest manual mock for retry utility
// Allows error simulation for error tests
export const retry = async (fn: any, retries = 3) => {
  console.log('[Retry Mock] Called with retries:', retries);
  try {
    const result = await fn();
    console.log('[Retry Mock] Awaited result:', result);
    return result;
  } catch (e) {
    console.log('[Retry Mock] Threw error:', e);
    return Promise.reject(e);
  }
};
