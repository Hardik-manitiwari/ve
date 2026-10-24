const BASE_URL = import.meta.env.VITE_API_URL || '/api';


export class ApiError extends Error {
  constructor(message, status = 500, code = 'ERROR', details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Universal fetch client wrapper
 */
export const apiClient = async (endpoint, options = {}) => {
  const token = sessionStorage.getItem('veloop_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('/') ? `${BASE_URL}${endpoint}` : `${BASE_URL}/${endpoint}`;

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (networkErr) {
    throw new ApiError('Unable to connect to the server. Please check your network connection.', 0, 'NETWORK_ERROR');
  }

  // Parse JSON response
  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message = (data && data.message) || response.statusText || 'Request failed';
    const code = (data && data.code) || 'API_ERROR';

    if (response.status === 401) {
      sessionStorage.removeItem('veloop_token');
      window.dispatchEvent(new Event('veloop_auth_expired'));
    }

    throw new ApiError(message, response.status, code, data);
  }

  return data;
};

export const api = {
  get: (endpoint, options = {}) => apiClient(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) =>
    apiClient(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: (endpoint, body, options = {}) =>
    apiClient(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  del: (endpoint, options = {}) => apiClient(endpoint, { ...options, method: 'DELETE' }),
};

export default api;
