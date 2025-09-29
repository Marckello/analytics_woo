import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

// Types para Cloudflare bindings
type Bindings = {
  DB: D1Database;
  WOOCOMMERCE_URL: string;
  WOOCOMMERCE_CONSUMER_KEY: string;
  WOOCOMMERCE_CONSUMER_SECRET: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// Middleware CORS para APIs
app.use('/api/*', cors())

// Servir archivos estáticos
app.use('/static/*', serveStatic({ root: './public' }))

// Función para autenticar con WooCommerce
const getWooCommerceAuth = (env: Bindings) => {
  const credentials = btoa(`${env.WOOCOMMERCE_CONSUMER_KEY}:${env.WOOCOMMERCE_CONSUMER_SECRET}`)
  return {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json'
  }
}

// Función para obtener datos de WooCommerce
const fetchWooCommerceData = async (endpoint: string, env: Bindings, params?: string) => {
  const url = `${env.WOOCOMMERCE_URL}/wp-json/wc/v3/${endpoint}${params ? `?${params}` : ''}`
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getWooCommerceAuth(env)
    })
    
    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching WooCommerce data:', error)
    throw error
  }
}

// Función para consultar OpenAI
const queryOpenAI = async (prompt: string, context: string, env: Bindings) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Eres un asistente especializado en análisis de datos de WooCommerce para Adaptoheal. 
          Respondes preguntas sobre ventas, productos, clientes y órdenes basándote en los datos proporcionados.
          Siempre responde en español y de manera clara y directa.
          Si no tienes suficientes datos para responder, menciona qué información adicional necesitas.
          
          Contexto de datos disponibles:
          ${context}`
        },
        {
          role: 'user', 
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// API: Dashboard principal con métricas
app.get('/api/dashboard', async (c) => {
  const { env } = c
  
  try {
    // Calcular fecha de hace 30 días
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const dateFilter = thirtyDaysAgo.toISOString().split('T')[0]
    
    // Obtener órdenes de los últimos 30 días
    const orders = await fetchWooCommerceData(
      'orders', 
      env,
      `after=${dateFilter}&per_page=100&status=completed`
    )
    
    // Obtener productos más vendidos
    const products = await fetchWooCommerceData(
      'products',
      env, 
      'orderby=popularity&per_page=5'
    )
    
    // Calcular métricas
    const totalSales = orders.reduce((sum: number, order: any) => sum + parseFloat(order.total), 0)
    const avgTicket = orders.length > 0 ? totalSales / orders.length : 0
    
    // Top 5 órdenes más grandes
    const topOrders = orders
      .sort((a: any, b: any) => parseFloat(b.total) - parseFloat(a.total))
      .slice(0, 5)
      .map((order: any) => ({
        id: order.id,
        total: parseFloat(order.total),
        customer: `${order.billing.first_name} ${order.billing.last_name}`,
        date: order.date_created
      }))
    
    return c.json({
      success: true,
      data: {
        totalSales30Days: totalSales,
        avgTicket30Days: avgTicket,
        ordersCount30Days: orders.length,
        topProducts: products.slice(0, 5).map((product: any) => ({
          id: product.id,
          name: product.name,
          sales: product.total_sales || 0,
          price: parseFloat(product.price)
        })),
        topOrders
      }
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return c.json({ 
      success: false, 
      error: 'Error obteniendo datos del dashboard' 
    }, 500)
  }
})

// API: Chat con IA
app.post('/api/chat', async (c) => {
  const { env } = c
  const { message } = await c.req.json()
  
  if (!message) {
    return c.json({ success: false, error: 'Mensaje requerido' }, 400)
  }

  try {
    const startTime = Date.now()
    
    // Obtener datos recientes para contexto
    const [orders, products, customers] = await Promise.all([
      fetchWooCommerceData('orders', env, 'per_page=50&orderby=date&order=desc'),
      fetchWooCommerceData('products', env, 'per_page=20&orderby=popularity'),
      fetchWooCommerceData('customers', env, 'per_page=20&orderby=registered_date&order=desc')
    ])
    
    // Preparar contexto para la IA
    const context = `
    DATOS DE ÓRDENES (${orders.length} órdenes recientes):
    - Total de órdenes: ${orders.length}
    - Ventas totales: $${orders.reduce((sum: number, o: any) => sum + parseFloat(o.total), 0).toFixed(2)}
    - Ticket promedio: $${(orders.reduce((sum: number, o: any) => sum + parseFloat(o.total), 0) / orders.length).toFixed(2)}
    
    PRODUCTOS TOP (${products.length} productos):
    ${products.slice(0, 10).map((p: any) => `- ${p.name}: $${p.price}, Ventas: ${p.total_sales || 0}`).join('\\n')}
    
    CLIENTES (${customers.length} clientes):
    ${customers.slice(0, 5).map((c: any) => `- ${c.first_name} ${c.last_name}: ${c.email}, Gastado: $${c.total_spent || 0}`).join('\\n')}
    
    Fecha actual: ${new Date().toLocaleDateString('es-ES')}
    `
    
    const response = await queryOpenAI(message, context, env)
    const executionTime = Date.now() - startTime
    
    // Log de la consulta en D1 (si está disponible)
    try {
      await env.DB?.prepare(
        'INSERT INTO ai_queries_log (query, response, execution_time) VALUES (?, ?, ?)'
      ).bind(message, response, executionTime).run()
    } catch (dbError) {
      console.log('DB logging failed (expected in development):', dbError)
    }
    
    return c.json({
      success: true,
      data: {
        response,
        executionTime
      }
    })
    
  } catch (error) {
    console.error('Chat API error:', error)
    return c.json({
      success: false,
      error: 'Error procesando consulta con IA'
    }, 500)
  }
})

// API: Test de conexión WooCommerce
app.get('/api/test-woo', async (c) => {
  const { env } = c
  
  try {
    const data = await fetchWooCommerceData('system_status', env)
    return c.json({ success: true, woocommerce_connected: true, data })
  } catch (error) {
    return c.json({ 
      success: false, 
      error: 'Error conectando con WooCommerce API',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// Ruta principal con el dashboard
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Adaptoheal Analytics - Dashboard Inteligente</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    </head>
    <body class="bg-gray-50 min-h-screen">
        <div class="container mx-auto px-4 py-8">
            <!-- Header -->
            <header class="mb-8">
                <div class="bg-white rounded-lg shadow-lg p-6">
                    <h1 class="text-3xl font-bold text-gray-800 flex items-center">
                        <i class="fas fa-chart-line mr-3 text-blue-600"></i>
                        Adaptoheal Analytics
                    </h1>
                    <p class="text-gray-600 mt-2">Dashboard inteligente con IA para tu tienda WooCommerce</p>
                </div>
            </header>

            <!-- Loading State -->
            <div id="loading" class="flex justify-center items-center py-12">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <span class="ml-3 text-gray-600">Cargando datos...</span>
            </div>

            <!-- Dashboard Content -->
            <div id="dashboard" class="hidden">
                <!-- KPIs Row -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div class="bg-white p-6 rounded-lg shadow-lg">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600">Ventas (30 días)</p>
                                <p id="total-sales" class="text-2xl font-bold text-green-600">$0</p>
                            </div>
                            <i class="fas fa-dollar-sign text-3xl text-green-600"></i>
                        </div>
                    </div>

                    <div class="bg-white p-6 rounded-lg shadow-lg">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600">Ticket Promedio</p>
                                <p id="avg-ticket" class="text-2xl font-bold text-blue-600">$0</p>
                            </div>
                            <i class="fas fa-receipt text-3xl text-blue-600"></i>
                        </div>
                    </div>

                    <div class="bg-white p-6 rounded-lg shadow-lg">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600">Órdenes</p>
                                <p id="orders-count" class="text-2xl font-bold text-purple-600">0</p>
                            </div>
                            <i class="fas fa-shopping-cart text-3xl text-purple-600"></i>
                        </div>
                    </div>

                    <div class="bg-white p-6 rounded-lg shadow-lg">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600">Estado</p>
                                <p id="connection-status" class="text-sm font-bold text-green-600">
                                    <i class="fas fa-check-circle mr-1"></i>Conectado
                                </p>
                            </div>
                            <i class="fas fa-plug text-3xl text-green-600"></i>
                        </div>
                    </div>
                </div>

                <!-- Charts and Tables Row -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <!-- Top Products -->
                    <div class="bg-white p-6 rounded-lg shadow-lg">
                        <h2 class="text-xl font-bold text-gray-800 mb-4">
                            <i class="fas fa-trophy mr-2 text-yellow-500"></i>
                            Top 5 Productos
                        </h2>
                        <div id="top-products" class="space-y-3">
                            <!-- Dynamic content -->
                        </div>
                    </div>

                    <!-- Top Orders -->
                    <div class="bg-white p-6 rounded-lg shadow-lg">
                        <h2 class="text-xl font-bold text-gray-800 mb-4">
                            <i class="fas fa-award mr-2 text-green-500"></i>
                            Top 5 Órdenes
                        </h2>
                        <div id="top-orders" class="space-y-3">
                            <!-- Dynamic content -->
                        </div>
                    </div>
                </div>

                <!-- AI Chat Section -->
                <div class="bg-white rounded-lg shadow-lg p-6">
                    <h2 class="text-xl font-bold text-gray-800 mb-4">
                        <i class="fas fa-robot mr-2 text-indigo-600"></i>
                        Consulta con IA
                    </h2>
                    <p class="text-gray-600 mb-4">
                        Pregúntame cualquier cosa sobre tus datos de ventas. Ejemplos:
                        "¿Cuánto vendimos ayer?", "¿Cuál es el cliente que más ha comprado?", "¿Qué producto es más popular?"
                    </p>
                    
                    <!-- Chat Messages -->
                    <div id="chat-messages" class="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto mb-4">
                        <div class="text-center text-gray-500 text-sm">
                            <i class="fas fa-comments mr-1"></i>
                            ¡Haz tu primera pregunta para empezar!
                        </div>
                    </div>

                    <!-- Chat Input -->
                    <div class="flex gap-2">
                        <input 
                            id="chat-input" 
                            type="text" 
                            placeholder="Escribe tu pregunta aquí..."
                            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onkeypress="handleChatKeyPress(event)"
                        >
                        <button 
                            id="chat-send" 
                            onclick="sendChatMessage()" 
                            class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                            disabled
                        >
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Error State -->
            <div id="error" class="hidden bg-red-50 border border-red-200 rounded-lg p-6">
                <div class="flex items-center">
                    <i class="fas fa-exclamation-triangle text-red-600 mr-3"></i>
                    <div>
                        <h3 class="text-red-800 font-medium">Error de Conexión</h3>
                        <p class="text-red-600 text-sm mt-1">No se pudo conectar con la API de WooCommerce. Verifica la configuración.</p>
                    </div>
                </div>
            </div>
        </div>

        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app