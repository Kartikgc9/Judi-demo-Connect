// API Base Configuration
const API_BASE_URL = window.location.origin + '/api';

// Token management
const getToken = () => localStorage.getItem('token');
const setToken = (token) => localStorage.setItem('token', token);
const removeToken = () => localStorage.removeItem('token');

// API Request Helper
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
}

// Authentication API
const authAPI = {
  register: (userData) => 
    apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),

  login: (credentials) => 
    apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),

  logout: () => 
    apiRequest('/auth/logout', { method: 'POST' }),

  getProfile: () => 
    apiRequest('/auth/me'),

  updateProfile: (profileData) => 
    apiRequest('/auth/updateprofile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    }),

  registerAgent: (agentData) => 
    apiRequest('/auth/register-agent', {
      method: 'POST',
      body: JSON.stringify(agentData)
    })
};

// Properties API
const propertiesAPI = {
  getProperties: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/properties${queryString ? '?' + queryString : ''}`);
  },

  getFeaturedProperties: (limit = 6) => 
    apiRequest(`/properties/featured?limit=${limit}`),

  getProperty: (id) => 
    apiRequest(`/properties/${id}`),

  createProperty: (propertyData) => 
    apiRequest('/properties', {
      method: 'POST',
      body: JSON.stringify(propertyData)
    }),

  updateProperty: (id, propertyData) => 
    apiRequest(`/properties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(propertyData)
    }),

  deleteProperty: (id) => 
    apiRequest(`/properties/${id}`, { method: 'DELETE' }),

  submitInquiry: (propertyId, inquiryData) => 
    apiRequest(`/properties/${propertyId}/inquiry`, {
      method: 'POST',
      body: JSON.stringify(inquiryData)
    }),

  getMyProperties: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/properties/agent/my-properties${queryString ? '?' + queryString : ''}`);
  },

  updatePropertyStatus: (id, status) => 
    apiRequest(`/properties/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    })
};

// Agents API
const agentsAPI = {
  getAgents: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/agents${queryString ? '?' + queryString : ''}`);
  },

  getTopAgents: (limit = 6) => 
    apiRequest(`/agents/top?limit=${limit}`),

  getAgent: (id) => 
    apiRequest(`/agents/${id}`),

  getAgentProperties: (id, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/agents/${id}/properties${queryString ? '?' + queryString : ''}`);
  },

  updateProfile: (profileData) => 
    apiRequest('/agents/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    }),

  rateAgent: (id, ratingData) => 
    apiRequest(`/agents/${id}/rate`, {
      method: 'POST',
      body: JSON.stringify(ratingData)
    }),

  getDashboardStats: () => 
    apiRequest('/agents/dashboard/stats')
};

// Contact API
const contactAPI = {
  submitContact: (contactData) => 
    apiRequest('/contact', {
      method: 'POST',
      body: JSON.stringify(contactData)
    })
};

// Upload API
const uploadAPI = {
  uploadPropertyImages: (propertyId, formData) => 
    apiRequest(`/upload/property-images/${propertyId}`, {
      method: 'POST',
      headers: {}, // Let browser set Content-Type for FormData
      body: formData
    }),

  uploadProfileImage: (formData) => 
    apiRequest('/upload/profile-image', {
      method: 'POST',
      headers: {}, // Let browser set Content-Type for FormData
      body: formData
    }),

  deletePropertyImage: (propertyId, imageId) => 
    apiRequest(`/upload/property-images/${propertyId}/${imageId}`, {
      method: 'DELETE'
    }),

  updatePropertyImage: (propertyId, imageId, imageData) => 
    apiRequest(`/upload/property-images/${propertyId}/${imageId}`, {
      method: 'PUT',
      body: JSON.stringify(imageData)
    })
};

// User management
const userAPI = {
  getCurrentUser: () => {
    const token = getToken();
    if (!token) return null;
    
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  },

  isAuthenticated: () => !!getToken(),

  isAgent: async () => {
    try {
      const response = await authAPI.getProfile();
      return response.user?.isAgent || false;
    } catch {
      return false;
    }
  }
};

// Error handling
const handleAPIError = (error) => {
  console.error('API Error:', error);
  
  if (error.message === 'Invalid token' || error.message === 'Token expired') {
    removeToken();
    window.location.href = '/login.html';
    return;
  }

  // Show error to user
  showNotification(error.message || 'An error occurred', 'error');
};

// Notification system
const showNotification = (message, type = 'info') => {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg text-white max-w-sm ${
    type === 'success' ? 'bg-green-500' : 
    type === 'error' ? 'bg-red-500' : 
    type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
  }`;
  notification.textContent = message;

  // Add to page
  document.body.appendChild(notification);

  // Remove after 5 seconds
  setTimeout(() => {
    notification.remove();
  }, 5000);
};

// Export for global use
window.API = {
  auth: authAPI,
  properties: propertiesAPI,
  agents: agentsAPI,
  contact: contactAPI,
  upload: uploadAPI,
  user: userAPI,
  handleError: handleAPIError,
  showNotification
};