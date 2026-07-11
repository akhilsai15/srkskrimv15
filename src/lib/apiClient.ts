import { getConfig } from './runtimeConfig';
import { useAuthStore } from '../store/authStore';

async function request<T>(
  path: string,
  method: string,
  body?: any,
  options: RequestInit = {}
): Promise<T> {
  const config = await getConfig();
  const baseUrl = config.apiBaseUrl || '';
  const url = `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(options.headers || {});
  
  // Pull Cognito ID token from authStore
  const idToken = useAuthStore.getState().idToken;
  if (idToken) {
    headers.set('Authorization', `Bearer ${idToken}`);
  }

  if (body !== undefined && !headers.has('Content-Type') && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const fetchOptions: RequestInit = {
    ...options,
    method,
    headers,
  };

  if (body !== undefined) {
    fetchOptions.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    if (response.status === 401) {
      // Trigger token refresh or logout
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          await useAuthStore.getState().refreshSession();
          // Retry the request once with new idToken
          const newIdToken = useAuthStore.getState().idToken;
          if (newIdToken) {
            headers.set('Authorization', `Bearer ${newIdToken}`);
          }
          const retryResponse = await fetch(url, {
            ...fetchOptions,
            headers,
          });
          if (retryResponse.ok) {
            const retryContentType = retryResponse.headers.get('content-type');
            if (retryContentType && retryContentType.includes('application/json')) {
              return retryResponse.json() as Promise<T>;
            }
            return {} as Promise<T>;
          }
        } catch (refreshError) {
          console.error('Failed to refresh Cognito session on 401:', refreshError);
        }
      }
      
      // If refresh failed or was not available, sign out
      useAuthStore.getState().signOut();
    }
    
    let errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
    try {
      const errBody = await response.json();
      if (errBody && errBody.message) {
        errorMessage = errBody.message;
      }
    } catch (_) {}
    throw new Error(errorMessage);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }
  return {} as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestInit) => request<T>(path, 'GET', undefined, options),
  post: <T>(path: string, body?: any, options?: RequestInit) => request<T>(path, 'POST', body, options),
  put: <T>(path: string, body?: any, options?: RequestInit) => request<T>(path, 'PUT', body, options),
  delete: <T>(path: string, options?: RequestInit) => request<T>(path, 'DELETE', undefined, options),
};
