// Servidor Node.js completo para EasyPanel
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import fetch from 'node-fetch'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config()

// Hacer fetch disponible globalmente
if (!globalThis.fetch) {
  globalThis.fetch = fetch
}

const app = new Hono()

// Middleware CORS para APIs  
app.use('/api/*', cors())

// Servir archivos estáticos
app.use('/static/*', serveStatic({ root: './public' }))

// Variables de entorno
const getEnv = () => ({
  WOOCOMMERCE_URL: process.env.WOOCOMMERCE_URL,
  WOOCOMMERCE_CONSUMER_KEY: process.env.WOOCOMMERCE_CONSUMER_KEY,
  WOOCOMMERCE_CONSUMER_SECRET: process.env.WOOCOMMERCE_CONSUMER_SECRET,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini'
})

// Función para autenticar con WooCommerce
const getWooCommerceAuth = (env) => {
  const credentials = Buffer.from(`${env.WOOCOMMERCE_CONSUMER_KEY}:${env.WOOCOMMERCE_CONSUMER_SECRET}`).toString('base64')
  return {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json'
  }
}

// Función para obtener datos de WooCommerce
const fetchWooCommerceData = async (endpoint, env, params) => {
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

// Función para llamar OpenAI API
const callOpenAI = async (prompt, env) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      messages: [
        {
          role: 'system', 
          content: 'Eres un asistente de marketing digital experto en análisis de datos de e-commerce. Responde siempre en español de México con un tono profesional pero amigable. Usa emojis relevantes y estructura tus respuestas con viñetas cuando sea apropiado.'
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

// Manejar favicon.ico
app.get('/favicon.ico', (c) => {
  return c.text('', 404)
})

// RUTA PRINCIPAL: API Dashboard con métricas reales
app.get('/api/dashboard', async (c) => {
  const env = getEnv()
  
  try {
    // Obtener período de los parámetros de query o fechas personalizadas
    const periodParam = c.req.query('period') || 'august-september-2025'
    const customStartDate = c.req.query('start_date')
    const customEndDate = c.req.query('end_date')
    
    let startDate, endDate, periodLabel
    
    // Si hay fechas personalizadas, usarlas
    if (customStartDate && customEndDate) {
      startDate = new Date(customStartDate + 'T00:00:00Z').toISOString()
      endDate = new Date(customEndDate + 'T23:59:59Z').toISOString()
      
      // Formato más amigable: 01/Sep/25 - 29/Sep/25
      const formatDate = (dateStr) => {
        const date = new Date(dateStr)
        const day = date.getDate().toString().padStart(2, '0')
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                           'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        const month = monthNames[date.getMonth()]
        const year = date.getFullYear().toString().slice(-2)
        return `${day}/${month}/${year}`
      }
      
      periodLabel = `${formatDate(customStartDate)} - ${formatDate(customEndDate)}`
    } else {
      // Mapear períodos predefinidos a fechas
      switch(periodParam) {
      case 'september-2025':
        startDate = new Date('2025-09-01T00:00:00Z').toISOString()
        endDate = new Date('2025-09-30T23:59:59Z').toISOString()
        periodLabel = 'Septiembre 2025'
        break
      case 'august-september-2025':
        startDate = new Date('2025-08-01T00:00:00Z').toISOString()
        endDate = new Date('2025-09-30T23:59:59Z').toISOString()
        periodLabel = 'Agosto - Septiembre 2025'
        break
      case 'last-30-days':
        endDate = new Date().toISOString()
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        periodLabel = 'Últimos 30 días'
        break
      case 'last-7-days':
        endDate = new Date().toISOString()
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        periodLabel = 'Últimos 7 días'
        break
      case 'this-month':
        const now = new Date()
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
        periodLabel = 'Este mes'
        break
      case 'last-month':
        const lastMonth = new Date()
        lastMonth.setMonth(lastMonth.getMonth() - 1)
        startDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).toISOString()
        endDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59).toISOString()
        periodLabel = 'Mes anterior'
        break
      case 'today':
        // Usar timezone México (America/Mexico_City) 
        const todayMx = new Date()
        // Convertir a timezone México
        const todayMxStr = todayMx.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
        startDate = new Date(todayMxStr + 'T06:00:00.000Z').toISOString() // 00:00 México = 06:00 UTC
        endDate = new Date(todayMxStr + 'T05:59:59.999Z')
        endDate.setUTCDate(endDate.getUTCDate() + 1) // Al día siguiente
        endDate = endDate.toISOString()
        periodLabel = `Hoy (${todayMxStr})`
        break
      case 'yesterday':
        // Usar timezone México (America/Mexico_City)
        const yesterdayMx = new Date()
        yesterdayMx.setDate(yesterdayMx.getDate() - 1)
        const yesterdayMxStr = yesterdayMx.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
        startDate = new Date(yesterdayMxStr + 'T06:00:00.000Z').toISOString() // 00:00 México = 06:00 UTC
        endDate = new Date(yesterdayMxStr + 'T05:59:59.999Z')
        endDate.setUTCDate(endDate.getUTCDate() + 1) // Al día siguiente
        endDate = endDate.toISOString()
        periodLabel = `Ayer (${yesterdayMxStr})`
        break
      case 'august-2025':
      default:
        startDate = new Date('2025-08-01T00:00:00Z').toISOString()
        endDate = new Date('2025-08-31T23:59:59Z').toISOString()
        periodLabel = 'Agosto 2025'
        break
      }
    }
    
    // OBTENER TODAS LAS ÓRDENES y filtrar solo estados exitosos
    const allOrders = await fetchWooCommerceData(
      'orders', 
      env,
      `after=${startDate}&before=${endDate}&per_page=100`
    )
    
    // FILTRAR por estados seleccionados por el usuario
    const statusFilters = c.req.query('status_filters') 
    const allowedStatuses = statusFilters ? statusFilters.split(',') : ['completed', 'delivered', 'processing']
    
    const orders = allOrders.filter((order) => {
      return allowedStatuses.includes(order.status)
    })
    
    // Calcular total con órdenes válidas
    const totalSales = orders.reduce((sum, order) => sum + parseFloat(order.total), 0)
    const avgTicket = orders.length > 0 ? totalSales / orders.length : 0
    
    // DATOS REALES: Calcular métodos de pago desde órdenes reales
    const paymentStats = {}
    
    orders.forEach((order) => {
      const paymentMethod = order.payment_method || 'unknown'
      const paymentTitle = order.payment_method_title || 'Desconocido'
      const orderTotal = parseFloat(order.total)
      
      if (!paymentStats[paymentMethod]) {
        paymentStats[paymentMethod] = {
          title: paymentTitle,
          sales: 0,
          orders: 0
        }
      }
      
      paymentStats[paymentMethod].sales += orderTotal
      paymentStats[paymentMethod].orders += 1
    })
    
    // Mapear métodos de pago conocidos con fallback para datos reales
    const getPaymentData = (method) => {
      return paymentStats[method] || { title: 'Sin datos', sales: 0, orders: 0 }
    }
    
    const stripeData = getPaymentData('stripe') 
    const paypalData = getPaymentData('paypal')
    const transferData = getPaymentData('bacs') // WooCommerce usa 'bacs' para transferencias
    
    // Si no hay datos específicos, buscar otros métodos comunes
    const otherMethods = Object.keys(paymentStats).filter(method => 
      !['stripe', 'paypal', 'bacs', 'cod'].includes(method)
    )
    
    // Sumar otros métodos a transferencia como fallback
    otherMethods.forEach(method => {
      transferData.sales += paymentStats[method].sales
      transferData.orders += paymentStats[method].orders
    })
    
    // Obtener productos más vendidos
    const products = await fetchWooCommerceData(
      'products',
      env, 
      'orderby=popularity&per_page=5'
    )
    
    // Top 5 órdenes más grandes
    const topOrders = orders
      .sort((a, b) => parseFloat(b.total) - parseFloat(a.total))
      .slice(0, 5)
      .map((order) => ({
        id: order.id,
        total: parseFloat(order.total),
        customer: `${order.billing.first_name} ${order.billing.last_name}`,
        date: order.date_created,
        status: order.status
      }))
    
    // Análisis de estados
    const statusBreakdown = {}
    orders.forEach((order) => {
      const status = order.status
      if (!statusBreakdown[status]) {
        statusBreakdown[status] = { count: 0, total: 0 }
      }
      statusBreakdown[status].count++
      statusBreakdown[status].total += parseFloat(order.total)
    })

    // Clasificación de clientes (usando lista de 26 distribuidores)
    const distributorEmails = new Set([
      'adaptoheal@gmail.com',
      'lymbra@outlook.com',
      'rodrigo@boyu.mx',
      'exportacion@boyu.mx',
      'lamewglobalmexico@hotmail.com',
      'laura@boyu.mx',
      'distribucion@inter-med.com.mx',
      'compras.osman@gmail.com',
      'hola@vinotintas.com',
      'h.medi.corp@hotmail.com',
      'support@hepamed.com',
      'proveedores@corporativohb.com',
      'easterneurope@diatheva.it',
      'proveedores@clinicaopusmedica.com.mx',
      'info@newgenmedical.com.mx',
      'diprolic@outlook.com',
      'compras.petirrojoazul@gmail.com',
      'servicio@boyu.mx',
      'luisperdigon@icloud.com',
      'analuciaalfarooliveros@gmail.com',
      'sebastianzavala08@gmail.com'
    ].map(email => email.toLowerCase()))

    const customerAnalysis = {}
    
    // Agrupar órdenes por EMAIL
    orders.forEach((order) => {
      const email = order.billing.email || 'no-email'
      if (!customerAnalysis[email]) {
        customerAnalysis[email] = {
          orders: [],
          totalSpent: 0,
          orderCount: 0,
          avgTicket: 0,
          customer: `${order.billing.first_name} ${order.billing.last_name}`,
          email: order.billing.email
        }
      }
      
      customerAnalysis[email].orders.push(order)
      customerAnalysis[email].totalSpent += parseFloat(order.total)
      customerAnalysis[email].orderCount++
    })
    
    // Calcular ticket promedio para cada cliente
    Object.values(customerAnalysis).forEach((customer) => {
      customer.avgTicket = customer.orderCount > 0 ? customer.totalSpent / customer.orderCount : 0
    })
    
    const distributors = []
    const regularCustomers = []
    
    // Clasificación exacta por email
    Object.values(customerAnalysis).forEach((customer) => {
      const emailLower = customer.email?.toLowerCase() || ''
      const isDistributor = distributorEmails.has(emailLower)
      
      if (isDistributor) {
        distributors.push(customer)
      } else {
        regularCustomers.push(customer)
      }
    })
    
    // Calcular totales por tipo de cliente
    const distributorStats = distributors.reduce((acc, d) => ({
      sales: acc.sales + d.totalSpent,
      orders: acc.orders + d.orderCount,
      customers: acc.customers + 1
    }), { sales: 0, orders: 0, customers: 0 })
    
    const customerStats = regularCustomers.reduce((acc, c) => ({
      sales: acc.sales + c.totalSpent,
      orders: acc.orders + c.orderCount,
      customers: acc.customers + 1
    }), { sales: 0, orders: 0, customers: 0 })

    return c.json({
      success: true,
      data: {
        // MÉTRICAS PRINCIPALES TOTALES
        totalSales30Days: totalSales,
        ordersCount30Days: orders.length,
        avgTicket30Days: avgTicket,
        
        // MÉTODOS DE PAGO REALES
        paymentMethods: {
          stripe: {
            sales: stripeData.sales,
            orders: stripeData.orders,
            avgTicket: stripeData.orders > 0 ? stripeData.sales / stripeData.orders : 0,
            percentage: totalSales > 0 ? (stripeData.sales / totalSales * 100).toFixed(1) : '0'
          },
          paypal: {
            sales: paypalData.sales,
            orders: paypalData.orders,
            avgTicket: paypalData.orders > 0 ? paypalData.sales / paypalData.orders : 0,
            percentage: totalSales > 0 ? (paypalData.sales / totalSales * 100).toFixed(1) : '0'
          },
          transfer: {
            sales: transferData.sales,
            orders: transferData.orders,
            avgTicket: transferData.orders > 0 ? transferData.sales / transferData.orders : 0,
            percentage: totalSales > 0 ? (transferData.sales / totalSales * 100).toFixed(1) : '0'
          }
        },
        
        // ESTADOS DE ÓRDENES
        orderStates: {
          completed: {
            sales: statusBreakdown.completed?.total || 0,
            orders: statusBreakdown.completed?.count || 0,
            percentage: totalSales > 0 ? ((statusBreakdown.completed?.total || 0) / totalSales * 100).toFixed(1) : '0'
          },
          delivered: {
            sales: statusBreakdown.delivered?.total || 0,
            orders: statusBreakdown.delivered?.count || 0,
            percentage: totalSales > 0 ? ((statusBreakdown.delivered?.total || 0) / totalSales * 100).toFixed(1) : '0'
          },
          processing: {
            sales: statusBreakdown.processing?.total || 0,
            orders: statusBreakdown.processing?.count || 0,
            percentage: totalSales > 0 ? ((statusBreakdown.processing?.total || 0) / totalSales * 100).toFixed(1) : '0'
          }
        },
        
        // TIPOS DE CLIENTE
        customerTypes: {
          distributors: {
            sales: distributorStats.sales,
            orders: distributorStats.orders,
            customers: distributorStats.customers,
            avgTicket: distributorStats.orders > 0 ? distributorStats.sales / distributorStats.orders : 0,
            percentage: totalSales > 0 ? (distributorStats.sales / totalSales * 100).toFixed(1) : '0',
            avgPerCustomer: distributorStats.customers > 0 ? distributorStats.sales / distributorStats.customers : 0
          },
          customers: {
            sales: customerStats.sales,
            orders: customerStats.orders,
            customers: customerStats.customers,
            avgTicket: customerStats.orders > 0 ? customerStats.sales / customerStats.orders : 0,
            percentage: totalSales > 0 ? (customerStats.sales / totalSales * 100).toFixed(1) : '0',
            avgPerCustomer: customerStats.customers > 0 ? customerStats.sales / customerStats.customers : 0
          }
        },
        
        // PRODUCTOS Y ÓRDENES TOP
        topProducts: products.slice(0, 5).map((product) => ({
          id: product.id,
          name: product.name,
          sales: product.total_sales || 0,
          price: parseFloat(product.price)
        })),
        topOrders: topOrders
      },
      debug: {
        periodo: `${periodLabel}: ${startDate} a ${endDate}`,
        totalOrdersAnalyzed: orders.length,
        statusBreakdown: statusBreakdown,
        realPaymentMethodsFound: Object.keys(paymentStats).length,
        paymentMethodBreakdown: paymentStats,
        totalOrdersAll: allOrders.length,
        filteredOrdersCount: orders.length,
        customerClassification: {
          criteria: `Clasificación exacta por email: 26 distribuidores identificados por su dirección de correo electrónico`,
          distributorsFound: distributorStats.customers,
          customersFound: customerStats.customers,
          topDistributors: distributors.slice(0, 3).map(d => ({
            name: d.customer,
            totalSpent: d.totalSpent,
            orders: d.orderCount,
            avgTicket: d.avgTicket
          })),
          topCustomers: regularCustomers.slice(0, 3).map(c => ({
            name: c.customer,
            totalSpent: c.totalSpent,
            orders: c.orderCount,
            avgTicket: c.avgTicket
          }))
        },
        note: `Estados incluidos: ${allowedStatuses.join(', ')} - Filtros activos aplicados`,
        statusBreakdownAll: allOrders.reduce((acc, order) => {
          if (!acc[order.status]) acc[order.status] = 0
          acc[order.status]++
          return acc
        }, {}),
        activeFilters: allowedStatuses,
        periodInfo: {
          label: periodLabel,
          startDate: startDate,
          endDate: endDate,
          type: customStartDate && customEndDate ? 'custom' : periodParam
        }
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

// RUTA: Test de conexión WooCommerce
app.get('/api/test-woo', async (c) => {
  const env = getEnv()
  
  try {
    const orders = await fetchWooCommerceData('orders', env, 'per_page=1')
    return c.json({
      success: true,
      message: 'Conexión exitosa con WooCommerce',
      ordersFound: orders.length,
      testTime: new Date().toISOString()
    })
  } catch (error) {
    return c.json({
      success: false,
      error: 'Error conectando con WooCommerce: ' + error.message
    }, 500)
  }
})

// RUTA: Chat IA con OpenAI
app.post('/api/chat', async (c) => {
  const env = getEnv()
  
  try {
    const { question, context } = await c.req.json()
    
    if (!question) {
      return c.json({ success: false, error: 'Pregunta requerida' }, 400)
    }
    
    const prompt = `Como experto en marketing digital y análisis de e-commerce, responde esta pregunta basándote en estos datos de WooCommerce:

CONTEXTO DE DATOS:
${context ? JSON.stringify(context, null, 2) : 'No hay contexto disponible'}

PREGUNTA DEL USUARIO:
${question}

INSTRUCCIONES:
- Responde en español de México
- Sé específico y actionable 
- Usa emojis relevantes
- Estructura con viñetas cuando sea apropiado
- Enfócate en insights de marketing y oportunidades de crecimiento
- Si los datos lo permiten, da recomendaciones específicas`

    const response = await callOpenAI(prompt, env)
    
    return c.json({
      success: true,
      response: response,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Chat API error:', error)
    return c.json({
      success: false,
      error: 'Error en el chat IA: ' + error.message
    }, 500)
  }
})

// Ruta de health check
app.get('/api/health', (c) => {
  const env = getEnv()
  return c.json({
    status: 'ok',
    server: 'Node.js + Hono para EasyPanel',
    hasWooConfig: !!(env.WOOCOMMERCE_URL && env.WOOCOMMERCE_CONSUMER_KEY),
    hasOpenAI: !!env.OPENAI_API_KEY,
    timestamp: new Date().toISOString()
  })
})

// RUTA PRINCIPAL: Dashboard completo
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
                <div class="flex flex-col md:flex-row items-center justify-between">
                    <div class="flex items-center space-x-4 mb-4 md:mb-0">
                        <div class="p-3 bg-white/20 rounded-xl">
                            <i class="fas fa-chart-line text-2xl text-white"></i>
                        </div>
                        <div>
                            <h1 class="text-3xl font-bold text-white">Adaptoheal Analytics</h1>
                            <p class="text-blue-100">Dashboard Inteligente con IA</p>
                        </div>
                    </div>
                    
                    <div class="flex items-center space-x-4">
                        <div class="glass-effect rounded-lg px-4 py-2 text-white">
                            <div class="flex items-center space-x-2">
                                <div class="w-2 h-2 bg-green-400 rounded-full pulse-dot"></div>
                                <span class="text-sm font-medium">EasyPanel Server</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Dashboard Container -->
        <div class="container mx-auto px-6 py-8">
            
            <!-- Loading State -->
            <div id="loading" class="text-center py-16">
                <div class="inline-flex items-center space-x-3">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span class="text-lg text-gray-600">Cargando datos de WooCommerce...</span>
                </div>
                <p class="text-sm text-gray-500 mt-2">Conectando con APIs...</p>
            </div>

            <!-- Error State -->
            <div id="error" class="hidden max-w-lg mx-auto text-center py-16">
                <div class="glass-effect rounded-xl p-8">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">Error de Conexión</h3>
                    <p class="text-gray-600 mb-4">No se pudo conectar con la API de WooCommerce</p>
                    <button onclick="location.reload()" class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg">
                        Reintentar
                    </button>
                </div>
            </div>

            <!-- Dashboard Content Placeholder -->
            <div id="dashboard" class="hidden">
                <div class="text-center py-16">
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">🚀 Dashboard Funcionando</h2>
                    <p class="text-gray-600">El servidor Node.js está corriendo correctamente en EasyPanel</p>
                    <div class="mt-8">
                        <button onclick="testAPI()" class="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg">
                            🔍 Test API Dashboard
                        </button>
                    </div>
                    <div id="api-result" class="mt-6 hidden"></div>
                </div>
            </div>
        </div>

        <script src="/static/app.js"></script>
        <script>
        // Simple health check on load
        document.addEventListener('DOMContentLoaded', async function() {
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                
                if (data.status === 'ok') {
                    document.getElementById('loading').classList.add('hidden');
                    document.getElementById('dashboard').classList.remove('hidden');
                } else {
                    throw new Error('Health check failed');
                }
            } catch (error) {
                console.error('Health check error:', error);
                document.getElementById('loading').classList.add('hidden');
                document.getElementById('error').classList.remove('hidden');
            }
        });

        // Test API function
        async function testAPI() {
            const resultEl = document.getElementById('api-result');
            resultEl.classList.remove('hidden');
            resultEl.innerHTML = '<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>';
            
            try {
                const response = await fetch('/api/dashboard?period=this-month');
                const data = await response.json();
                
                if (data.success) {
                    resultEl.innerHTML = \`
                        <div class="glass-effect rounded-lg p-6 text-left">
                            <h3 class="font-bold text-green-600 mb-3">✅ API Funcionando Correctamente</h3>
                            <div class="space-y-2 text-sm">
                                <div><strong>Ventas:</strong> $\${data.data.totalSales30Days.toLocaleString()} MXN</div>
                                <div><strong>Órdenes:</strong> \${data.data.ordersCount30Days}</div>
                                <div><strong>Ticket Promedio:</strong> $\${data.data.avgTicket30Days.toFixed(2)} MXN</div>
                                <div><strong>Período:</strong> \${data.debug.periodInfo.label}</div>
                            </div>
                        </div>
                    \`;
                } else {
                    throw new Error(data.error || 'API Error');
                }
            } catch (error) {
                resultEl.innerHTML = \`
                    <div class="bg-red-100 border border-red-300 rounded-lg p-4">
                        <p class="text-red-700">❌ Error: \${error.message}</p>
                    </div>
                \`;
            }
        }
        </script>
    </body>
    </html>
  `)
})

export default app
export { getEnv, fetchWooCommerceData, callOpenAI }