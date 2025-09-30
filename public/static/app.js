// Adaptoheal Analytics - Frontend JavaScript (Modern Version)
let dashboardData = null;
let chatEnabled = false;

// Función para sugerencias rápidas
function askSuggestion(question) {
    const inputEl = document.getElementById('chat-input');
    inputEl.value = question;
    inputEl.focus();
}

// DEBUG: Capturar todos los errores no manejados
window.addEventListener('error', function(e) {
    console.error('ERROR GLOBAL CAPTURADO:', e.error);
    console.error('Archivo:', e.filename, 'Línea:', e.lineno);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('PROMESA RECHAZADA NO MANEJADA:', e.reason);
});

// HELPER: Función segura para actualizar elementos
function safeUpdateElement(elementId, content) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error('Elemento no encontrado:', elementId);
        return false;
    }
    element.textContent = content;
    return true;
}

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', async function() {
    await loadDashboardWithCounters();
});

// Cargar datos del dashboard
async function loadDashboard(period = null) {
    const loadingEl = document.getElementById('loading');
    const dashboardEl = document.getElementById('dashboard');
    const errorEl = document.getElementById('error');
    
    try {
        // Test conexión WooCommerce
        const testResponse = await axios.get('/api/test-woo');
        console.log('WooCommerce connection test:', testResponse.data);
        
        // Obtener período actual si no se especifica
        if (!period) {
            const selector = document.getElementById('period-selector');
            period = selector ? selector.value : 'august-2025';
        }
        
        // Obtener filtros de estado activos
        const statuses = ['completed', 'delivered', 'processing', 'on-hold', 'pending'];
        const activeStatuses = [];
        statuses.forEach(status => {
            const checkbox = document.getElementById(`status-${status}`);
            if (checkbox && checkbox.checked) {
                activeStatuses.push(status);
            }
        });
        const statusParam = activeStatuses.length > 0 ? activeStatuses.join(',') : 'completed,delivered,processing';
        
        // Cargar dashboard con período específico Y filtros de estado
        const response = await axios.get(`/api/dashboard?period=${period}&status_filters=${statusParam}`);
        
        if (response.data.success) {
            dashboardData = response.data.data;
            
            // IMPORTANTE: Actualizar indicadores de período y estado
            updateStatusCounters(response.data.debug.statusBreakdownAll);
            updatePeriodIndicators(response.data.debug);
            
            renderDashboard();
            loadingEl.classList.add('hidden');
            dashboardEl.classList.remove('hidden');
            chatEnabled = true;
            
            // Habilitar chat
            document.getElementById('chat-send').disabled = false;
            document.getElementById('chat-input').disabled = false;
        } else {
            throw new Error('Error loading dashboard data');
        }
        
    } catch (error) {
        console.error('Dashboard error:', error);
        loadingEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
        
        // Mostrar estado de error
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.innerHTML = '<i class="fas fa-times-circle mr-1"></i>Error';
            statusEl.className = 'text-sm font-bold text-red-600';
        }
    }
}

// Renderizar datos del dashboard con animaciones
function renderDashboard() {
    if (!dashboardData) return;
    
    // Animar KPIs con conteo
    animateValue('total-sales', 0, dashboardData.totalSales30Days, 1500, 
        (val) => `$${val.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN`);
    
    animateValue('avg-ticket', 0, dashboardData.avgTicket30Days, 1200, 
        (val) => `$${val.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN`);
    
    animateValue('orders-count', 0, dashboardData.ordersCount30Days, 1000, 
        (val) => Math.floor(val).toLocaleString('es-MX'));
    
    // NUEVO: Actualizar métodos de pago (con validación)
    if (dashboardData.paymentMethods) {
        // Stripe
        safeUpdateElement('stripe-sales', `$${dashboardData.paymentMethods.stripe.sales.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN`);
        safeUpdateElement('stripe-orders', `${dashboardData.paymentMethods.stripe.orders} órdenes`);
        // safeUpdateElement('stripe-avg', `Promedio: $${dashboardData.paymentMethods.stripe.avgTicket.toLocaleString('es-MX', {minimumFractionDigits: 2})}`); // Eliminado del layout
        safeUpdateElement('stripe-percentage', `${dashboardData.paymentMethods.stripe.percentage}%`);
        
        // PayPal
        safeUpdateElement('paypal-sales', `$${dashboardData.paymentMethods.paypal.sales.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN`);
        safeUpdateElement('paypal-orders', `${dashboardData.paymentMethods.paypal.orders} órdenes`);
        // safeUpdateElement('paypal-avg', `Promedio: $${dashboardData.paymentMethods.paypal.avgTicket.toLocaleString('es-MX', {minimumFractionDigits: 2})}`); // Eliminado del layout
        safeUpdateElement('paypal-percentage', `${dashboardData.paymentMethods.paypal.percentage}%`);
        
        // Transferencia
        safeUpdateElement('transfer-sales', `$${dashboardData.paymentMethods.transfer.sales.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN`);
        safeUpdateElement('transfer-orders', `${dashboardData.paymentMethods.transfer.orders} órdenes`);
        // safeUpdateElement('transfer-avg', `Promedio: $${dashboardData.paymentMethods.transfer.avgTicket.toLocaleString('es-MX', {minimumFractionDigits: 2})}`); // Eliminado del layout
        safeUpdateElement('transfer-percentage', `${dashboardData.paymentMethods.transfer.percentage}%`);
    }

    // NUEVO: Actualizar estados de órdenes
    if (dashboardData.orderStates) {
        // Completed
        document.getElementById('completed-sales').textContent = `$${dashboardData.orderStates.completed.sales.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN`;
        document.getElementById('completed-orders').textContent = `${dashboardData.orderStates.completed.orders} órdenes`;
        document.getElementById('completed-percentage').textContent = `${dashboardData.orderStates.completed.percentage}%`;
        
        // Delivered
        document.getElementById('delivered-sales').textContent = `$${dashboardData.orderStates.delivered.sales.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN`;
        document.getElementById('delivered-orders').textContent = `${dashboardData.orderStates.delivered.orders} órdenes`;
        document.getElementById('delivered-percentage').textContent = `${dashboardData.orderStates.delivered.percentage}%`;
        
        // Processing
        document.getElementById('processing-sales').textContent = `$${dashboardData.orderStates.processing.sales.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN`;
        document.getElementById('processing-orders').textContent = `${dashboardData.orderStates.processing.orders} órdenes`;
        document.getElementById('processing-percentage').textContent = `${dashboardData.orderStates.processing.percentage}%`;
    }

    // NUEVO: Actualizar tipos de cliente (Cliente vs Distribuidor)
    if (dashboardData.customerTypes) {
        // Distribuidores
        document.getElementById('distributors-sales').textContent = `$${dashboardData.customerTypes.distributors.sales.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN`;
        document.getElementById('distributors-orders').textContent = `${dashboardData.customerTypes.distributors.orders} órdenes`;
        document.getElementById('distributors-customers').textContent = `${dashboardData.customerTypes.distributors.customers} distribuidores únicos`;
        document.getElementById('distributors-avg-ticket').textContent = `Ticket prom: $${dashboardData.customerTypes.distributors.avgTicket.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
        document.getElementById('distributors-avg-customer').textContent = `Por distribuidor: $${dashboardData.customerTypes.distributors.avgPerCustomer.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
        document.getElementById('distributors-percentage').textContent = `${dashboardData.customerTypes.distributors.percentage}%`;
        
        // Clientes Regulares
        document.getElementById('customers-sales').textContent = `$${dashboardData.customerTypes.customers.sales.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN`;
        document.getElementById('customers-orders').textContent = `${dashboardData.customerTypes.customers.orders} órdenes`;
        document.getElementById('customers-customers').textContent = `${dashboardData.customerTypes.customers.customers} clientes únicos`;
        document.getElementById('customers-avg-ticket').textContent = `Ticket prom: $${dashboardData.customerTypes.customers.avgTicket.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
        document.getElementById('customers-avg-customer').textContent = `Por cliente: $${dashboardData.customerTypes.customers.avgPerCustomer.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
        document.getElementById('customers-percentage').textContent = `${dashboardData.customerTypes.customers.percentage}%`;
    }
    
    // Top Products
    const topProductsEl = document.getElementById('top-products');
    topProductsEl.innerHTML = '';
    
    dashboardData.topProducts.forEach((product, index) => {
        const productEl = document.createElement('div');
        productEl.className = 'flex items-center justify-between p-4 bg-gradient-to-r from-white to-gray-50 rounded-xl border border-gray-100 hover:shadow-md transition-all';
        
        const rankColors = ['from-yellow-400 to-orange-500', 'from-gray-400 to-gray-500', 'from-amber-600 to-yellow-700'];
        const rankColor = rankColors[index] || 'from-blue-500 to-cyan-600';
        
        productEl.innerHTML = `
            <div class="flex items-center space-x-4">
                <div class="relative">
                    <div class="w-10 h-10 bg-gradient-to-r ${rankColor} rounded-full flex items-center justify-center shadow-lg">
                        <span class="text-white font-bold text-sm">${index + 1}</span>
                    </div>
                    ${index === 0 ? '<div class="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center"><i class="fas fa-crown text-xs text-white"></i></div>' : ''}
                </div>
                <div>
                    <p class="font-semibold text-gray-800 text-sm leading-tight">${product.name.split(' ').slice(0, 4).join(' ')}</p>
                    <p class="text-xs text-gray-500 mt-1">$${product.price.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN</p>
                </div>
            </div>
            <div class="text-right">
                <p class="font-bold text-lg ${index < 3 ? 'text-emerald-600' : 'text-gray-700'}">${product.sales.toLocaleString('es-MX')}</p>
                <p class="text-xs text-gray-500">ventas totales</p>
            </div>
        `;
        topProductsEl.appendChild(productEl);
    });
    
    // Top Orders
    const topOrdersEl = document.getElementById('top-orders');
    topOrdersEl.innerHTML = '';
    
    dashboardData.topOrders.forEach((order, index) => {
        const orderEl = document.createElement('div');
        orderEl.className = 'flex items-center justify-between p-4 bg-gradient-to-r from-white to-emerald-50 rounded-xl border border-emerald-100 hover:shadow-md transition-all';
        
        const orderDate = new Date(order.date).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
        
        orderEl.innerHTML = `
            <div class="flex items-center space-x-4">
                <div class="relative">
                    <div class="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-lg">
                        <span class="text-white font-bold text-sm">${index + 1}</span>
                    </div>
                    ${index === 0 ? '<div class="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center"><i class="fas fa-medal text-xs text-white"></i></div>' : ''}
                </div>
                <div>
                    <p class="font-semibold text-gray-800 text-sm">Orden #${order.id}</p>
                    <p class="text-xs text-gray-600 mt-1">${order.customer}</p>
                    <p class="text-xs text-gray-500 flex items-center mt-1">
                        <i class="fas fa-calendar-alt mr-1"></i>${orderDate}
                    </p>
                </div>
            </div>
            <div class="text-right">
                <p class="font-bold text-lg text-emerald-600">$${order.total.toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
                <p class="text-xs text-gray-500">MXN</p>
            </div>
        `;
        topOrdersEl.appendChild(orderEl);
    });
}

// Chat IA Functions
function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

// NUEVA FUNCIÓN: Establecer mensaje predefinido
function setChatMessage(message) {
    const inputEl = document.getElementById('chat-input');
    inputEl.value = message;
    inputEl.focus();
}

// NUEVA FUNCIÓN: Cambiar período de análisis
function changePeriod() {
    const selector = document.getElementById('period-selector');
    const selectedPeriod = selector.value;
    const customPanel = document.getElementById('custom-date-panel');
    
    // Manejar período personalizado
    if (selectedPeriod === 'custom') {
        // Mostrar panel de fechas personalizado
        if (customPanel) {
            customPanel.classList.remove('hidden');
            // Establecer fechas por defecto (últimos 30 días)
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            
            document.getElementById('start-date').value = startDate.toISOString().split('T')[0];
            document.getElementById('end-date').value = endDate.toISOString().split('T')[0];
        }
        return; // No recargar aún, esperar a que apliquen las fechas
    }
    
    // Ocultar panel personalizado si está visible
    if (customPanel) {
        customPanel.classList.add('hidden');
    }
    
    // Mostrar loading
    showLoading();
    
    // Mapear períodos a parámetros de API (incluye nuevos períodos)
    const periodParams = {
        'today': 'period=today',
        'yesterday': 'period=yesterday',
        'august-2025': 'period=august-2025',
        'september-2025': 'period=september-2025', 
        'august-september-2025': 'period=august-september-2025',
        'last-30-days': 'period=last-30-days',
        'last-7-days': 'period=last-7-days',
        'this-month': 'period=this-month',
        'last-month': 'period=last-month'
    };
    
    // Recargar dashboard con nuevo período
    setTimeout(async () => {
        updatePeriodDisplay(selectedPeriod);
        await loadDashboard(selectedPeriod); // Recargar datos con el período específico
        hideLoading();
    }, 500);
}

// FUNCIÓN: Actualizar display del período
function updatePeriodDisplay(period) {
    const periodNames = {
        'today': 'Hoy',
        'yesterday': 'Ayer',
        'august-2025': 'Agosto 2025',
        'september-2025': 'Septiembre 2025',
        'august-september-2025': 'Agosto - Septiembre 2025',
        'last-30-days': 'Últimos 30 días',
        'last-7-days': 'Últimos 7 días', 
        'this-month': 'Este mes',
        'last-month': 'Mes anterior'
    };
    
    // Actualizar cualquier texto que muestre el período
    const periodTexts = document.querySelectorAll('[data-period-text]');
    periodTexts.forEach(el => {
        el.textContent = periodNames[period] || 'Período personalizado';
    });
    
    console.log(`Dashboard actualizado para: ${periodNames[period]}`);
}

// NUEVAS FUNCIONES: Manejo de fechas personalizadas
function applyCustomDates() {
    const startDateEl = document.getElementById('start-date');
    const endDateEl = document.getElementById('end-date');
    const customPanel = document.getElementById('custom-date-panel');
    
    const startDate = startDateEl.value;
    const endDate = endDateEl.value;
    
    if (!startDate || !endDate) {
        alert('Por favor selecciona ambas fechas');
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        alert('La fecha de inicio debe ser anterior a la fecha de fin');
        return;
    }
    
    // Ocultar panel
    customPanel.classList.add('hidden');
    
    // Mostrar loading y cargar datos
    showLoading();
    
    // Crear parámetros para período personalizado
    const customPeriod = `custom:${startDate}:${endDate}`;
    
    setTimeout(async () => {
        updatePeriodDisplay('custom');
        await loadDashboardCustom(startDate, endDate);
        hideLoading();
    }, 500);
}

function cancelCustomDates() {
    const customPanel = document.getElementById('custom-date-panel');
    const selector = document.getElementById('period-selector');
    
    // Ocultar panel
    customPanel.classList.add('hidden');
    
    // Volver al período anterior (august-2025 por defecto)
    selector.value = 'august-2025';
}

// FUNCIÓN: Cargar dashboard con fechas personalizadas
async function loadDashboardCustom(startDate, endDate) {
    const loadingEl = document.getElementById('loading');
    const dashboardEl = document.getElementById('dashboard');
    const errorEl = document.getElementById('error');
    
    try {
        // Test conexión WooCommerce
        const testResponse = await axios.get('/api/test-woo');
        console.log('WooCommerce connection test:', testResponse.data);
        
        // Obtener filtros de estado activos
        const statuses = ['completed', 'delivered', 'processing', 'on-hold', 'pending'];
        const activeStatuses = [];
        statuses.forEach(status => {
            const checkbox = document.getElementById(`status-${status}`);
            if (checkbox && checkbox.checked) {
                activeStatuses.push(status);
            }
        });
        const statusParam = activeStatuses.length > 0 ? activeStatuses.join(',') : 'completed,delivered,processing';
        
        // Cargar dashboard con fechas personalizadas Y filtros de estado
        const response = await axios.get(`/api/dashboard?start_date=${startDate}&end_date=${endDate}&status_filters=${statusParam}`);
        
        if (response.data.success) {
            dashboardData = response.data.data;
            
            // IMPORTANTE: Actualizar indicadores de período y estado
            updateStatusCounters(response.data.debug.statusBreakdownAll);
            updatePeriodIndicators(response.data.debug);
            
            renderDashboard();
            loadingEl.classList.add('hidden');
            dashboardEl.classList.remove('hidden');
            chatEnabled = true;
            
            // Habilitar chat
            document.getElementById('chat-send').disabled = false;
            document.getElementById('chat-input').disabled = false;
        } else {
            throw new Error('Error loading dashboard data');
        }
        
    } catch (error) {
        console.error('Dashboard error:', error);
        loadingEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
        
        // Mostrar estado de error
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.innerHTML = '<i class="fas fa-times-circle mr-1"></i>Error';
            statusEl.className = 'text-sm font-bold text-red-600';
        }
    }
}

async function sendChatMessage() {
    if (!chatEnabled) return;
    
    const inputEl = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');
    const messagesEl = document.getElementById('chat-messages');
    
    const message = inputEl.value.trim();
    if (!message) return;
    
    // Deshabilitar input
    inputEl.disabled = true;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    // Limpiar mensaje de inicio si existe
    if (messagesEl.children.length === 1 && messagesEl.children[0].textContent.includes('primera pregunta')) {
        messagesEl.innerHTML = '';
    }
    
    // Agregar mensaje del usuario
    addChatMessage(message, 'user');
    inputEl.value = '';
    
    try {
        const response = await axios.post('/api/chat', { message });
        
        if (response.data.success) {
            addChatMessage(response.data.data.response, 'ai');
        } else {
            addChatMessage('Error: No se pudo procesar tu consulta.', 'error');
        }
        
    } catch (error) {
        console.error('Chat error:', error);
        addChatMessage('Error de conexión. Intenta nuevamente.', 'error');
    } finally {
        // Rehabilitar input
        inputEl.disabled = false;
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        inputEl.focus();
    }
}

function addChatMessage(message, type) {
    const messagesEl = document.getElementById('chat-messages');
    const messageEl = document.createElement('div');
    
    const timestamp = new Date().toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    if (type === 'user') {
        messageEl.className = 'mb-3 text-right';
        messageEl.innerHTML = `
            <div class="inline-block bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-3 rounded-xl max-w-sm shadow-lg">
                <p class="text-sm font-medium">${message}</p>
                <p class="text-xs opacity-75 mt-1 flex items-center">
                    <i class="fas fa-user-circle mr-1"></i>${timestamp}
                </p>
            </div>
        `;
    } else if (type === 'ai') {
        messageEl.className = 'mb-3';
        // Procesar el mensaje para mejor formato visual
        const formattedMessage = message
            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
            .replace(/• /g, '• ')
            .replace(/📈|📊|🎯|⚡/g, '<span class="text-lg">$&</span>')
            .replace(/💰|📦|💳|🎖️|🔥|🏆/g, '<span class="text-base">$&</span>')
            .replace(/\n/g, '<br>')
            
        messageEl.innerHTML = `
            <div class="flex items-start space-x-3">
                <div class="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-full flex items-center justify-center shadow-lg">
                    <i class="fas fa-brain text-sm text-white"></i>
                </div>
                <div class="flex-1 bg-gradient-to-br from-white to-gray-50 p-5 rounded-xl shadow-md border border-gray-200 max-w-2xl">
                    <div class="flex items-start justify-between mb-3">
                        <div class="flex items-center space-x-2">
                            <span class="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full">Adaptoheal IA</span>
                            <span class="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                                <i class="fas fa-sparkles mr-1"></i>Marketing Expert
                            </span>
                        </div>
                        <span class="text-xs text-gray-400">${timestamp}</span>
                    </div>
                    <div class="text-sm text-gray-800 leading-relaxed space-y-2">
                        ${formattedMessage}
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'error') {
        messageEl.className = 'mb-3';
        messageEl.innerHTML = `
            <div class="flex items-start">
                <div class="bg-red-600 text-white rounded-full p-2 mr-3">
                    <i class="fas fa-exclamation-triangle text-sm"></i>
                </div>
                <div class="bg-red-100 px-4 py-2 rounded-lg max-w-md">
                    <p class="text-sm text-red-800">${message}</p>
                    <p class="text-xs text-red-600 mt-1">${timestamp}</p>
                </div>
            </div>
        `;
    }
    
    messagesEl.appendChild(messageEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Función para refrescar datos (opcional)
function refreshDashboard() {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
    loadDashboard();
}

// Función de animación para números
function animateValue(elementId, start, end, duration, formatter = (val) => val) {
    const element = document.getElementById(elementId);
    
    // CRÍTICO: Validar que el elemento existe
    if (!element) {
        console.error('animateValue: Elemento no encontrado:', elementId);
        return;
    }
    
    const startTimestamp = performance.now();
    
    function step(timestamp) {
        const elapsed = timestamp - startTimestamp;
        const progress = Math.min(elapsed / duration, 1);
        const currentValue = start + (end - start) * easeOutQuart(progress);
        
        element.textContent = formatter(currentValue);
        
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }
    
    requestAnimationFrame(step);
}

// Easing function para animaciones suaves
function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
}

// Funciones auxiliares para loading
function showLoading() {
    const loadingEl = document.getElementById('loading');
    const dashboardEl = document.getElementById('dashboard');
    
    if (loadingEl && dashboardEl) {
        loadingEl.classList.remove('hidden');
        dashboardEl.classList.add('hidden');
    }
}

function hideLoading() {
    const loadingEl = document.getElementById('loading');
    const dashboardEl = document.getElementById('dashboard');
    
    if (loadingEl && dashboardEl) {
        loadingEl.classList.add('hidden');
        dashboardEl.classList.remove('hidden');
    }
}

// NUEVAS FUNCIONES: Filtros de Estado de Órdenes

// Función para actualizar filtros de estado
function updateOrderStatusFilter() {
    // Obtener todos los checkboxes de estado
    const statuses = ['completed', 'delivered', 'processing', 'on-hold', 'pending'];
    const activeStatuses = [];
    
    statuses.forEach(status => {
        const checkbox = document.getElementById(`status-${status}`);
        if (checkbox && checkbox.checked) {
            activeStatuses.push(status);
        }
    });
    
    // Si no hay estados seleccionados, mostrar advertencia
    if (activeStatuses.length === 0) {
        alert('Debe seleccionar al menos un estado de orden');
        // Reactivar 'completed' por defecto
        document.getElementById('status-completed').checked = true;
        activeStatuses.push('completed');
    }
    
    // Recargar dashboard con filtros aplicados
    loadDashboardWithFilters(activeStatuses);
}

// Función para cargar dashboard con filtros de estado
async function loadDashboardWithFilters(statusFilters) {
    showLoading();
    
    try {
        const period = document.getElementById('period-selector').value;
        const statusParam = statusFilters.join(',');
        
        let url = `/api/dashboard?period=${period}&status_filters=${statusParam}`;
        
        // Si es período personalizado, agregar fechas
        if (period === 'custom') {
            const startDate = document.getElementById('start-date').value;
            const endDate = document.getElementById('end-date').value;
            if (startDate && endDate) {
                url = `/api/dashboard?start_date=${startDate}&end_date=${endDate}&status_filters=${statusParam}`;
            }
        }
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            // CRÍTICO: Actualizar variable global dashboardData
            dashboardData = result.data;
            
            // Actualizar contadores de estados
            updateStatusCounters(result.debug.statusBreakdownAll);
            
            // Actualizar indicadores de período y estados
            updatePeriodIndicators(result.debug);
            
            // Actualizar métricas del dashboard
            renderDashboard();
            
            console.log('Dashboard actualizado con filtros:', statusFilters);
            hideLoading();
        } else {
            throw new Error(result.error || 'Error al cargar datos');
        }
    } catch (error) {
        console.error('Error cargando dashboard con filtros:', error);
        hideLoading();
        console.error('Error al aplicar filtros: ' + error.message);
    }
}

// Función para actualizar contadores de estados
function updateStatusCounters(statusBreakdown) {
    const statuses = ['completed', 'delivered', 'processing', 'on-hold', 'pending'];
    
    statuses.forEach(status => {
        const countEl = document.getElementById(`count-${status}`);
        if (countEl) {
            const count = statusBreakdown[status] || 0;
            countEl.textContent = count;
        }
    });
}

// Función para actualizar indicadores de período y estados activos
function updatePeriodIndicators(debugData) {
    // Actualizar indicador de período
    const periodDisplayEl = document.getElementById('active-period-display');
    if (periodDisplayEl && debugData.periodInfo) {
        periodDisplayEl.textContent = debugData.periodInfo.label;
    }
    
    // Actualizar estados activos
    const statusesDisplayEl = document.getElementById('active-statuses-display');
    if (statusesDisplayEl && debugData.activeFilters) {
        const statusNames = {
            'completed': 'Completadas',
            'delivered': 'Entregadas', 
            'processing': 'En Proceso',
            'on-hold': 'En Espera',
            'pending': 'Pendientes'
        };
        
        const activeNames = debugData.activeFilters.map(status => statusNames[status] || status);
        statusesDisplayEl.textContent = activeNames.join(', ');
    }
}

// PRESETS: Aplicar configuraciones predefinidas

function applyWooCommercePreset() {
    // Configuración que imita WooCommerce Analytics
    const statuses = ['completed', 'delivered', 'processing'];
    setStatusCheckboxes(statuses);
    updateOrderStatusFilter();
}

function applyConservativePreset() {
    // Solo órdenes completamente procesadas
    const statuses = ['completed', 'delivered'];
    setStatusCheckboxes(statuses);
    updateOrderStatusFilter();
}

function applyAllStatusPreset() {
    // Incluir todos los estados posibles
    const statuses = ['completed', 'delivered', 'processing', 'on-hold', 'pending'];
    setStatusCheckboxes(statuses);
    updateOrderStatusFilter();
}

// Función auxiliar para establecer checkboxes
function setStatusCheckboxes(activeStatuses) {
    const allStatuses = ['completed', 'delivered', 'processing', 'on-hold', 'pending'];
    
    allStatuses.forEach(status => {
        const checkbox = document.getElementById(`status-${status}`);
        if (checkbox) {
            checkbox.checked = activeStatuses.includes(status);
        }
    });
}

// Función modificada para cargar dashboard inicial con contadores
async function loadDashboardWithCounters() {
    // Primero cargar todos los datos para obtener contadores
    showLoading();
    
    try {
        const response = await fetch('/api/dashboard?status_filters=completed,delivered,processing,on-hold,pending');
        const result = await response.json();
        
        if (result.success) {
            // Actualizar contadores iniciales
            updateStatusCounters(result.debug.statusBreakdownAll);
        }
    } catch (error) {
        console.error('Error obteniendo contadores:', error);
    }
    
    // Luego cargar con filtros por defecto
    updateOrderStatusFilter();
}

// Auto-refresh cada 5 minutos (opcional)
setInterval(() => {
    if (document.visibilityState === 'visible' && dashboardData) {
        console.log('Auto-refreshing dashboard...');
        loadDashboard();
    }
}, 5 * 60 * 1000);