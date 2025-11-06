// src/utils/authToken.js
// Helper to get authentication token from cookies

export const getAuthToken = () => {
  // Try employee token first
  let token = document.cookie
    .split('; ')
    .find(row => row.startsWith('employee_token='))
    ?.split('=')[1];
  
  // If not found, try admin token
  if (!token) {
    token = document.cookie
      .split('; ')
      .find(row => row.startsWith('admin_token='))
      ?.split('=')[1];
  }
  
  return token;
};

// Helper to create authenticated fetch headers
export const getAuthHeaders = (additionalHeaders = {}) => {
  const token = getAuthToken();
  
  return {
    'Authorization': `Bearer ${token}`,
    ...additionalHeaders
  };
};

// Helper for authenticated fetch requests
export const authFetch = async (url, options = {}) => {
  const token = getAuthToken();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });
  
  if (response.status === 401) {
    // Token expired or invalid
    console.error('Authentication failed - redirecting to login');
    // You can add redirect logic here if needed
  }
  
  return response;
};

export default {
  getAuthToken,
  getAuthHeaders,
  authFetch
};