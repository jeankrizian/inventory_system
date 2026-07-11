/**
 * API utility - handles all HTTP requests to the backend
 */
const API = {
  baseURL: '/api',

  async request(endpoint, options = {}) {
    const config = {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    let response;
    try {
      response = await fetch(`${this.baseURL}${endpoint}`, config);
    } catch (error) {
      throw new Error('Unable to connect to server. Please ensure the backend is running.');
    }

    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      throw new Error(`Unexpected server response (${response.status}). Please restart the server.`);
    }

    const isAuthEndpoint = endpoint.startsWith('/auth/');

    if (response.status === 401 && !isAuthEndpoint) {
      if (typeof clearAuthCache === 'function') clearAuthCache();
      const onLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
      if (!onLoginPage) {
        sessionStorage.setItem('authExpiredToast', 'Your session has expired. Please sign in again.');
        window.location.href = '/index.html';
      }
      return null;
    }

    if (response.status === 403) {
      const rawMessage = data.message || 'You do not have permission to perform this action.';
      const friendlyMessage = typeof rawMessage === 'string' && !rawMessage.startsWith('{')
        ? rawMessage
        : 'You do not have permission to perform this action.';

      const isGet = !config.method || config.method === 'GET';
      const isPageLoadGet = isGet && /^\/(dashboard|inventory|users|transfers|maintenance|disposals|borrow|reports|archive|suppliers|departments|locations|documents|categories|notifications)(\/|$|\?)/.test(endpoint);
      const onDashboard = window.location.pathname.includes('dashboard.html');
      if (isPageLoadGet && !onDashboard && typeof denyPageAccess === 'function') {
        denyPageAccess(friendlyMessage);
        return null;
      }

      if (typeof showToast === 'function') showToast(friendlyMessage, 'error');
      throw new Error(friendlyMessage);
    }

    if (!data.success && response.status >= 400) {
      const message = data.message || 'Request failed';
      if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        throw new Error(data.errors[0].msg || message);
      }
      throw new Error(message);
    }

    return data;
  },

  get(endpoint) { return this.request(endpoint); },
  post(endpoint, body) { return this.request(endpoint, { method: 'POST', body }); },
  put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body }); },
  delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); },

  login: (username, password) => API.post('/auth/login', { username, password }),
  register: (data) => API.post('/auth/register', data),
  forgotPassword: (data) => API.post('/auth/forgot-password', data),
  logout: () => API.post('/auth/logout'),
  getMe: () => API.get('/auth/me'),

  getDashboard: () => API.get('/dashboard'),

  getInventory: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return API.get(`/inventory${query ? '?' + query : ''}`);
  },
  getInventoryItem: (id) => API.get(`/inventory/${id}`),
  getInventoryTimeline: (id) => API.get(`/inventory/${id}/timeline`),
  getNextItemCode: (departmentId) => API.get(`/inventory/next-code?department_id=${departmentId}`),
  createInventoryItem: (data) => API.post('/inventory', data),
  updateInventoryItem: (id, data) => API.put(`/inventory/${id}`, data),
  archiveInventoryItem: (id) => API.delete(`/inventory/${id}`),

  getCategories: () => API.get('/categories'),
  createCategory: (data) => API.post('/categories', data),
  updateCategory: (id, data) => API.put(`/categories/${id}`, data),
  archiveCategory: (id) => API.delete(`/categories/${id}`),

  getSuppliers: () => API.get('/suppliers'),
  createSupplier: (data) => API.post('/suppliers', data),
  updateSupplier: (id, data) => API.put(`/suppliers/${id}`, data),
  archiveSupplier: (id) => API.delete(`/suppliers/${id}`),

  getLocations: () => API.get('/locations'),
  createLocation: (data) => API.post('/locations', data),
  updateLocation: (id, data) => API.put(`/locations/${id}`, data),
  archiveLocation: (id) => API.delete(`/locations/${id}`),

  getBorrowableItems: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return API.get(`/borrow/borrowable-items${query ? '?' + query : ''}`);
  },
  getBorrowHistory: (inventoryItemId) => API.get(`/borrow/asset/${inventoryItemId}/history`),
  getBorrows: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return API.get(`/borrow${query ? '?' + query : ''}`);
  },
  getBorrow: (id) => API.get(`/borrow/${id}`),
  createBorrow: (data) => API.post('/borrow', data),
  approveBorrow: (id) => API.put(`/borrow/${id}/approve`),
  rejectBorrow: (id) => API.put(`/borrow/${id}/reject`),
  returnBorrow: (id, data) => API.post(`/borrow/${id}/return`, data),
  getReturns: () => API.get('/borrow/returns'),

  getReport: (type, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return API.get(`/reports/${type}${query ? '?' + query : ''}`);
  },
  getReportFilterOptions: () => API.get('/reports/filter-options'),
  exportPDF: (type, params = {}) => {
    const query = new URLSearchParams(params).toString();
    window.open(`${API.baseURL}/reports/export/pdf/${type}${query ? '?' + query : ''}`, '_blank');
  },
  exportExcel: (type, params = {}) => {
    const query = new URLSearchParams(params).toString();
    window.open(`${API.baseURL}/reports/export/excel/${type}${query ? '?' + query : ''}`, '_blank');
  },

  search: (q) => API.get(`/search?q=${encodeURIComponent(q)}`),

  getNotifications: () => API.get('/notifications'),
  getUnreadNotificationCount: () => API.get('/notifications/unread-count'),
  markNotificationRead: (id) => API.put(`/notifications/${id}/read`),
  markAllNotificationsRead: () => API.put('/notifications/read-all'),

  getUsers: () => API.get('/users/active'),

  getUserRoles: () => API.get('/users/roles'),
  getManagedUsers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return API.get(`/users${query ? '?' + query : ''}`);
  },
  getManagedUser: (id) => API.get(`/users/${id}`),
  createManagedUser: (data) => API.post('/users', data),
  updateManagedUser: (id, data) => API.put(`/users/${id}`, data),
  archiveManagedUser: (id) => API.delete(`/users/${id}`),

  getTransfers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return API.get(`/transfers${query ? '?' + query : ''}`);
  },
  createTransfer: (data) => API.post('/transfers', data),
  getTransfer: (id) => API.get(`/transfers/${id}`),
  getTransferHistory: (inventoryItemId) => API.get(`/transfers/asset/${inventoryItemId}/history`),
  approveTransfer: (id, data) => API.put(`/transfers/${id}/approve`, data || {}),
  rejectTransfer: (id, data) => API.put(`/transfers/${id}/reject`, data || {}),

  getDisposals: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return API.get(`/disposals${query ? '?' + query : ''}`);
  },
  getDisposalsByAsset: (inventoryItemId) => API.get(`/disposals/asset/${inventoryItemId}`),
  getDisposal: (id) => API.get(`/disposals/${id}`),
  createDisposal: (data) => API.post('/disposals', data),
  inspectDisposal: (id, data) => API.put(`/disposals/${id}/inspect`, data),
  approveDisposal: (id, data) => API.put(`/disposals/${id}/approve`, data),
  rejectDisposal: (id, data) => API.put(`/disposals/${id}/reject`, data || {}),

  getMaintenance: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return API.get(`/maintenance${query ? '?' + query : ''}`);
  },
  createMaintenance: (data) => API.post('/maintenance', data),
  getMaintenanceRecord: (id) => API.get(`/maintenance/${id}`),
  getMaintenanceByAsset: (inventoryItemId) => API.get(`/maintenance/asset/${inventoryItemId}`),
  approveMaintenance: (id, data) => API.put(`/maintenance/${id}/approve`, data || {}),
  rejectMaintenance: (id, data) => API.put(`/maintenance/${id}/reject`, data || {}),
  rescheduleMaintenance: (id, data) => API.put(`/maintenance/${id}/reschedule`, data),
  startMaintenance: (id, data) => API.put(`/maintenance/${id}/start`, data || {}),
  completeMaintenance: (id, data) => API.put(`/maintenance/${id}/complete`, data),

  getComponents: (parentId) => API.get(`/components/parent/${parentId}`),
  createComponentReplacement: (data) => API.post('/components', data),

  getDepartments: () => API.get('/departments'),

  getArchive: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return API.get(`/archive${query ? '?' + query : ''}`);
  },
  restoreArchive: (module, id) => API.put(`/archive/${module}/${id}/restore`),

  getDocuments: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return API.get(`/documents${query ? '?' + query : ''}`);
  },
  getDocument: (id) => API.get(`/documents/${id}`),
  lookupDocument: (type, module, transactionId) =>
    API.get(`/documents/lookup?type=${encodeURIComponent(type)}&module=${encodeURIComponent(module)}&transaction_id=${transactionId}`),
  openDocumentPreview: (id) => window.open(`/pages/document-preview.html?id=${id}`, '_blank'),
  downloadDocumentPdf: (id) => window.open(`${API.baseURL}/documents/${id}/pdf`, '_blank'),

  getBackups: () => API.get('/backups'),
  createBackup: () => API.post('/backups'),
  deleteBackup: (id) => API.request(`/backups/${id}`, { method: 'DELETE' }),
  restoreBackup: (id) => API.post(`/backups/${id}/restore`),
  restoreBackupUpload: (content) => API.request('/backups/restore-upload', { method: 'POST', body: { content } }),
  downloadBackup: (id) => window.open(`${API.baseURL}/backups/${id}/download`, '_blank')
};
