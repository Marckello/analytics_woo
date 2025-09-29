// Adaptoheal Analytics - Frontend JavaScript
let dashboardData = null;
let chatEnabled = false;

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', async function() {
    await loadDashboard();
});

// Cargar datos del dashboard
async function loadDashboard() {
    const loadingEl = document.getElementById('loading');
    const dashboardEl = document.getElementById('dashboard');
    const errorEl = document.getElementById('error');
    
    try {
        // Test conexión WooCommerce
        const testResponse = await axios.get('/api/test-woo');
        console.log('WooCommerce connection test:', testResponse.data);
        
        // Cargar dashboard
        const response = await axios.get('/api/dashboard');
        
        if (response.data.success) {
            dashboardData = response.data.data;
            renderDashboard();
            loadingEl.classList.add('hidden');
            dashboardEl.classList.remove('hidden');
            chatEnabled = true;
            
            // Habilitar chat
            document.getElementById('chat-send').disabled = false;
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

// Renderizar datos del dashboard
function renderDashboard() {
    if (!dashboardData) return;
    
    // KPIs
    document.getElementById('total-sales').textContent = 
        `$${dashboardData.totalSales30Days.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
    
    document.getElementById('avg-ticket').textContent = 
        `$${dashboardData.avgTicket30Days.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
    
    document.getElementById('orders-count').textContent = 
        dashboardData.ordersCount30Days.toLocaleString('es-MX');
    
    // Top Products
    const topProductsEl = document.getElementById('top-products');
    topProductsEl.innerHTML = '';
    
    dashboardData.topProducts.forEach((product, index) => {
        const productEl = document.createElement('div');
        productEl.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
        productEl.innerHTML = `
            <div class="flex items-center">
                <span class="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full mr-3">
                    ${index + 1}
                </span>
                <div>
                    <p class="font-medium text-gray-800">${product.name}</p>
                    <p class="text-sm text-gray-600">$${product.price.toFixed(2)}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="font-bold text-blue-600">${product.sales}</p>
                <p class="text-xs text-gray-500">ventas</p>
            </div>
        `;
        topProductsEl.appendChild(productEl);
    });
    
    // Top Orders
    const topOrdersEl = document.getElementById('top-orders');
    topOrdersEl.innerHTML = '';
    
    dashboardData.topOrders.forEach((order, index) => {
        const orderEl = document.createElement('div');
        orderEl.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
        
        const orderDate = new Date(order.date).toLocaleDateString('es-MX');
        
        orderEl.innerHTML = `
            <div class="flex items-center">
                <span class="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full mr-3">
                    ${index + 1}
                </span>
                <div>
                    <p class="font-medium text-gray-800">#${order.id}</p>
                    <p class="text-sm text-gray-600">${order.customer}</p>
                    <p class="text-xs text-gray-500">${orderDate}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="font-bold text-green-600">$${order.total.toFixed(2)}</p>
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
            <div class="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg max-w-xs">
                <p class="text-sm">${message}</p>
                <p class="text-xs opacity-75 mt-1">${timestamp}</p>
            </div>
        `;
    } else if (type === 'ai') {
        messageEl.className = 'mb-3';
        messageEl.innerHTML = `
            <div class="flex items-start">
                <div class="bg-indigo-600 text-white rounded-full p-2 mr-3">
                    <i class="fas fa-robot text-sm"></i>
                </div>
                <div class="bg-gray-200 px-4 py-2 rounded-lg max-w-md">
                    <p class="text-sm text-gray-800">${message}</p>
                    <p class="text-xs text-gray-600 mt-1">${timestamp}</p>
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

// Auto-refresh cada 5 minutos (opcional)
setInterval(() => {
    if (document.visibilityState === 'visible' && dashboardData) {
        console.log('Auto-refreshing dashboard...');
        loadDashboard();
    }
}, 5 * 60 * 1000);