// Ultra-simple Node.js server for EasyPanel
const http = require('http');

const PORT = process.env.PORT || 3000;

// Simple HTML response
const htmlResponse = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard AdaptoHeal</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 p-8">
    <div class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold text-gray-800 mb-6">🚀 Dashboard AdaptoHeal</h1>
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold mb-4">✅ Server Running Successfully!</h2>
            <p class="text-gray-600 mb-4">EasyPanel deployment is working correctly.</p>
            
            <div class="grid grid-cols-2 gap-4 mt-6">
                <div class="bg-blue-50 p-4 rounded">
                    <h3 class="font-semibold text-blue-800">Environment</h3>
                    <p class="text-blue-600">Production</p>
                </div>
                <div class="bg-green-50 p-4 rounded">
                    <h3 class="font-semibold text-green-800">Status</h3>
                    <p class="text-green-600">Online</p>
                </div>
            </div>
            
            <div class="mt-6 p-4 bg-gray-50 rounded">
                <h3 class="font-semibold mb-2">Available APIs:</h3>
                <ul class="space-y-1 text-sm">
                    <li>GET /health - Health check</li>
                    <li>GET /api/test - API test endpoint</li>
                </ul>
            </div>
        </div>
    </div>
</body>
</html>
`;

// Create server
const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Routes
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            port: PORT 
        }));
    } else if (req.url === '/api/test') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            message: 'API is working!',
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString()
        }));
    } else {
        // Serve main page
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(htmlResponse);
    }
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Error handling
server.on('error', (err) => {
    console.error('❌ Server error:', err);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled rejection:', err);
    process.exit(1);
});