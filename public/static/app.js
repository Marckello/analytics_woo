// Adaptoheal Analytics - Frontend JavaScript (Modern Version)
let dashboardData = null;
let chatEnabled = false;

// Función para sugerencias rápidas
function askSuggestion(question) {
    const inputEl = document.getElementById('chat-input');
    inputEl.value = question;
    inputEl.focus();
}

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
        messageEl.innerHTML = `
            <div class="flex items-start space-x-3">
                <div class="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-indigo-600 to-purple-700 rounded-full flex items-center justify-center">
                    <i class="fas fa-brain text-xs text-white"></i>
                </div>
                <div class="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-200 max-w-md">
                    <div class="flex items-start justify-between mb-2">
                        <span class="text-xs font-medium text-indigo-600">Adaptoheal IA</span>
                        <span class="text-xs text-gray-400">${timestamp}</span>
                    </div>
                    <p class="text-sm text-gray-800 leading-relaxed">${message}</p>
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

// Auto-refresh cada 5 minutos (opcional)
setInterval(() => {
    if (document.visibilityState === 'visible' && dashboardData) {
        console.log('Auto-refreshing dashboard...');
        loadDashboard();
    }
}, 5 * 60 * 1000);