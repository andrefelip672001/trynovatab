const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Función auxiliar para hacer peticiones, agregando el token automáticamente si existe
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('trynova_token');

  // No fijar Content-Type cuando el body es FormData (el browser lo pone con el boundary)
  const headers = options.body instanceof FormData
    ? { ...options.headers }
    : { 'Content-Type': 'application/json', ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.mensaje || 'Error en la petición');
  }

  return data;
}

export const authService = {
  login: (email, password) =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),

  me: () => apiRequest('/auth/me')
};

export const tableService = {
  listar: () => apiRequest('/tables'),
  crear: (datos) =>
    apiRequest('/tables', {
      method: 'POST',
      body: JSON.stringify(datos)
    }),
  actualizar: (id, datos) =>
    apiRequest(`/tables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(datos)
    })
};

export const productService = {
  listar: (soloActivos = true) => apiRequest(`/products?soloActivos=${soloActivos}`),
  buscar: (q) => apiRequest(`/products/buscar?q=${encodeURIComponent(q)}`),
  crear: (datos) =>
    apiRequest('/products', {
      method: 'POST',
      body: JSON.stringify(datos)
    }),
  actualizar: (id, datos) =>
    apiRequest(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(datos)
    }),
  agregarStock: (id, cantidad) =>
    apiRequest(`/products/${id}/agregar-stock`, {
      method: 'POST',
      body: JSON.stringify({ cantidad })
    })
};

export const orderService = {
  abrir: (table_id, notas) =>
    apiRequest('/orders', {
      method: 'POST',
      body: JSON.stringify({ table_id, notas })
    }),

  verPorMesa: (tableId) => apiRequest(`/orders/por-mesa/${tableId}`),

  ver: (orderId) => apiRequest(`/orders/${orderId}`),

  agregarItem: (orderId, product_id, cantidad, notas) =>
    apiRequest(`/orders/${orderId}/items`, {
      method: 'POST',
      body: JSON.stringify({ product_id, cantidad, notas })
    }),

  cerrar: (orderId) =>
    apiRequest(`/orders/${orderId}/cerrar`, {
      method: 'PUT'
    })
};

export const splitService = {
  listar: (orderId) => apiRequest(`/orders/${orderId}/splits`),

  crear: (orderId, datos) =>
    apiRequest(`/orders/${orderId}/splits`, {
      method: 'POST',
      body: JSON.stringify(datos)
    }),

  ver: (splitId) => apiRequest(`/splits/${splitId}`),

  asignarItem: (splitId, orderItemId, cantidad) =>
    apiRequest(`/splits/${splitId}/items`, {
      method: 'POST',
      body: JSON.stringify({ order_item_id: orderItemId, cantidad })
    }),

  resumenOrden: (orderId) => apiRequest(`/orders/${orderId}/resumen`)
};

export const categoryService = {
  listar: () => apiRequest('/categories'),
  crear: (datos) =>
    apiRequest('/categories', {
      method: 'POST',
      body: JSON.stringify(datos)
    })
};

export const inventoryService = {
  listar: () => apiRequest('/inventory'),
  crear: (datos) =>
    apiRequest('/inventory', {
      method: 'POST',
      body: JSON.stringify(datos)
    }),
  agregarStock: (id, cantidad) =>
    apiRequest(`/inventory/${id}/agregar-stock`, {
      method: 'POST',
      body: JSON.stringify({ cantidad })
    })
};

export const recipeService = {
  ver: (productId) => apiRequest(`/recipes/${productId}`),
  agregarIngrediente: (productId, inventoryId, cantidad) =>
    apiRequest(`/recipes/${productId}`, {
      method: 'POST',
      body: JSON.stringify({ inventory_id: inventoryId, cantidad })
    })
};

export const statsService = {
  dashboard:   () => apiRequest('/stats/dashboard'),
  cierreCaja:  (fecha) => apiRequest(`/stats/cierre-caja${fecha ? '?fecha=' + fecha : ''}`),
};

export const importService = {
  descargarPlantilla: () => {
    const token = localStorage.getItem('trynova_token');
    window.open(`${API_URL}/import/plantilla?token=${token}`, '_blank');
  },
  importarProductos: (archivo) => {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return apiRequest('/import/productos', { method: 'POST', body: formData });
  }
};

export const clienteService = {
  listar:     ()          => apiRequest('/clientes'),
  buscar:     (q)         => apiRequest(`/clientes/buscar?q=${encodeURIComponent(q)}`),
  crear:      (datos)     => apiRequest('/clientes', { method: 'POST', body: JSON.stringify(datos) }),
  actualizar: (id, datos) => apiRequest(`/clientes/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  eliminar:   (id)        => apiRequest(`/clientes/${id}`, { method: 'DELETE' }),
};

export const superadminService = {
  stats:         ()    => apiRequest('/superadmin/stats'),
  listarTenants: ()    => apiRequest('/superadmin/tenants'),
  crearTenant:   (datos) => apiRequest('/superadmin/tenants', {
    method: 'POST',
    body: JSON.stringify(datos),
  }),
  toggleTenant:  (id)  => apiRequest(`/superadmin/tenants/${id}/toggle`, { method: 'PUT' }),
};

export const invoiceService = {
  listar: () => apiRequest('/invoices'),
  emitirDirecta: (datos) => apiRequest('/invoices/emitir-directa', {
    method: 'POST',
    body: JSON.stringify(datos),
  }),
};