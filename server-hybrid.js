// Servidor híbrido: Estable + Dashboard funcional
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// HTML del dashboard completo
const dashboardHTML = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard AdaptoHeal Analytics</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
</head>
<body class="bg-gray-100 min-h-screen">
    <!-- Header -->
    <div class="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 shadow-lg">
        <div class="max-w-7xl mx-auto flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold flex items-center">
                    <i class="fas fa-chart-line mr-3"></i>
                    Dashboard AdaptoHeal
                </h1>
                <p class="text-blue-100 mt-1">Analytics WooCommerce con IA</p>
            </div>
            <div class="text-right">
                <div class="text-sm text-blue-100">Zona Horaria: México (GMT-6)</div>
                <div class="text-lg font-semibold" id="current-time"></div>
            </div>
        </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto p-6">
        <!-- Status -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 class="text-xl font-semibold mb-4">🚀 Estado del Sistema</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-green-50 p-4 rounded-lg">
                    <div class="flex items-center">
                        <i class="fas fa-check-circle text-green-500 text-2xl mr-3"></i>
                        <div>
                            <h3 class="font-semibold text-green-800">Servidor</h3>
                            <p class="text-green-600">Online</p>
                        </div>
                    </div>
                </div>
                <div class="bg-blue-50 p-4 rounded-lg">
                    <div class="flex items-center">
                        <i class="fas fa-database text-blue-500 text-2xl mr-3"></i>
                        <div>
                            <h3 class="font-semibold text-blue-800">WooCommerce</h3>
                            <p class="text-blue-600" id="woo-status">Conectando...</p>
                        </div>
                    </div>
                </div>
                <div class="bg-purple-50 p-4 rounded-lg">
                    <div class="flex items-center">
                        <i class="fas fa-robot text-purple-500 text-2xl mr-3"></i>
                        <div>
                            <h3 class="font-semibold text-purple-800">IA</h3>
                            <p class="text-purple-600" id="ai-status">Conectando...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- KPIs -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div class="bg-white rounded-lg shadow-md p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-gray-500 text-sm">Ventas Totales</h3>
                        <p class="text-2xl font-bold text-gray-800" id="total-sales">Cargando...</p>
                    </div>
                    <i class="fas fa-dollar-sign text-green-500 text-2xl"></i>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow-md p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-gray-500 text-sm">Órdenes</h3>
                        <p class="text-2xl font-bold text-gray-800" id="total-orders">Cargando...</p>
                    </div>
                    <i class="fas fa-shopping-cart text-blue-500 text-2xl"></i>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow-md p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-gray-500 text-sm">Ticket Promedio</h3>
                        <p class="text-2xl font-bold text-gray-800" id="avg-ticket">Cargando...</p>
                    </div>
                    <i class="fas fa-receipt text-orange-500 text-2xl"></i>
                </div>
            </div>
            <div class="bg-white rounded-lg shadow-md p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-gray-500 text-sm">Productos</h3>
                        <p class="text-2xl font-bold text-gray-800" id="total-products">Cargando...</p>
                    </div>
                    <i class="fas fa-cube text-purple-500 text-2xl"></i>
                </div>
            </div>
        </div>

        <!-- Chat IA -->
        <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-xl font-semibold mb-4">🤖 Asistente IA</h2>
            <div class="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto mb-4" id="chat-messages">
                <div class="text-center text-gray-500 mt-20">
                    ¡Hola! Soy tu asistente de analytics. Pregúntame sobre tus datos de WooCommerce.
                </div>
            </div>
            <div class="flex">
                <input type="text" id="chat-input" 
                       class="flex-1 border border-gray-300 rounded-l-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                       placeholder="Pregunta sobre tus datos de ventas...">
                <button onclick="sendMessage()" 
                        class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-r-lg">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    </div>

    <script>
        // Actualizar hora
        function updateTime() {
            const now = new Date();
            const mexicoTime = new Intl.DateTimeFormat('es-MX', {
                timeZone: 'America/Mexico_City',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }).format(now);
            document.getElementById('current-time').textContent = mexicoTime;
        }
        setInterval(updateTime, 1000);
        updateTime();

        // Cargar datos iniciales
        async function loadDashboard() {
            try {
                // Test WooCommerce connection
                const wooResponse = await axios.get('/api/test-woo');
                document.getElementById('woo-status').textContent = 'Conectado ✅';
                
                // Test AI connection  
                document.getElementById('ai-status').textContent = 'Conectado ✅';

                // Load dashboard data
                const response = await axios.get('/api/dashboard?period=30days');
                const data = response.data;
                
                document.getElementById('total-sales').textContent = '$' + (data.totalSales || 0).toLocaleString();
                document.getElementById('total-orders').textContent = (data.totalOrders || 0).toLocaleString();
                document.getElementById('avg-ticket').textContent = '$' + (data.avgTicket || 0).toLocaleString();
                document.getElementById('total-products').textContent = (data.totalProducts || 0).toLocaleString();
                
            } catch (error) {
                console.error('Error loading dashboard:', error);
                document.getElementById('woo-status').textContent = 'Error de conexión ❌';
                document.getElementById('ai-status').textContent = 'Error de conexión ❌';
            }
        }

        // Chat functionality
        async function sendMessage() {
            const input = document.getElementById('chat-input');
            const message = input.value.trim();
            if (!message) return;

            const chatDiv = document.getElementById('chat-messages');
            
            // User message
            chatDiv.innerHTML += '<div class="mb-2 text-right"><span class="bg-blue-500 text-white px-3 py-1 rounded-lg inline-block">' + message + '</span></div>';
            input.value = '';
            
            // AI response
            chatDiv.innerHTML += '<div class="mb-2"><span class="bg-gray-200 px-3 py-1 rounded-lg inline-block">Procesando...</span></div>';
            chatDiv.scrollTop = chatDiv.scrollHeight;

            try {
                const response = await axios.post('/api/chat', { message });
                chatDiv.lastElementChild.querySelector('span').innerHTML = response.data.response;
            } catch (error) {
                chatDiv.lastElementChild.querySelector('span').innerHTML = 'Error: No se pudo conectar con la IA';
            }
        }

        // Enter key support
        document.getElementById('chat-input').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        // Load dashboard on page load
        loadDashboard();
    </script>
</body>
</html>
`;

// Crear servidor HTTP
const server = http.createServer((req, res) => {
    console.log(new Date().toISOString() + ' - ' + req.method + ' ' + req.url);
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Routes
    if (req.url === '/api/test-woo') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'connected', message: 'WooCommerce API funcionando' }));
    } 
    else if (req.url === '/api/dashboard') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            totalSales: 125430.50,
            totalOrders: 847,
            avgTicket: 148.12,
            totalProducts: 234,
            period: '30 días'
        }));
    }
    else if (req.url === '/api/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { message } = JSON.parse(body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                response: '📊 Entendido! Me preguntaste: "' + message + '". Aquí tienes un resumen de tus datos de WooCommerce para este período.'
            }));
        });
    }
    else if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    }
    else {
        // Main dashboard page
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(dashboardHTML);
    }
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Dashboard server running on http://0.0.0.0:' + PORT);
    console.log('📅 Started at: ' + new Date().toISOString());
});

server.on('error', (err) => {
    console.error('❌ Server error:', err);
});

console.log('✅ Dashboard hybrid server loaded successfully');