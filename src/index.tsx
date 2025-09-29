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

// Función para obtener fechas en zona horaria de México
const getMexicoDate = () => {
  const now = new Date()
  const mexicoTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Mexico_City"}))
  return mexicoTime
}

// Función para parsear fechas relativas
const parseRelativeDate = (query: string, mexicoNow: Date) => {
  const today = new Date(mexicoNow)
  const yesterday = new Date(mexicoNow)
  yesterday.setDate(yesterday.getDate() - 1)
  
  // Crear mapeo de días de la semana
  const daysMap: Record<string, number> = {
    'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3, 
    'jueves': 4, 'viernes': 5, 'sábado': 6
  }
  
  let targetDate: Date | null = null
  let dateDescription = ""
  
  if (/\bhoy\b/i.test(query)) {
    targetDate = today
    dateDescription = `HOY (${today.toLocaleDateString('es-MX')})`
  } else if (/\bayer\b/i.test(query)) {
    targetDate = yesterday  
    dateDescription = `AYER (${yesterday.toLocaleDateString('es-MX')})`
  } else if (/\b(el\s+)?(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/i.test(query)) {
    const dayMatch = query.match(/\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/i)
    if (dayMatch) {
      const dayName = dayMatch[1].toLowerCase()
      const targetDay = daysMap[dayName]
      const currentDay = today.getDay()
      
      // Calcular cuántos días atrás está ese día de la semana
      let daysAgo = (currentDay - targetDay + 7) % 7
      if (daysAgo === 0) daysAgo = 7 // Si es el mismo día, tomar la semana pasada
      
      targetDate = new Date(today)
      targetDate.setDate(targetDate.getDate() - daysAgo)
      dateDescription = `${dayName.toUpperCase()} (${targetDate.toLocaleDateString('es-MX')})`
    }
  }
  
  return { targetDate, dateDescription }
}

// Función para consultar OpenAI con manejo de fechas inteligente
const queryOpenAI = async (prompt: string, context: string, env: Bindings) => {
  const mexicoNow = getMexicoDate()
  const currentDate = mexicoNow.toLocaleDateString('es-MX', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  })
  
  const currentTime = mexicoNow.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit'
  })
  
  // Parsear fecha relativa si existe
  const { targetDate, dateDescription } = parseRelativeDate(prompt, mexicoNow)
  
  let dateContext = ""
  if (targetDate) {
    dateContext = `\n\n🗓️ CONSULTA ESPECÍFICA DE FECHA: ${dateDescription}
    - Buscar datos específicos de esta fecha
    - Si no hay datos de esa fecha exacta, mencionarlo claramente
    - Comparar con datos disponibles cuando sea relevante`
  }
  
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
          content: `Eres un analista de datos especializado en WooCommerce para Adaptoheal México, empresa de suplementos alimenticios.

🇲🇽 INFORMACIÓN TEMPORAL (ZONA HORARIA MÉXICO):
- Fecha y hora actual: ${currentDate}, ${currentTime}
- Año actual: 2025
- Zona horaria: America/Mexico_City (GMT-6)
- Solo tienes datos de AGOSTO y SEPTIEMBRE 2025

📊 DATOS DISPONIBLES:
${context}${dateContext}

🎯 INSTRUCCIONES PARA FECHAS RELATIVAS:
- "HOY" = ${mexicoNow.toLocaleDateString('es-MX')} (busca datos de esta fecha exacta)
- "AYER" = ${new Date(mexicoNow.getTime() - 24*60*60*1000).toLocaleDateString('es-MX')}
- "EL MARTES/LUNES/etc." = El último día de esa semana dentro del período disponible
- Si preguntan por fechas fuera de agosto-septiembre 2025, explica limitaciones
- Si no hay datos de la fecha específica, sugiere la fecha más cercana con datos

💰 FORMATO DE RESPUESTAS:
- Dinero: $1,234.56 MXN
- Fechas: DD/MM/YYYY (formato mexicano)
- Sé específico y directo
- Proporciona insights de marketing cuando sea relevante
- Si no hay datos exactos de la fecha pedida, sé transparente

Responde como experto en e-commerce de suplementos con conocimiento del mercado mexicano.`
        },
        {
          role: 'user', 
          content: prompt
        }
      ],
      max_tokens: 600,
      temperature: 0.3
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
    // Filtrar solo Agosto y Septiembre 2025
    const augustStart = new Date('2025-08-01T00:00:00Z').toISOString()
    const septemberEnd = new Date('2025-09-30T23:59:59Z').toISOString()
    
    // Obtener órdenes de Agosto-Septiembre 2025 solamente
    const orders = await fetchWooCommerceData(
      'orders', 
      env,
      `after=${augustStart}&before=${septemberEnd}&per_page=100&status=completed`
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
    
    // Obtener datos específicos de agosto-septiembre 2025 para contexto
    const augustStart = new Date('2025-08-01T00:00:00Z').toISOString()
    const septemberEnd = new Date('2025-09-30T23:59:59Z').toISOString()
    
    const [orders, products, customers] = await Promise.all([
      fetchWooCommerceData('orders', env, `after=${augustStart}&before=${septemberEnd}&per_page=100&status=completed`),
      fetchWooCommerceData('products', env, 'per_page=20&orderby=popularity'),
      fetchWooCommerceData('customers', env, 'per_page=20&orderby=registered_date&order=desc')
    ])
    
    // Calcular métricas detalladas
    const totalSales = orders.reduce((sum: number, o: any) => sum + parseFloat(o.total), 0)
    const avgTicket = orders.length > 0 ? totalSales / orders.length : 0
    
    // Análisis por mes (corrección de timezone)
    const augustOrders = orders.filter((o: any) => {
      const date = new Date(o.date_created)
      const month = date.getMonth()
      const year = date.getFullYear()
      return year === 2025 && month === 7 // Agosto = mes 7 (0-indexed)
    })
    const septemberOrders = orders.filter((o: any) => {
      const date = new Date(o.date_created)
      const month = date.getMonth()  
      const year = date.getFullYear()
      return year === 2025 && month === 8 // Septiembre = mes 8 (0-indexed)
    })
    
    const augustSales = augustOrders.reduce((sum: number, o: any) => sum + parseFloat(o.total), 0)
    const septemberSales = septemberOrders.reduce((sum: number, o: any) => sum + parseFloat(o.total), 0)
    
    // Top clientes del período
    const customerSales = new Map()
    orders.forEach((order: any) => {
      const customerName = `${order.billing.first_name} ${order.billing.last_name}`.trim()
      const currentTotal = customerSales.get(customerName) || 0
      customerSales.set(customerName, currentTotal + parseFloat(order.total))
    })
    const topCustomers = Array.from(customerSales.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    
    // Organizar datos por fechas específicas para consultas de "hoy", "ayer", etc.
    const ordersByDate = new Map<string, any[]>()
    const salesByDate = new Map<string, number>()
    
    orders.forEach((order: any) => {
      const orderDate = new Date(order.date_created).toLocaleDateString('es-MX')
      if (!ordersByDate.has(orderDate)) {
        ordersByDate.set(orderDate, [])
        salesByDate.set(orderDate, 0)
      }
      ordersByDate.get(orderDate)!.push(order)
      salesByDate.set(orderDate, salesByDate.get(orderDate)! + parseFloat(order.total))
    })
    
    // Preparar resumen de fechas recientes (últimos 7 días con datos)
    const recentDatesData = Array.from(salesByDate.entries())
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .slice(0, 7)
      .map(([date, sales]) => ({
        fecha: date,
        ordenes: ordersByDate.get(date)!.length,
        ventas: sales
      }))
    
    // Preparar contexto detallado para la IA
    const context = `
    PERÍODO DE DATOS: AGOSTO - SEPTIEMBRE 2025 EXCLUSIVAMENTE
    
    RESUMEN GENERAL (Período completo):
    - Total órdenes: ${orders.length}
    - Ventas totales: $${totalSales.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN
    - Ticket promedio: $${avgTicket.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN
    
    📅 DATOS POR FECHAS RECIENTES (para consultas de "hoy", "ayer", etc.):
    ${recentDatesData.map(d => 
      `- ${d.fecha}: ${d.ordenes} órdenes, $${d.ventas.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN`
    ).join('\\n')}
    
    ANÁLISIS DETALLADO POR MES:
    
    📊 AGOSTO 2025:
    - Órdenes completadas: ${augustOrders.length}
    - Ventas totales: $${augustSales.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN
    - Ticket promedio: $${augustOrders.length > 0 ? (augustSales/augustOrders.length).toLocaleString('es-MX', {minimumFractionDigits: 2}) : '0.00'} MXN
    ${augustOrders.length > 0 ? `- Orden más alta agosto: $${Math.max(...augustOrders.map((o: any) => parseFloat(o.total))).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN` : ''}
    
    📊 SEPTIEMBRE 2025:
    - Órdenes completadas: ${septemberOrders.length}  
    - Ventas totales: $${septemberSales.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN
    - Ticket promedio: $${septemberOrders.length > 0 ? (septemberSales/septemberOrders.length).toLocaleString('es-MX', {minimumFractionDigits: 2}) : '0.00'} MXN
    ${septemberOrders.length > 0 ? `- Orden más alta septiembre: $${Math.max(...septemberOrders.map((o: any) => parseFloat(o.total))).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN` : ''}
    
    📈 COMPARATIVA:
    - Diferencia en ventas: ${septemberSales > augustSales ? '+' : ''}$${(septemberSales - augustSales).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN (${((septemberSales - augustSales) / (augustSales || 1) * 100).toFixed(1)}%)
    - Diferencia en órdenes: ${septemberOrders.length - augustOrders.length} órdenes
    - Mes con mejor performance: ${septemberSales > augustSales ? 'Septiembre' : 'Agosto'} 2025
    
    TOP 5 PRODUCTOS MÁS VENDIDOS:
    ${products.slice(0, 5).map((p: any, i: number) => 
      `${i+1}. ${p.name}: ${p.total_sales || 0} ventas totales, Precio: $${parseFloat(p.price).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN`
    ).join('\\n')}
    
    TOP 5 CLIENTES (por compras en el período):
    ${topCustomers.map((c: any, i: number) => 
      `${i+1}. ${c[0]}: $${c[1].toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN`
    ).join('\\n')}
    
    ÓRDENES MÁS GRANDES DEL PERÍODO:
    ${orders.sort((a: any, b: any) => parseFloat(b.total) - parseFloat(a.total))
      .slice(0, 5)
      .map((o: any, i: number) => 
        `${i+1}. Orden #${o.id}: $${parseFloat(o.total).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN - ${o.billing.first_name} ${o.billing.last_name} (${new Date(o.date_created).toLocaleDateString('es-MX')})`
      ).join('\\n')}
    
    PRODUCTOS ADAPTOHEAL:
    ${products.slice(0, 10).map((p: any) => `- ${p.name}: Stock ${p.stock_quantity || 'N/A'}, Precio $${parseFloat(p.price).toFixed(2)} MXN`).join('\\n')}
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
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  'adaptoheal': {
                    50: '#f0f9ff',
                    100: '#e0f2fe', 
                    500: '#0ea5e9',
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c4a6e'
                  }
                }
              }
            }
          }
        </script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          body { font-family: 'Inter', sans-serif; }
          .glass-effect { 
            background: rgba(255, 255, 255, 0.8); 
            backdrop-filter: blur(10px); 
            border: 1px solid rgba(255, 255, 255, 0.2); 
          }
          .gradient-bg { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          }
          .card-hover { 
            transition: all 0.3s ease; 
          }
          .card-hover:hover { 
            transform: translateY(-4px); 
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); 
          }
          .pulse-dot {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: .5; }
          }
        </style>
    </head>
    <body class="bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
        <!-- Modern Header with Gradient -->
        <div class="gradient-bg shadow-xl">
            <div class="container mx-auto px-6 py-8">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                        <img src="https://www.adaptohealmx.com/wp-content/uploads/2025/05/Logo1-300x86.webp" 
                             alt="Adaptoheal México" 
                             class="h-12 w-auto">
                        <div>
                            <h1 class="text-3xl font-bold text-white">Analytics Dashboard</h1>
                            <p class="text-blue-100 mt-1">Datos Agosto - Septiembre 2025 | Análisis Inteligente</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <div class="pulse-dot w-3 h-3 bg-green-400 rounded-full"></div>
                        <span class="text-white text-sm font-medium">En vivo</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="container mx-auto px-6 py-8 -mt-4">

            <!-- Modern Loading State -->
            <div id="loading" class="flex flex-col justify-center items-center py-16">
                <div class="relative">
                    <div class="animate-spin rounded-full h-16 w-16 border-4 border-blue-200"></div>
                    <div class="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent absolute top-0"></div>
                </div>
                <div class="mt-6 text-center">
                    <p class="text-lg font-medium text-gray-700">Conectando con WooCommerce</p>
                    <p class="text-sm text-gray-500 mt-2">Analizando datos de Agosto - Septiembre 2025...</p>
                </div>
            </div>

            <!-- Modern Dashboard Content -->
            <div id="dashboard" class="hidden space-y-8">
                <!-- Modern KPIs Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <!-- Ventas Card -->
                    <div class="glass-effect rounded-xl p-6 card-hover">
                        <div class="flex items-center justify-between mb-4">
                            <div class="p-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600">
                                <i class="fas fa-chart-line text-xl text-white"></i>
                            </div>
                            <span class="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">AGO-SEP</span>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-600 mb-1">Ventas Totales</p>
                            <p id="total-sales" class="text-2xl font-bold text-gray-900">$0</p>
                            <p class="text-xs text-gray-500 mt-1">Últimos 30 días</p>
                        </div>
                    </div>

                    <!-- Ticket Promedio Card -->
                    <div class="glass-effect rounded-xl p-6 card-hover">
                        <div class="flex items-center justify-between mb-4">
                            <div class="p-3 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-600">
                                <i class="fas fa-receipt text-xl text-white"></i>
                            </div>
                            <span class="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">PROMEDIO</span>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-600 mb-1">Ticket Promedio</p>
                            <p id="avg-ticket" class="text-2xl font-bold text-gray-900">$0</p>
                            <p class="text-xs text-gray-500 mt-1">Por orden completada</p>
                        </div>
                    </div>

                    <!-- Órdenes Card -->
                    <div class="glass-effect rounded-xl p-6 card-hover">
                        <div class="flex items-center justify-between mb-4">
                            <div class="p-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600">
                                <i class="fas fa-shopping-bag text-xl text-white"></i>
                            </div>
                            <span class="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">TOTAL</span>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-600 mb-1">Órdenes Completadas</p>
                            <p id="orders-count" class="text-2xl font-bold text-gray-900">0</p>
                            <p class="text-xs text-gray-500 mt-1">Últimos 30 días</p>
                        </div>
                    </div>

                    <!-- Estado Card -->
                    <div class="glass-effect rounded-xl p-6 card-hover">
                        <div class="flex items-center justify-between mb-4">
                            <div class="p-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600">
                                <i class="fas fa-wifi text-xl text-white"></i>
                            </div>
                            <div class="flex items-center space-x-1">
                                <div class="w-2 h-2 bg-green-500 rounded-full pulse-dot"></div>
                                <span class="text-xs font-medium text-green-600">LIVE</span>
                            </div>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-600 mb-1">Conexión API</p>
                            <p id="connection-status" class="text-lg font-bold text-green-600">
                                <i class="fas fa-check-circle mr-1"></i>Conectado
                            </p>
                            <p class="text-xs text-gray-500 mt-1">WooCommerce API v3</p>
                        </div>
                    </div>
                </div>

                <!-- Modern Analytics Grid -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- Top Products Card -->
                    <div class="glass-effect rounded-xl p-8 card-hover">
                        <div class="flex items-center justify-between mb-6">
                            <div class="flex items-center space-x-3">
                                <div class="p-2 rounded-lg bg-gradient-to-r from-yellow-400 to-orange-500">
                                    <i class="fas fa-crown text-lg text-white"></i>
                                </div>
                                <div>
                                    <h2 class="text-xl font-bold text-gray-800">Top 5 Productos</h2>
                                    <p class="text-sm text-gray-500">Más vendidos (Ago-Sep 2025)</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <span class="text-xs font-medium text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">
                                    <i class="fas fa-fire mr-1"></i>HOT
                                </span>
                            </div>
                        </div>
                        <div id="top-products" class="space-y-4">
                            <!-- Dynamic content -->
                        </div>
                    </div>

                    <!-- Top Orders Card -->
                    <div class="glass-effect rounded-xl p-8 card-hover">
                        <div class="flex items-center justify-between mb-6">
                            <div class="flex items-center space-x-3">
                                <div class="p-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600">
                                    <i class="fas fa-medal text-lg text-white"></i>
                                </div>
                                <div>
                                    <h2 class="text-xl font-bold text-gray-800">Top 5 Órdenes</h2>
                                    <p class="text-sm text-gray-500">Mayor valor (Ago-Sep 2025)</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <span class="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                                    <i class="fas fa-dollar-sign mr-1"></i>VIP
                                </span>
                            </div>
                        </div>
                        <div id="top-orders" class="space-y-4">
                            <!-- Dynamic content -->
                        </div>
                    </div>
                </div>

                <!-- Modern AI Chat Section -->
                <div class="glass-effect rounded-xl overflow-hidden">
                    <!-- Chat Header -->
                    <div class="bg-gradient-to-r from-indigo-600 to-purple-700 p-6">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-3">
                                <div class="p-2 rounded-lg bg-white/20 backdrop-blur">
                                    <i class="fas fa-brain text-xl text-white"></i>
                                </div>
                                <div>
                                    <h2 class="text-xl font-bold text-white">Consulta con IA</h2>
                                    <p class="text-indigo-100 text-sm">Analista especializado en datos de Adaptoheal</p>
                                </div>
                            </div>
                            <div class="flex items-center space-x-2">
                                <div class="w-2 h-2 bg-green-400 rounded-full pulse-dot"></div>
                                <span class="text-white text-xs font-medium">GPT-4o-mini</span>
                            </div>
                        </div>
                    </div>

                    <!-- Chat Body -->
                    <div class="p-6">
                        <!-- Suggestion Pills -->
                        <div class="mb-6">
                            <p class="text-sm font-medium text-gray-600 mb-3">Consultas sugeridas:</p>
                            <div class="flex flex-wrap gap-2">
                                <button onclick="askSuggestion('¿Cuánto vendimos hoy?')" 
                                        class="px-3 py-1 text-xs bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full hover:shadow-lg transition-all transform hover:scale-105">
                                    <i class="fas fa-clock mr-1"></i>Hoy
                                </button>
                                <button onclick="askSuggestion('¿Cuál fue el producto más vendido ayer?')" 
                                        class="px-3 py-1 text-xs bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-full hover:shadow-lg transition-all transform hover:scale-105">
                                    <i class="fas fa-calendar-day mr-1"></i>Ayer
                                </button>
                                <button onclick="askSuggestion('¿Cuántas órdenes se hicieron el martes?')" 
                                        class="px-3 py-1 text-xs bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-full hover:shadow-lg transition-all transform hover:scale-105">
                                    <i class="fas fa-calendar-week mr-1"></i>El martes
                                </button>
                                <button onclick="askSuggestion('¿Quién es el cliente que más ha comprado?')" 
                                        class="px-3 py-1 text-xs bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full hover:shadow-lg transition-all transform hover:scale-105">
                                    <i class="fas fa-crown mr-1"></i>Cliente VIP
                                </button>
                                <button onclick="askSuggestion('¿Cómo van las ventas esta semana?')" 
                                        class="px-3 py-1 text-xs bg-gradient-to-r from-yellow-500 to-orange-600 text-white rounded-full hover:shadow-lg transition-all transform hover:scale-105">
                                    <i class="fas fa-chart-line mr-1"></i>Esta semana
                                </button>
                                <button onclick="askSuggestion('¿Cuál fue el mejor día de ventas?')" 
                                        class="px-3 py-1 text-xs bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-full hover:shadow-lg transition-all transform hover:scale-105">
                                    <i class="fas fa-medal mr-1"></i>Mejor día
                                </button>
                            </div>
                        </div>
                        
                        <!-- Chat Messages -->
                        <div id="chat-messages" class="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-6 max-h-80 overflow-y-auto mb-6 border border-gray-200">
                            <div class="text-center py-8">
                                <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                                    <i class="fas fa-sparkles text-2xl text-white"></i>
                                </div>
                                <p class="text-gray-600 font-medium">¡Hola! Soy tu asistente de datos</p>
                                <p class="text-sm text-gray-500 mt-2">Pregúntame sobre ventas de Agosto - Septiembre 2025</p>
                            </div>
                        </div>

                        <!-- Modern Chat Input -->
                        <div class="relative">
                            <div class="flex items-center space-x-3 p-3 bg-white rounded-xl border-2 border-gray-200 focus-within:border-indigo-500 transition-colors">
                                <div class="flex-1">
                                    <input 
                                        id="chat-input" 
                                        type="text" 
                                        placeholder="Pregúntame sobre cualquier fecha... ej: ¿Cuánto vendimos hoy? ¿Qué tal ayer? ¿El martes?"
                                        class="w-full px-2 py-2 text-gray-700 placeholder-gray-400 border-0 focus:outline-none bg-transparent"
                                        onkeypress="handleChatKeyPress(event)"
                                    >
                                </div>
                                <button 
                                    id="chat-send" 
                                    onclick="sendChatMessage()" 
                                    class="p-3 bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-lg hover:shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                                    disabled
                                >
                                    <i class="fas fa-paper-plane"></i>
                                </button>
                            </div>
                            <div class="absolute -bottom-6 left-3 text-xs text-gray-400">
                                <i class="fas fa-info-circle mr-1"></i>
                                Solo datos de Agosto - Septiembre 2025 disponibles
                            </div>
                        </div>
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