// Cargar variables de entorno del archivo .env
require('dotenv').config();

const http = require('http');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

// Importar sistema de autenticación
const {
  authenticateUser,
  verifyToken,
  authMiddleware,
  webAuthMiddleware,
  addUser,
  deleteUser,
  listUsers,
  initializeAuth
} = require('./auth.js');

// Importar módulo de base de datos PostgreSQL
const {
  getShippingDataByOrderId,
  getBulkShippingCosts,
  getShippingStats,
  getAllShipments,
  testConnection
} = require('./database.js');

// Importar módulo de Google Analytics 4
const {
  initializeGA4Client,
  getUsersData,
  getTopPages,
  getDemographicData,
  getTrafficSources,
  getGA4Insights,
  testGA4Connection
} = require('./google-analytics-oauth.js');

// Importar módulo de Google Ads (Official Client)
const {
  initializeGoogleAdsClient,
  getAccountInfo,
  getCampaigns,
  getAccountMetrics,
  getGoogleAdsInsights,
  testGoogleAdsConnection
} = require('./google-ads-official.js');

// Importar módulo de Meta Ads
const {
  initializeMetaAdsClient,
  getAdAccountInfo,
  getCampaigns: getMetaCampaigns,
  getAdInsights,
  getCampaignInsights,
  getMetaAdsInsights,
  testMetaConnection
} = require('./meta-ads.js');

// Importar módulo de Meta Organic (Facebook Pages + Instagram Business)
const {
  getFacebookPageInfo,
  getFacebookPageInsights,
  getFacebookRecentPosts,
  getInstagramAccountInfo,
  getInstagramInsights,
  getInstagramRecentPosts,
  getInstagramStories,
  getMetaOrganicInsights,
  testMetaOrganicConnection
} = require('./meta-organic.js');

// Configuración - usando las mismas variables de entorno
const WOOCOMMERCE_URL = process.env.WOOCOMMERCE_URL || 'https://adaptohealmx.com';
const WOOCOMMERCE_CONSUMER_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY || '';
const WOOCOMMERCE_CONSUMER_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Configuración de Envia.com eliminada - usando solo datos del Excel

// Función para autenticar con WooCommerce
const getWooCommerceAuth = () => {
  const credentials = Buffer.from(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`).toString('base64');
  return {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json'
  };
};

// Sistema de caché simple para WooCommerce (5 minutos de duración)
const wooCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Función fetchEnviaData eliminada - usando solo datos del Excel

// Mapeo offline de costos reales desde el Excel de Envia.com (septiembre 2025)
let enviaOrderMapping = null;

// Función para cargar el mapeo de costos de Envia.com
const loadEnviaOrderMapping = () => {
  if (enviaOrderMapping) return enviaOrderMapping;
  
  try {
    const mappingPath = path.join(__dirname, 'envia_order_mapping.json');
    if (fs.existsSync(mappingPath)) {
      const mappingData = fs.readFileSync(mappingPath, 'utf8');
      enviaOrderMapping = JSON.parse(mappingData);
      console.log(`📦 Mapeo de Envia.com cargado: ${Object.keys(enviaOrderMapping).length} órdenes`);
      return enviaOrderMapping;
    } else {
      console.log('⚠️  Archivo de mapeo de Envia.com no encontrado');
      return {};
    }
  } catch (error) {
    console.error('Error cargando mapeo de Envia.com:', error);
    return {};
  }
};

// Función para obtener costos de envío por referencia de orden (SOLO PostgreSQL - SIN FALLBACKS)
const getShippingCostByOrderReference = async (orderReference) => {
  try {
    console.log(`🔍 Buscando orden ${orderReference} en PostgreSQL...`);
    
    // Buscar SOLO en PostgreSQL - SIN fallbacks
    const postgresResult = await getShippingDataByOrderId(orderReference);
    
    if (postgresResult.found) {
      console.log(`✅ PostgreSQL: Orden ${orderReference} encontrada - Costo: $${postgresResult.cost}`);
      return postgresResult;
    }
    
    // Si no se encuentra en PostgreSQL, NO mostrar datos
    console.log(`❌ Orden ${orderReference} no encontrada en PostgreSQL - sin datos`);
    return { 
      found: false, 
      cost: 0, // SIN COSTO - solo datos reales de PostgreSQL
      message: 'Orden no encontrada en PostgreSQL', 
      carrier: null,
      service: null,
      tracking_number: null,
      source: 'not_found_in_postgres' 
    };
  } catch (error) {
    console.error('❌ Error conectando PostgreSQL:', error.message);
    // En caso de error de conexión, NO mostrar datos
    return { 
      found: false, 
      cost: 0, // SIN COSTO - requiere conexión PostgreSQL
      error: error.message, 
      message: 'Sin conexión PostgreSQL - sin datos de envío',
      carrier: null,
      service: null, 
      source: 'postgres_disconnected' 
    };
  }
};



// Función para obtener datos de WooCommerce con caché
const fetchWooCommerceData = async (endpoint, params = '') => {
  const cacheKey = `${endpoint}?${params}`;
  const cached = wooCache.get(cacheKey);
  
  // Verificar si hay datos en caché y no están expirados
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`📋 Cache hit para: ${endpoint}`);
    return cached.data;
  }
  
  const apiUrl = `${WOOCOMMERCE_URL}/wp-json/wc/v3/${endpoint}${params ? `?${params}` : ''}`;
  
  try {
    console.log(`🌐 Fetching from WooCommerce: ${endpoint}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: getWooCommerceAuth()
    });
    
    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Guardar en caché
    wooCache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });
    
    return data;
  } catch (error) {
    console.error('Error fetching WooCommerce data:', error);
    throw error;
  }
};

// Función para obtener fechas en zona horaria de México
const getMexicoDate = () => {
  const now = new Date();
  const mexicoTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Mexico_City"}));
  return mexicoTime;
};

// Función para parsear fechas relativas
const parseRelativeDate = (query, mexicoNow) => {
  const today = new Date(mexicoNow);
  const yesterday = new Date(mexicoNow);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Crear mapeo de días de la semana
  const daysMap = {
    'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3, 
    'jueves': 4, 'viernes': 5, 'sábado': 6
  };
  
  let targetDate = null;
  let dateDescription = "";
  
  if (/\bhoy\b/i.test(query)) {
    targetDate = today;
    dateDescription = `HOY (${today.toLocaleDateString('es-MX')})`;
  } else if (/\bayer\b/i.test(query)) {
    targetDate = yesterday;  
    dateDescription = `AYER (${yesterday.toLocaleDateString('es-MX')})`;
  } else if (/\b(el\s+)?(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/i.test(query)) {
    const dayMatch = query.match(/\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/i);
    if (dayMatch) {
      const dayName = dayMatch[1].toLowerCase();
      const targetDay = daysMap[dayName];
      const currentDay = today.getDay();
      
      // Calcular cuántos días atrás está ese día de la semana
      let daysAgo = (currentDay - targetDay + 7) % 7;
      if (daysAgo === 0) daysAgo = 7; // Si es el mismo día, tomar la semana pasada
      
      targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() - daysAgo);
      dateDescription = `${dayName.toUpperCase()} (${targetDate.toLocaleDateString('es-MX')})`;
    }
  }
  
  return { targetDate, dateDescription };
};

// Función para consultar OpenAI con manejo de fechas inteligente
const queryOpenAI = async (prompt, context) => {
  const mexicoNow = getMexicoDate();
  const currentDate = mexicoNow.toLocaleDateString('es-MX', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  });
  
  const currentTime = mexicoNow.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Parsear fecha relativa si existe
  const { targetDate, dateDescription } = parseRelativeDate(prompt, mexicoNow);
  
  let dateContext = "";
  if (targetDate) {
    dateContext = `\n\n🗓️ CONSULTA ESPECÍFICA DE FECHA: ${dateDescription}
    - Buscar datos específicos de esta fecha
    - Si no hay datos de esa fecha exacta, mencionarlo claramente
    - Comparar con datos disponibles cuando sea relevante`;
  }
  
  const requestBody = {
    model: OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Eres un analista senior de marketing digital especializado en WooCommerce para Adaptoheal México, empresa líder en suplementos alimenticios.

🇲🇽 INFORMACIÓN TEMPORAL (ZONA HORARIA MÉXICO):
- Fecha y hora actual: ${currentDate}, ${currentTime}
- Año actual: 2025 (octubre actual)
- Zona horaria: America/Mexico_City (GMT-6)  
- Datos disponibles: AGOSTO-SEPTIEMBRE-OCTUBRE 2025

📊 DATOS DISPONIBLES:
${context}${dateContext}

🎯 INSTRUCCIONES PARA FECHAS RELATIVAS:
- "HOY" = ${mexicoNow.toLocaleDateString('es-MX')} (busca datos de esta fecha exacta)
- "AYER" = ${new Date(mexicoNow.getTime() - 24*60*60*1000).toLocaleDateString('es-MX')}
- "EL MARTES/LUNES/etc." = El último día de esa semana dentro del período disponible
- Si preguntan por fechas fuera de agosto-septiembre-octubre 2025, explica limitaciones
- Si no hay datos de la fecha específica, sugiere la fecha más cercana con datos

📋 FORMATO DE RESPUESTA OBLIGATORIO (MUY IMPORTANTE):
SIEMPRE estructura tus respuestas de esta manera:

📈 **RESUMEN EJECUTIVO**
• [Dato principal con emoji]
• [Insight clave con emoji]

📊 **DESGLOSE DETALLADO**
• **Fecha específica**: [Datos con formato]
• **Comparativa**: [Análisis vs otros períodos]
• **Métricas clave**: [KPIs importantes]

🎯 **INSIGHTS DE MARKETING**
• **Oportunidad**: [Recomendación estratégica]
• **Tendencia**: [Patrón identificado]
• **Acción sugerida**: [Next steps]

⚡ **DATOS RÁPIDOS**
• Dinero: $1,234.56 MXN
• Órdenes: 15 pedidos 📦
• Ticket promedio: $850.25 MXN 💳

SIEMPRE usa:
- Emojis relevantes (📈📊💰🎯⚡🏆🔥📦💳)
- Viñetas con •
- **Texto en negritas** para datos importantes
- Saltos de línea para legibilidad
- Enfoque de marketing digital mexicano
- Insights accionables para el negocio

NO escribas párrafos largos. TODO debe ser estructurado y visual.`
      },
      {
        role: 'user', 
        content: prompt
      }
    ],
    max_tokens: 600,
    temperature: 0.3
  };

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
};

// Función principal para manejar el dashboard
// Función auxiliar para calcular el período anterior
const calculatePreviousPeriod = (startDate, endDate, periodParam) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const duration = end.getTime() - start.getTime();
  
  // Calcular período anterior con la misma duración
  const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000); // Un día antes del inicio actual
  const prevStart = new Date(prevEnd.getTime() - duration);
  
  return {
    startDate: prevStart.toISOString(),
    endDate: prevEnd.toISOString()
  };
};

// Función auxiliar para calcular período de comparación personalizado
const calculateComparisonPeriod = (comparisonPeriodParam, currentStartDate, currentEndDate) => {
  const currentStart = new Date(currentStartDate);
  const currentEnd = new Date(currentEndDate);
  
  switch (comparisonPeriodParam) {
    case 'auto':
      return calculatePreviousPeriod(currentStartDate, currentEndDate, 'auto');
      
    case 'august-2025':
      return {
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2025-08-31T23:59:59.000Z'
      };
      
    case 'september-2025':
      return {
        startDate: '2025-09-01T00:00:00.000Z',
        endDate: '2025-09-30T23:59:59.000Z'
      };
      
    case 'july-2025':
      return {
        startDate: '2025-07-01T00:00:00.000Z',
        endDate: '2025-07-31T23:59:59.000Z'
      };
      
    case 'june-2025':
      return {
        startDate: '2025-06-01T00:00:00.000Z',
        endDate: '2025-06-30T23:59:59.000Z'
      };
      
    case 'october-2025':
      return {
        startDate: '2025-10-01T00:00:00.000Z',
        endDate: '2025-10-31T23:59:59.000Z'
      };
      
    case 'september-2025':
      return {
        startDate: '2025-09-01T00:00:00.000Z',
        endDate: '2025-09-30T23:59:59.000Z'
      };
      
    case 'last-30-days':
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
      return {
        startDate: thirtyDaysAgo.toISOString(),
        endDate: today.toISOString()
      };
      
    case 'last-60-days':
      const todayFor60 = new Date();
      const sixtyDaysAgo = new Date(todayFor60.getTime() - (60 * 24 * 60 * 60 * 1000));
      return {
        startDate: sixtyDaysAgo.toISOString(),
        endDate: todayFor60.toISOString()
      };
      
    case 'previous-month':
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: prevMonth.toISOString(),
        endDate: lastDayPrevMonth.toISOString()
      };
      
    case 'previous-quarter':
      const nowQuarter = new Date();
      const currentQuarter = Math.floor(nowQuarter.getMonth() / 3);
      const prevQuarter = currentQuarter - 1;
      const prevQuarterYear = prevQuarter < 0 ? nowQuarter.getFullYear() - 1 : nowQuarter.getFullYear();
      const adjustedPrevQuarter = prevQuarter < 0 ? 3 : prevQuarter;
      
      const quarterStart = new Date(prevQuarterYear, adjustedPrevQuarter * 3, 1);
      const quarterEnd = new Date(prevQuarterYear, (adjustedPrevQuarter * 3) + 3, 0);
      return {
        startDate: quarterStart.toISOString(),
        endDate: quarterEnd.toISOString()
      };
      
    case 'same-month-last-year':
      const currentYear = currentStart.getFullYear();
      const currentMonth = currentStart.getMonth();
      const lastYearStart = new Date(currentYear - 1, currentMonth, 1);
      const lastYearEnd = new Date(currentYear - 1, currentMonth + 1, 0);
      return {
        startDate: lastYearStart.toISOString(),
        endDate: lastYearEnd.toISOString()
      };
      
    default:
      // Si no reconoce el período, usar auto
      return calculatePreviousPeriod(currentStartDate, currentEndDate, 'auto');
  }
};

// Función auxiliar para calcular porcentaje de cambio
const calculatePercentageChange = (current, previous) => {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous * 100);
};

const handleDashboard = async (query) => {
  try {
    // NUEVO: Obtener período de los parámetros de query o fechas personalizadas
    const periodParam = query.period || 'september-2025';
    const comparisonPeriodParam = query.comparison_period || 'auto';
    const customStartDate = query.start_date;
    const customEndDate = query.end_date;
    

    
    let startDate, endDate, periodLabel;
    
    // Si hay fechas personalizadas, usarlas
    if (customStartDate && customEndDate) {
      startDate = new Date(customStartDate + 'T00:00:00Z').toISOString();
      endDate = new Date(customEndDate + 'T23:59:59Z').toISOString();
      
      // Formato más amigable: 01/Sep/25 - 29/Sep/25
      const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const day = date.getDate().toString().padStart(2, '0');
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                           'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const month = monthNames[date.getMonth()];
        const year = date.getFullYear().toString().slice(-2);
        return `${day}/${month}/${year}`;
      };
      
      periodLabel = `${formatDate(customStartDate)} - ${formatDate(customEndDate)}`;
    } else {
      // Mapear períodos predefinidos a fechas
      switch(periodParam) {
      case 'october-2025':
        startDate = new Date('2025-10-01T00:00:00Z').toISOString();
        endDate = new Date('2025-10-31T23:59:59Z').toISOString();
        periodLabel = 'Octubre 2025';
        break;
      case 'september-2025':
        startDate = new Date('2025-09-01T00:00:00Z').toISOString();
        endDate = new Date('2025-09-30T23:59:59Z').toISOString();
        periodLabel = 'Septiembre 2025';
        break;

      case 'last-30-days':
        endDate = new Date().toISOString();
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        periodLabel = 'Últimos 30 días';
        break;
      case 'last-7-days':
        endDate = new Date().toISOString();
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        periodLabel = 'Últimos 7 días';
        break;
      case 'last-14-days':
        endDate = new Date().toISOString();
        startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        periodLabel = 'Últimos 14 días';
        break;
      case 'this-month':
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
        periodLabel = 'Este mes';
        break;
      case 'last-month':
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        startDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).toISOString();
        endDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59).toISOString();
        periodLabel = 'Mes anterior';
        break;
      case 'today':
        // Usar timezone México (America/Mexico_City) 
        const todayMx = new Date();
        // Convertir a timezone México
        const todayMxStr = todayMx.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
        startDate = new Date(todayMxStr + 'T06:00:00.000Z').toISOString(); // 00:00 México = 06:00 UTC
        endDate = new Date(todayMxStr + 'T05:59:59.999Z');
        endDate.setUTCDate(endDate.getUTCDate() + 1); // Al día siguiente
        endDate = endDate.toISOString();
        periodLabel = `Hoy (${todayMxStr})`;
        break;
      case 'yesterday':
        // Usar timezone México (America/Mexico_City)
        const yesterdayMx = new Date();
        yesterdayMx.setDate(yesterdayMx.getDate() - 1);
        const yesterdayMxStr = yesterdayMx.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
        startDate = new Date(yesterdayMxStr + 'T06:00:00.000Z').toISOString(); // 00:00 México = 06:00 UTC
        endDate = new Date(yesterdayMxStr + 'T05:59:59.999Z');
        endDate.setUTCDate(endDate.getUTCDate() + 1); // Al día siguiente
        endDate = endDate.toISOString();
        periodLabel = `Ayer (${yesterdayMxStr})`;
        break;
      case 'august-2025':
        startDate = new Date('2025-08-01T00:00:00Z').toISOString();
        endDate = new Date('2025-08-31T23:59:59Z').toISOString();
        periodLabel = 'Agosto 2025';
        break;
      case 'september-2025':
      default:
        startDate = new Date('2025-09-01T00:00:00Z').toISOString();
        endDate = new Date('2025-09-30T23:59:59Z').toISOString();
        periodLabel = 'Septiembre 2025';
        break;
      }
    }
    
    // OBTENER TODAS LAS ÓRDENES - Con paginación para datos completos
    let allOrders = [];
    let page = 1;
    let hasMoreOrders = true;
    
    while (hasMoreOrders) {
      const orders = await fetchWooCommerceData(
        'orders', 
        `after=${startDate}&before=${endDate}&per_page=100&page=${page}`
      );
      
      if (orders && orders.length > 0) {
        allOrders = allOrders.concat(orders);
        page++;
        // Si obtenemos menos de 100 órdenes, ya no hay más páginas
        if (orders.length < 100) {
          hasMoreOrders = false;
        }
      } else {
        hasMoreOrders = false;
      }
    }
    
    console.log(`📊 Total órdenes obtenidas: ${allOrders.length} para el período ${periodLabel}`);

    
    // FILTRAR por estados seleccionados por el usuario
    const statusFilters = query.status_filters;
    const allowedStatuses = statusFilters ? statusFilters.split(',') : ['completed', 'delivered', 'processing', 'on-hold', 'pending', 'failed', 'refunded', 'cancelled'];
    
    const orders = allOrders.filter((order) => {
      return allowedStatuses.includes(order.status);
    });
    
    // Calcular total con órdenes válidas
    const totalSales = orders.reduce((sum, order) => sum + parseFloat(order.total), 0);
    const avgTicket = orders.length > 0 ? totalSales / orders.length : 0;
    
    // DATOS REALES: Calcular métodos de pago desde órdenes reales
    const paymentStats = {};
    
    orders.forEach((order) => {
      const paymentMethod = order.payment_method || 'unknown';
      const paymentTitle = order.payment_method_title || 'Desconocido';
      const orderTotal = parseFloat(order.total);
      
      if (!paymentStats[paymentMethod]) {
        paymentStats[paymentMethod] = {
          title: paymentTitle,
          sales: 0,
          orders: 0
        };
      }
      
      paymentStats[paymentMethod].sales += orderTotal;
      paymentStats[paymentMethod].orders += 1;
    });
    
    // Mapear métodos de pago conocidos con fallback para datos reales
    const getPaymentData = (method) => {
      return paymentStats[method] || { title: 'Sin datos', sales: 0, orders: 0 };
    };
    
    const stripeData = getPaymentData('stripe'); 
    
    // CONSOLIDAR TODOS LOS MÉTODOS DE PAYPAL
    const paypalData = {
      title: 'PayPal',
      sales: 0,
      orders: 0
    };
    
    // Sumar ambos métodos de PayPal: ppcp-gateway + ppcp-credit-card-gateway
    const paypalGateway = getPaymentData('ppcp-gateway');
    const paypalCreditCard = getPaymentData('ppcp-credit-card-gateway');
    
    paypalData.sales = paypalGateway.sales + paypalCreditCard.sales;
    paypalData.orders = paypalGateway.orders + paypalCreditCard.orders;
    
    const transferData = getPaymentData('bacs'); // WooCommerce usa 'bacs' para transferencias
    const codData = getPaymentData('cod'); // Pago contra entrega
    
    // Si no hay datos específicos, buscar otros métodos comunes (excluyendo PayPal ya consolidado)
    const otherMethods = Object.keys(paymentStats).filter(method => 
      !['stripe', 'ppcp-gateway', 'ppcp-credit-card-gateway', 'bacs', 'cod'].includes(method)
    );
    
    // Sumar otros métodos a transferencia como fallback
    otherMethods.forEach(method => {
      transferData.sales += paymentStats[method].sales;
      transferData.orders += paymentStats[method].orders;
    });
    
    // CALCULAR PRODUCTOS DESDE ÓRDENES REALES (NO USAR API DE PRODUCTOS)
    const productStats = {};
    
    // Procesar line_items de todas las órdenes filtradas
    orders.forEach(order => {
      if (order.line_items && Array.isArray(order.line_items)) {
        order.line_items.forEach(item => {
          const productId = item.product_id;
          const productName = item.name;
          const quantity = parseInt(item.quantity);
          const totalSales = parseFloat(item.total);
          
          if (!productStats[productId]) {
            productStats[productId] = {
              id: productId,
              name: productName,
              totalQuantity: 0,
              totalSales: 0,
              orders: new Set() // Para contar órdenes únicas
            };
          }
          
          productStats[productId].totalQuantity += quantity;
          productStats[productId].totalSales += totalSales;
          productStats[productId].orders.add(order.id);
        });
      }
    });
    
    // Convertir a array y ordenar por ventas totales
    const products = Object.values(productStats)
      .map(product => ({
        id: product.id,
        name: product.name,
        totalQuantity: product.totalQuantity,
        totalSales: product.totalSales,
        ordersCount: product.orders.size,
        avgPrice: product.totalQuantity > 0 ? product.totalSales / product.totalQuantity : 0,
        percentage: totalSales > 0 ? (product.totalSales / totalSales * 100).toFixed(1) : '0'
      }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity);
    
    // Top 5 órdenes más grandes (solo con pagos reales)
    const topOrders = orders
      .sort((a, b) => parseFloat(b.total) - parseFloat(a.total))
      .slice(0, 5)
      .map((order) => ({
        id: order.id,
        total: parseFloat(order.total),
        customer: `${order.billing.first_name} ${order.billing.last_name}`,
        date: order.date_created,
        status: order.status
      }));
    
    // Análisis simplificado
    const statusBreakdown = {};
    orders.forEach((order) => {
      const status = order.status;
      if (!statusBreakdown[status]) {
        statusBreakdown[status] = { count: 0, total: 0 };
      }
      statusBreakdown[status].count++;
      statusBreakdown[status].total += parseFloat(order.total);
    });

    // NUEVA FUNCIONALIDAD: Clasificación automática Cliente vs Distribuidor
    const customerAnalysis = {};
    
    // Agrupar órdenes por EMAIL (más preciso que customer_id)
    orders.forEach((order) => {
      const email = order.billing.email || 'no-email';
      if (!customerAnalysis[email]) {
        customerAnalysis[email] = {
          orders: [],
          totalSpent: 0,
          orderCount: 0,
          avgTicket: 0,
          customer: `${order.billing.first_name} ${order.billing.last_name}`,
          email: order.billing.email
        };
      }
      
      customerAnalysis[email].orders.push(order);
      customerAnalysis[email].totalSpent += parseFloat(order.total);
      customerAnalysis[email].orderCount++;
    });
    
    // Calcular métricas por cliente y clasificar
    Object.keys(customerAnalysis).forEach(customerId => {
      const customer = customerAnalysis[customerId];
      customer.avgTicket = customer.totalSpent / customer.orderCount;
    });
    
    // CLASIFICACIÓN EXACTA: Lista de emails de los 26 distribuidores REALES del CSV (lowercase)
    const distributorEmails = new Set([
      'elizabeth.h.c@hotmail.com',
      'annabgdiaz@gmail.com', 
      'sofiborto94@outlook.com',
      'gsha3390@gmail.com',
      'diazinfantea@aol.com',
      'hola@adaptohealmx.com',
      'rafazavala2003@hotmail.com',
      'glomunoz@hotmail.com',
      'compras@recibexpress.com',
      'hola@allus.shop',
      'compras@sanvite.com',
      'mauro.costanzopa@outlook.com',
      'reginacr.healthcoach@gmail.com',
      'mioh70@hotmail.com',
      'almacen@ocmarket.mx',
      'magdaaldacog@gmail.com',
      'vero@innata.mx',
      'compras3@sinerco.com.mx',
      'diandraig@gmail.com',
      'silvia.glz.gomez@hotmail.com',
      'alfredo@zarcos.mx',
      'compras.petirrojoazul@gmail.com',
      'servicio@boyu.mx',
      'luisperdigon@icloud.com',
      'analuciaalfarooliveros@gmail.com',
      'sebastianzavala08@gmail.com'
    ].map(email => email.toLowerCase()));
    
    const distributors = [];
    const regularCustomers = [];
    
    // Clasificación exacta por email (case insensitive)
    Object.values(customerAnalysis).forEach((customer) => {
      const emailLower = customer.email?.toLowerCase() || '';
      const isDistributor = distributorEmails.has(emailLower);
      
      if (isDistributor) {
        distributors.push(customer);
      } else {
        regularCustomers.push(customer);
      }
    });
    
    // Calcular totales por tipo de cliente
    const distributorStats = distributors.reduce((acc, d) => ({
      sales: acc.sales + d.totalSpent,
      orders: acc.orders + d.orderCount,
      customers: acc.customers + 1
    }), { sales: 0, orders: 0, customers: 0 });
    
    const customerStats = regularCustomers.reduce((acc, c) => ({
      sales: acc.sales + c.totalSpent,
      orders: acc.orders + c.orderCount,
      customers: acc.customers + 1
    }), { sales: 0, orders: 0, customers: 0 });

    // ================================
    // NUEVO: ANÁLISIS COMPARATIVO CON PERÍODO ANTERIOR
    // ================================
    
    let comparativeData = null;
    
    try {
      // Calcular período de comparación (automático o personalizado)
      const previousPeriod = calculateComparisonPeriod(comparisonPeriodParam, startDate, endDate);
      
      // Obtener órdenes del período anterior
      const allPreviousOrders = await fetchWooCommerceData(
        'orders', 
        `after=${previousPeriod.startDate}&before=${previousPeriod.endDate}&per_page=50`
      );
      
      const previousOrders = allPreviousOrders.filter((order) => {
        return allowedStatuses.includes(order.status);
      });
      
      // Calcular métricas del período anterior
      const prevTotalSales = previousOrders.reduce((sum, order) => sum + parseFloat(order.total), 0);
      const prevAvgTicket = previousOrders.length > 0 ? prevTotalSales / previousOrders.length : 0;
      const prevOrdersCount = previousOrders.length;
      
      // Calcular métodos de pago del período anterior
      const prevPaymentStats = {};
      previousOrders.forEach((order) => {
        const paymentMethod = order.payment_method || 'unknown';
        const orderTotal = parseFloat(order.total);
        
        if (!prevPaymentStats[paymentMethod]) {
          prevPaymentStats[paymentMethod] = { sales: 0, orders: 0 };
        }
        
        prevPaymentStats[paymentMethod].sales += orderTotal;
        prevPaymentStats[paymentMethod].orders += 1;
      });
      
      const prevStripeData = prevPaymentStats['stripe'] || { sales: 0, orders: 0 };
      const prevPaypalData = {
        sales: (prevPaymentStats['ppcp-gateway']?.sales || 0) + (prevPaymentStats['ppcp-credit-card-gateway']?.sales || 0),
        orders: (prevPaymentStats['ppcp-gateway']?.orders || 0) + (prevPaymentStats['ppcp-credit-card-gateway']?.orders || 0)
      };
      const prevTransferData = prevPaymentStats['bacs'] || { sales: 0, orders: 0 };
      
      // Calcular estados del período anterior
      const prevStatusBreakdown = {};
      previousOrders.forEach((order) => {
        const status = order.status;
        if (!prevStatusBreakdown[status]) {
          prevStatusBreakdown[status] = { count: 0, total: 0 };
        }
        prevStatusBreakdown[status].count++;
        prevStatusBreakdown[status].total += parseFloat(order.total);
      });
      
      // Calcular tipos de cliente del período anterior
      const prevCustomerAnalysis = {};
      previousOrders.forEach((order) => {
        const email = order.billing.email || 'no-email';
        if (!prevCustomerAnalysis[email]) {
          prevCustomerAnalysis[email] = {
            totalSpent: 0,
            orderCount: 0,
            email: order.billing.email
          };
        }
        prevCustomerAnalysis[email].totalSpent += parseFloat(order.total);
        prevCustomerAnalysis[email].orderCount++;
      });
      
      const prevDistributors = [];
      const prevRegularCustomers = [];
      
      Object.values(prevCustomerAnalysis).forEach((customer) => {
        const emailLower = customer.email?.toLowerCase() || '';
        const isDistributor = distributorEmails.has(emailLower);
        
        if (isDistributor) {
          prevDistributors.push(customer);
        } else {
          prevRegularCustomers.push(customer);
        }
      });
      
      const prevDistributorStats = prevDistributors.reduce((acc, d) => ({
        sales: acc.sales + d.totalSpent,
        orders: acc.orders + d.orderCount,
        customers: acc.customers + 1
      }), { sales: 0, orders: 0, customers: 0 });
      
      const prevCustomerStats = prevRegularCustomers.reduce((acc, c) => ({
        sales: acc.sales + c.totalSpent,
        orders: acc.orders + c.orderCount,
        customers: acc.customers + 1
      }), { sales: 0, orders: 0, customers: 0 });
      
      // Calcular cambios porcentuales
      comparativeData = {
        totalSales: {
          change: calculatePercentageChange(totalSales, prevTotalSales),
          previous: prevTotalSales
        },
        avgTicket: {
          change: calculatePercentageChange(avgTicket, prevAvgTicket),
          previous: prevAvgTicket
        },
        ordersCount: {
          change: calculatePercentageChange(orders.length, prevOrdersCount),
          previous: prevOrdersCount
        },
        paymentMethods: {
          stripe: {
            salesChange: calculatePercentageChange(stripeData.sales, prevStripeData.sales),
            ordersChange: calculatePercentageChange(stripeData.orders, prevStripeData.orders),
            previous: prevStripeData
          },
          paypal: {
            salesChange: calculatePercentageChange(paypalData.sales, prevPaypalData.sales),
            ordersChange: calculatePercentageChange(paypalData.orders, prevPaypalData.orders),
            previous: prevPaypalData
          },
          transfer: {
            salesChange: calculatePercentageChange(transferData.sales, prevTransferData.sales),
            ordersChange: calculatePercentageChange(transferData.orders, prevTransferData.orders),
            previous: prevTransferData
          }
        },
        orderStates: {
          completed: {
            salesChange: calculatePercentageChange(
              statusBreakdown.completed?.total || 0, 
              prevStatusBreakdown.completed?.total || 0
            ),
            ordersChange: calculatePercentageChange(
              statusBreakdown.completed?.count || 0, 
              prevStatusBreakdown.completed?.count || 0
            ),
            previous: {
              sales: prevStatusBreakdown.completed?.total || 0,
              orders: prevStatusBreakdown.completed?.count || 0
            }
          },
          delivered: {
            salesChange: calculatePercentageChange(
              statusBreakdown.delivered?.total || 0, 
              prevStatusBreakdown.delivered?.total || 0
            ),
            ordersChange: calculatePercentageChange(
              statusBreakdown.delivered?.count || 0, 
              prevStatusBreakdown.delivered?.count || 0
            ),
            previous: {
              sales: prevStatusBreakdown.delivered?.total || 0,
              orders: prevStatusBreakdown.delivered?.count || 0
            }
          },
          processing: {
            salesChange: calculatePercentageChange(
              statusBreakdown.processing?.total || 0, 
              prevStatusBreakdown.processing?.total || 0
            ),
            ordersChange: calculatePercentageChange(
              statusBreakdown.processing?.count || 0, 
              prevStatusBreakdown.processing?.count || 0
            ),
            previous: {
              sales: prevStatusBreakdown.processing?.total || 0,
              orders: prevStatusBreakdown.processing?.count || 0
            }
          }
        },
        customerTypes: {
          distributors: {
            salesChange: calculatePercentageChange(distributorStats.sales, prevDistributorStats.sales),
            ordersChange: calculatePercentageChange(distributorStats.orders, prevDistributorStats.orders),
            customersChange: calculatePercentageChange(distributorStats.customers, prevDistributorStats.customers),
            previous: prevDistributorStats
          },
          customers: {
            salesChange: calculatePercentageChange(customerStats.sales, prevCustomerStats.sales),
            ordersChange: calculatePercentageChange(customerStats.orders, prevCustomerStats.orders),
            customersChange: calculatePercentageChange(customerStats.customers, prevCustomerStats.customers),
            previous: prevCustomerStats
          }
        },
        periodInfo: {
          currentLabel: periodLabel,
          previousStart: previousPeriod.startDate,
          previousEnd: previousPeriod.endDate,
          comparisonPeriod: comparisonPeriodParam,
          daysDifference: Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
        }
      };
      
    } catch (error) {
      console.error('Error calculando datos comparativos:', error);
      comparativeData = null;
    }

    // ================================
    // NUEVO: PROCESAMIENTO DE COSTOS DE ENVÍO DESDE ENVIA.COM
    // ================================
    
    const shippingStats = {
      totalRealCost: 0,
      totalWooCommerceCost: 0,
      ordersWithShipping: 0,
      carriers: {},
      savings: 0,
      found: 0,
      notFound: 0,
      details: [],
      sources: {
        offline_mapping: 0,
        api_realtime: 0,
        not_found: 0
      }
    };
    
    console.log(`🚚 Iniciando análisis de costos de envío para ${orders.length} órdenes...`);
    
    // Cargar mapeo offline al inicio
    const mapping = loadEnviaOrderMapping();
    console.log(`📦 Mapeo offline cargado con ${Object.keys(mapping).length} órdenes`);
    
    // Procesar costos de envío solo para primeras 50 órdenes para evitar timeouts
    const ordersToProcess = orders.slice(0, 50);
    console.log(`🚀 Procesando ${ordersToProcess.length} órdenes de ${orders.length} total para análisis de shipping`);
    
    for (const order of ordersToProcess) {
      const orderReference = order.id.toString();
      const wooShippingCost = parseFloat(order.shipping_total) || 0;
      
      // Procesar todas las órdenes que pueden tener envío (no solo las con shipping_total > 0)
      // Porque en Adaptoheal muchas son envío "gratuito" pero tienen costo real
      if (wooShippingCost >= 0 || (order.shipping_lines && order.shipping_lines.length > 0)) {
        try {
          const enviaResult = await getShippingCostByOrderReference(orderReference);
          
          shippingStats.ordersWithShipping++;
          shippingStats.totalWooCommerceCost += wooShippingCost;
          
          // Contar fuentes de datos
          if (enviaResult.source) {
            shippingStats.sources[enviaResult.source]++;
          }
          
          if (enviaResult.found) {
            const realCost = parseFloat(enviaResult.cost) || 0;
            shippingStats.totalRealCost += realCost;
            shippingStats.found++;
            
            // Agregar estadísticas por carrier
            const carrier = enviaResult.carrier || 'Unknown';
            if (!shippingStats.carriers[carrier]) {
              shippingStats.carriers[carrier] = {
                name: carrier,
                totalCost: 0,
                ordersCount: 0,
                avgCost: 0
              };
            }
            shippingStats.carriers[carrier].totalCost += realCost;
            shippingStats.carriers[carrier].ordersCount++;
            
            // Guardar detalle para debugging
            shippingStats.details.push({
              orderId: order.id,
              wooShipping: wooShippingCost,
              realCost: realCost,
              carrier: carrier,
              service: enviaResult.service,
              tracking: enviaResult.tracking_number,
              difference: realCost - wooShippingCost,
              source: enviaResult.source,
              shipmentsCount: enviaResult.shipments_count || 1
            });
            
            const source_emoji = enviaResult.source === 'offline_mapping' ? '📦' : '🌐';
            console.log(`✅ ${source_emoji} Orden ${orderReference}: WooCommerce $${wooShippingCost} vs Envia $${realCost} (${carrier})`);
          } else {
            shippingStats.notFound++;
            console.log(`❌ Orden ${orderReference}: No encontrado en Envia.com`);
          }
        } catch (error) {
          shippingStats.notFound++;
          console.error(`Error procesando envío para orden ${orderReference}:`, error.message);
        }
        
        // Solo pausa si usamos API en tiempo real
        if (!mapping[orderReference]) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }
    
    // Calcular métricas finales de envío
    shippingStats.savings = shippingStats.totalRealCost - shippingStats.totalWooCommerceCost;
    shippingStats.avgRealCost = shippingStats.found > 0 ? shippingStats.totalRealCost / shippingStats.found : 0;
    shippingStats.avgWooCommerceCost = shippingStats.ordersWithShipping > 0 ? shippingStats.totalWooCommerceCost / shippingStats.ordersWithShipping : 0;
    
    // Calcular promedios por carrier
    Object.values(shippingStats.carriers).forEach(carrier => {
      carrier.avgCost = carrier.ordersCount > 0 ? carrier.totalCost / carrier.ordersCount : 0;
    });
    
    console.log(`📊 Análisis de envíos completado:`);
    console.log(`   - Órdenes con envío: ${shippingStats.ordersWithShipping}`);
    console.log(`   - Encontrados en Envia.com: ${shippingStats.found}`);
    console.log(`   - No encontrados: ${shippingStats.notFound}`);
    console.log(`   - Fuentes: Mapeo offline ${shippingStats.sources.offline_mapping}, API ${shippingStats.sources.api_realtime}`);
    console.log(`   - Costo real total: $${shippingStats.totalRealCost.toFixed(2)} MXN`);
    console.log(`   - Costo WooCommerce: $${shippingStats.totalWooCommerceCost.toFixed(2)} MXN`);
    console.log(`   - Diferencia (ahorro real): $${shippingStats.savings.toFixed(2)} MXN`);
    
    // ================================
    // PROCESAMIENTO DE CUPONES
    // ================================
    const couponsStats = {};
    let totalCouponsAmount = 0;
    let totalCouponsOrders = 0;
    
    // ================================
    // NUEVO: ANÁLISIS DE CUPONES DE ENVÍO GRATIS
    // ================================
    const freeShippingCoupons = {
      totalRealCost: 0,
      totalOrders: 0,
      coupons: {},
      details: []
    };
    
    // Lista de códigos de cupones que indican envío gratis
    // NOTA: 'guiapropia' removido porque el cliente paga su propio envío (no hay costo para Adaptoheal)
    const freeShippingCodes = ['enviodist', 'envío gratis', 'envio gratis', 'free_shipping'];
    
    try {
      // Primero, identificar todas las órdenes con cupones de envío gratis
      const ordersWithFreeShipping = [];
      
      // Procesar cupones desde las órdenes
      orders.forEach((order) => {
        if (order.coupon_lines && Array.isArray(order.coupon_lines) && order.coupon_lines.length > 0) {
          totalCouponsOrders++;
          
          // Verificar si esta orden tiene cupones de envío gratis
          let hasFreeShippingCoupon = false;
          let freeShippingCouponCodes = [];
          
          order.coupon_lines.forEach((couponLine) => {
            const couponCode = couponLine.code || 'Cupón sin código';
            const discountAmount = Math.abs(parseFloat(couponLine.discount) || 0);
            
            if (!couponsStats[couponCode]) {
              couponsStats[couponCode] = {
                code: couponCode,
                totalDiscount: 0,
                ordersCount: 0,
                orders: new Set()
              };
            }
            
            couponsStats[couponCode].totalDiscount += discountAmount;
            couponsStats[couponCode].orders.add(order.id);
            totalCouponsAmount += discountAmount;
            
            // Verificar si es un cupón de envío gratis
            if (freeShippingCodes.some(code => couponCode.toLowerCase().includes(code.toLowerCase()))) {
              hasFreeShippingCoupon = true;
              freeShippingCouponCodes.push(couponCode);
            }
          });
          
          // Si tiene cupón de envío gratis, agregarlo a la lista para procesamiento bulk
          if (hasFreeShippingCoupon) {
            ordersWithFreeShipping.push({
              order: order,
              couponCodes: freeShippingCouponCodes
            });
          }
        }
      });
      
      // Procesar órdenes con envío gratis usando PostgreSQL (bulk)
      if (ordersWithFreeShipping.length > 0) {
        const orderIds = ordersWithFreeShipping.map(item => item.order.id);
        console.log(`🔍 Obteniendo costos de envío para ${orderIds.length} órdenes con cupones de envío gratis...`);
        
        const bulkShippingCosts = await getBulkShippingCosts(orderIds);
        
        ordersWithFreeShipping.forEach(({order, couponCodes}) => {
          const shippingData = bulkShippingCosts[order.id];
          const realShippingCost = shippingData ? shippingData.cost : 0; // SIN COSTO si no hay datos de PostgreSQL
          
          freeShippingCoupons.totalRealCost += realShippingCost;
          freeShippingCoupons.totalOrders++;
          
          // Registrar por código de cupón
          couponCodes.forEach(couponCode => {
            if (!freeShippingCoupons.coupons[couponCode]) {
              freeShippingCoupons.coupons[couponCode] = {
                code: couponCode,
                totalRealCost: 0,
                ordersCount: 0,
                avgCostPerOrder: 0
              };
            }
            freeShippingCoupons.coupons[couponCode].totalRealCost += realShippingCost;
            freeShippingCoupons.coupons[couponCode].ordersCount++;
          });
          
          freeShippingCoupons.details.push({
            orderId: order.id,
            couponCodes: couponCodes,
            realCost: realShippingCost,
            customerEmail: order.billing.email,
            orderTotal: parseFloat(order.total),
            source: shippingData ? shippingData.source : 'standard_cost'
          });
          
          const source = shippingData ? shippingData.source : 'no_postgres_data';
          if (realShippingCost > 0) {
            console.log(`✅ PostgreSQL: Orden ${order.id} cupón envío gratis (${couponCodes.join(', ')}) = $${realShippingCost} (${source})`);
          } else {
            console.log(`❌ Sin PostgreSQL: Orden ${order.id} cupón envío gratis (${couponCodes.join(', ')}) = $0 - requiere conexión DB`);
          }
        });
      }
      
      // Convertir a array y calcular métricas
      Object.keys(couponsStats).forEach(code => {
        couponsStats[code].ordersCount = couponsStats[code].orders.size;
        couponsStats[code].avgDiscountPerOrder = couponsStats[code].ordersCount > 0 ? 
          couponsStats[code].totalDiscount / couponsStats[code].ordersCount : 0;
        couponsStats[code].percentage = totalCouponsAmount > 0 ? 
          (couponsStats[code].totalDiscount / totalCouponsAmount * 100).toFixed(1) : '0';
        delete couponsStats[code].orders; // Limpiar el Set
      });
      
      // Calcular promedios para cupones de envío gratis
      Object.values(freeShippingCoupons.coupons).forEach(coupon => {
        coupon.avgCostPerOrder = coupon.ordersCount > 0 ? coupon.totalRealCost / coupon.ordersCount : 0;
      });
      
      console.log(`Cupones procesados: ${Object.keys(couponsStats).length} cupones únicos, ${totalCouponsOrders} órdenes con cupón, $${totalCouponsAmount} total descontado`);
      console.log(`🆓📦 Análisis de cupones de envío gratis:`);
      console.log(`   - Órdenes con envío gratis: ${freeShippingCoupons.totalOrders}`);
      console.log(`   - Costo real absorbido: $${freeShippingCoupons.totalRealCost.toFixed(2)} MXN`);
      console.log(`   - Promedio por orden gratis: $${freeShippingCoupons.totalOrders > 0 ? (freeShippingCoupons.totalRealCost / freeShippingCoupons.totalOrders).toFixed(2) : 0} MXN`);
      
    } catch (error) {
      console.error('Error procesando cupones:', error);
    }

    return {
      success: true,
      data: {
        // MÉTRICAS PRINCIPALES TOTALES (nombres esperados por el frontend)
        revenue: totalSales,
        orders: orders.length,
        averageOrderValue: avgTicket,
        
        // COMPATIBILIDAD CON NOMBRES ANTIGUOS
        totalSales30Days: totalSales,
        avgTicket30Days: avgTicket,
        ordersCount30Days: orders.length,
        
        // DESGLOSE POR MÉTODO DE PAGO
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
        
        // DESGLOSE POR ESTADOS DE ÓRDENES
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
        
        // DESGLOSE POR TIPO DE CLIENTE (Cliente vs Distribuidor)
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
        
        // PRODUCTOS TOP CON DATOS REALES
        topProducts: products.slice(0, 5).map((product) => ({
          id: product.id,
          name: product.name,
          quantity: product.totalQuantity,           // Cantidad vendida real
          totalSales: product.totalSales,           // Monto total de ventas
          ordersCount: product.ordersCount,         // Número de órdenes
          avgPrice: product.avgPrice,               // Precio promedio
          percentage: product.percentage             // Porcentaje de participación
        })),
        topOrders: topOrders,
        
        // CUPONES DE DESCUENTO
        coupons: {
          totalAmount: totalCouponsAmount,
          totalOrders: totalCouponsOrders,
          couponsUsed: Object.values(couponsStats).sort((a, b) => b.totalDiscount - a.totalDiscount),
          summary: {
            uniqueCoupons: Object.keys(couponsStats).length,
            avgDiscountPerOrder: totalCouponsOrders > 0 ? totalCouponsAmount / totalCouponsOrders : 0,
            percentageOfTotalSales: totalSales > 0 ? (totalCouponsAmount / totalSales * 100).toFixed(1) : '0'
          }
        },
        
        // NUEVO: COSTO REAL DE CUPONES DE ENVÍO GRATIS
        freeShippingCoupons: {
          totalRealCost: freeShippingCoupons.totalRealCost,
          totalOrders: freeShippingCoupons.totalOrders,
          avgCostPerOrder: freeShippingCoupons.totalOrders > 0 ? freeShippingCoupons.totalRealCost / freeShippingCoupons.totalOrders : 0,
          couponsBreakdown: Object.values(freeShippingCoupons.coupons).sort((a, b) => b.totalRealCost - a.totalRealCost),
          summary: {
            percentageOfTotalSales: totalSales > 0 ? (freeShippingCoupons.totalRealCost / totalSales * 100).toFixed(2) : '0',
            percentageOfShippingCosts: shippingStats.totalRealCost > 0 ? (freeShippingCoupons.totalRealCost / shippingStats.totalRealCost * 100).toFixed(1) : '0',
            avgDiscountGiven: freeShippingCoupons.totalOrders > 0 ? (freeShippingCoupons.totalRealCost / freeShippingCoupons.totalOrders).toFixed(2) : '0'
          },
          topFreeShippingOrders: freeShippingCoupons.details.sort((a, b) => b.realCost - a.realCost).slice(0, 5)
        },
        
        // NUEVO: COSTOS DE ENVÍO REALES DESDE ENVIA.COM
        shippingCosts: {
          totalRealCost: shippingStats.totalRealCost,
          totalWooCommerceCost: shippingStats.totalWooCommerceCost,
          ordersWithShipping: shippingStats.ordersWithShipping,
          found: shippingStats.found,
          notFound: shippingStats.notFound,
          avgRealCost: shippingStats.avgRealCost,
          avgWooCommerceCost: shippingStats.avgWooCommerceCost,
          costDifference: shippingStats.savings,
          carriers: Object.values(shippingStats.carriers).sort((a, b) => b.totalCost - a.totalCost),
          summary: {
            coveragePercentage: shippingStats.ordersWithShipping > 0 ? (shippingStats.found / shippingStats.ordersWithShipping * 100).toFixed(1) : '0',
            avgCostPerOrder: shippingStats.found > 0 ? (shippingStats.totalRealCost / shippingStats.found).toFixed(2) : '0',
            percentageOfTotalSales: totalSales > 0 ? (shippingStats.totalRealCost / totalSales * 100).toFixed(2) : '0',
            estimatedMonthlyCost: shippingStats.avgRealCost * 30 // Estimación mensual basada en promedio
          },
          topShipments: shippingStats.details.sort((a, b) => b.realCost - a.realCost).slice(0, 5)
        },
        
        // ESTADO DE CONEXIÓN POSTGRESQL
        postgres: {
          connected: await testConnection(),
          status: (await testConnection()) ? 'connected' : 'disconnected',
          message: (await testConnection()) ? 'PostgreSQL conectado - mostrando datos reales' : 'PostgreSQL desconectado - datos de envío no disponibles',
          lastCheck: new Date().toISOString()
        },
        
        // DATOS COMPARATIVOS CON PERÍODO ANTERIOR
        comparative: comparativeData
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
          if (!acc[order.status]) acc[order.status] = 0;
          acc[order.status]++;
          return acc;
        }, {}),
        activeFilters: allowedStatuses,
        periodInfo: {
          label: periodLabel,
          startDate: startDate,
          endDate: endDate,
          type: customStartDate && customEndDate ? 'custom' : periodParam
        }
      }
    };
  } catch (error) {
    console.error('Dashboard API error:', error);
    return { 
      success: false, 
      error: 'Error obteniendo datos del dashboard' 
    };
  }
};

// Función para manejar chat IA
const handleChat = async (message) => {
  if (!message) {
    return { success: false, error: 'Mensaje requerido' };
  }

  try {
    const startTime = Date.now();
    
    // Obtener datos específicos de agosto-septiembre 2025 para contexto
    const augustStart = new Date('2025-08-01T00:00:00Z').toISOString();
    const septemberEnd = new Date('2025-09-30T23:59:59Z').toISOString();
    
    const [orders, products, customers] = await Promise.all([
      fetchWooCommerceData('orders', `after=${augustStart}&before=${septemberEnd}&per_page=100&status=completed`),
      fetchWooCommerceData('products', 'per_page=20&orderby=popularity'),
      fetchWooCommerceData('customers', 'per_page=20&orderby=registered_date&order=desc')
    ]);
    
    // Calcular métricas detalladas
    const totalSales = orders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    const avgTicket = orders.length > 0 ? totalSales / orders.length : 0;
    
    // Análisis por mes (corrección de timezone)
    const augustOrders = orders.filter((o) => {
      const date = new Date(o.date_created);
      const month = date.getMonth();
      const year = date.getFullYear();
      return year === 2025 && month === 7; // Agosto = mes 7 (0-indexed)
    });
    const septemberOrders = orders.filter((o) => {
      const date = new Date(o.date_created);
      const month = date.getMonth();  
      const year = date.getFullYear();
      return year === 2025 && month === 8; // Septiembre = mes 8 (0-indexed)
    });
    const octoberOrders = orders.filter((o) => {
      const date = new Date(o.date_created);
      const month = date.getMonth();  
      const year = date.getFullYear();
      return year === 2025 && month === 9; // Octubre = mes 9 (0-indexed)
    });
    
    const augustSales = augustOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    const septemberSales = septemberOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    const octoberSales = octoberOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    
    // Top clientes del período
    const customerSales = new Map();
    orders.forEach((order) => {
      const customerName = `${order.billing.first_name} ${order.billing.last_name}`.trim();
      const currentTotal = customerSales.get(customerName) || 0;
      customerSales.set(customerName, currentTotal + parseFloat(order.total));
    });
    const topCustomers = Array.from(customerSales.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    // Organizar datos por fechas específicas para consultas de "hoy", "ayer", etc.
    const ordersByDate = new Map();
    const salesByDate = new Map();
    
    orders.forEach((order) => {
      const orderDate = new Date(order.date_created).toLocaleDateString('es-MX');
      if (!ordersByDate.has(orderDate)) {
        ordersByDate.set(orderDate, []);
        salesByDate.set(orderDate, 0);
      }
      ordersByDate.get(orderDate).push(order);
      salesByDate.set(orderDate, salesByDate.get(orderDate) + parseFloat(order.total));
    });
    
    // Preparar resumen de fechas recientes (últimos 7 días con datos)
    const recentDatesData = Array.from(salesByDate.entries())
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .slice(0, 7)
      .map(([date, sales]) => ({
        fecha: date,
        ordenes: ordersByDate.get(date).length,
        ventas: sales
      }));
    
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
    ).join('\n')}
    
    ANÁLISIS DETALLADO POR MES:
    
    📊 AGOSTO 2025:
    - Órdenes completadas: ${augustOrders.length}
    - Ventas totales: $${augustSales.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN
    - Ticket promedio: $${augustOrders.length > 0 ? (augustSales/augustOrders.length).toLocaleString('es-MX', {minimumFractionDigits: 2}) : '0.00'} MXN
    ${augustOrders.length > 0 ? `- Orden más alta agosto: $${Math.max(...augustOrders.map((o) => parseFloat(o.total))).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN` : ''}
    
    📊 SEPTIEMBRE 2025:
    - Órdenes completadas: ${septemberOrders.length}  
    - Ventas totales: $${septemberSales.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN
    - Ticket promedio: $${septemberOrders.length > 0 ? (septemberSales/septemberOrders.length).toLocaleString('es-MX', {minimumFractionDigits: 2}) : '0.00'} MXN
    ${septemberOrders.length > 0 ? `- Orden más alta septiembre: $${Math.max(...septemberOrders.map((o) => parseFloat(o.total))).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN` : ''}
    
    📊 OCTUBRE 2025:
    - Órdenes completadas: ${octoberOrders.length}  
    - Ventas totales: $${octoberSales.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN
    - Ticket promedio: $${octoberOrders.length > 0 ? (octoberSales/octoberOrders.length).toLocaleString('es-MX', {minimumFractionDigits: 2}) : '0.00'} MXN
    ${octoberOrders.length > 0 ? `- Orden más alta octubre: $${Math.max(...octoberOrders.map((o) => parseFloat(o.total))).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN` : ''}
    
    📈 COMPARATIVA:
    - Diferencia en ventas Ago vs Sep: ${septemberSales > augustSales ? '+' : ''}$${(septemberSales - augustSales).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN (${((septemberSales - augustSales) / (augustSales || 1) * 100).toFixed(1)}%)
    - Diferencia en órdenes Ago vs Sep: ${septemberOrders.length - augustOrders.length} órdenes
    - Performance Oct 2024: ${octoberSales.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN con ${octoberOrders.length} órdenes
    
    TOP 5 PRODUCTOS MÁS VENDIDOS:
    ${products.slice(0, 5).map((p, i) => 
      `${i+1}. ${p.name}: ${p.total_sales || 0} ventas totales, Precio: $${parseFloat(p.price).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN`
    ).join('\n')}
    
    TOP 5 CLIENTES (por compras en el período):
    ${topCustomers.map((c, i) => 
      `${i+1}. ${c[0]}: $${c[1].toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN`
    ).join('\n')}
    
    ÓRDENES MÁS GRANDES DEL PERÍODO:
    ${orders.sort((a, b) => parseFloat(b.total) - parseFloat(a.total))
      .slice(0, 5)
      .map((o, i) => 
        `${i+1}. Orden #${o.id}: $${parseFloat(o.total).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN - ${o.billing.first_name} ${o.billing.last_name} (${new Date(o.date_created).toLocaleDateString('es-MX')})`
      ).join('\n')}
    
    PRODUCTOS ADAPTOHEAL:
    ${products.slice(0, 10).map((p) => `- ${p.name}: Stock ${p.stock_quantity || 'N/A'}, Precio $${parseFloat(p.price).toFixed(2)} MXN`).join('\n')}
    `;
    
    const response = await queryOpenAI(message, context);
    const executionTime = Date.now() - startTime;
    
    return {
      success: true,
      data: {
        response,
        executionTime
      }
    };
    
  } catch (error) {
    console.error('Chat API error:', error);
    return {
      success: false,
      error: 'Error procesando consulta con IA'
    };
  }
};

// HTML de la interfaz completa restaurada
const getHTML = () => {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Adaptoheal Analytics - Dashboard Inteligente</title>
        <link rel="icon" type="image/webp" href="https://www.adaptohealmx.com/wp-content/uploads/2025/05/favicon.webp">
        <link rel="shortcut icon" type="image/webp" href="https://www.adaptohealmx.com/wp-content/uploads/2025/05/favicon.webp">
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
        <!-- Modern Header with Gradient - RESPONSIVE OPTIMIZADO -->
        <div class="gradient-bg shadow-xl">
            <div class="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
                <!-- Header Principal: Logo y Título -->
                <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-6 lg:space-y-0">
                    <div class="flex items-center space-x-3 sm:space-x-4">
                        <img src="https://www.adaptohealmx.com/wp-content/uploads/2025/05/Logo1-300x86.webp" 
                             alt="Adaptoheal México" 
                             class="h-8 sm:h-10 lg:h-12 w-auto">
                        <div>
                            <h1 class="text-lg sm:text-2xl lg:text-3xl font-bold text-white">Analytics Dashboard</h1>
                            <p class="text-blue-100 mt-1 text-xs sm:text-sm">Datos en tiempo real | Análisis Inteligente</p>
                        </div>
                    </div>
                    
                    <!-- User Info - Móvil en la misma línea -->
                    <div class="flex items-center justify-end space-x-3 lg:hidden">
                        <div class="text-right">
                            <p id="user-name-mobile" class="text-white text-sm font-medium">Usuario</p>
                            <p class="text-blue-100 text-xs">Dashboard</p>
                        </div>
                        
                        <!-- Admin Users Button (only for admins) -->
                        <button id="admin-users-btn-mobile" onclick="openUserManagement()" 
                                class="bg-blue-500/20 hover:bg-blue-500/30 text-white px-2 py-1 rounded-lg text-xs font-medium transition-all duration-200 border border-blue-400/20 hidden">
                            <i class="fas fa-users"></i>
                        </button>
                        
                        <button onclick="logout()" 
                                class="bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded-lg text-xs font-medium transition-all duration-200 border border-white/20">
                            <i class="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Controles de Período: Stack en móvil, flex en desktop -->
                <div class="mt-6 lg:mt-4">
                    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                        <!-- SELECTORES DE PERÍODO -->
                        <div class="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 lg:space-x-6">
                            <div class="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                                <label class="text-white text-xs sm:text-sm font-medium whitespace-nowrap">Período Principal:</label>
                                
                                <!-- Selector de períodos predefinidos -->
                                <select id="period-selector" onchange="changePeriod()" 
                                        class="bg-white text-gray-800 border border-gray-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-gray-50 transition-all shadow-lg w-full sm:w-auto">
                                
                                <!-- Períodos Principales -->
                                <optgroup label="📊 Períodos de Análisis" style="color: #1f2937; font-weight: bold;">
                                    <option value="today" style="color: #1f2937; background: white;">📅 Hoy</option>
                                    <option value="yesterday" style="color: #1f2937; background: white;">📅 Ayer</option>
                                    <option value="last-7-days" selected style="color: #1f2937; background: white;">📊 Últimos 7 días</option>
                                    <option value="last-14-days" style="color: #1f2937; background: white;">📈 Últimos 14 días</option>
                                    <option value="last-30-days" style="color: #1f2937; background: white;">📈 Últimos 30 días</option>
                                </optgroup>
                                
                                <!-- Períodos Mensuales -->
                                <optgroup label="📅 Períodos Mensuales" style="color: #1f2937; font-weight: bold;">
                                    <option value="august-2025" style="color: #1f2937; background: white;">🌟 Agosto 2025</option>
                                    <option value="september-2025" style="color: #1f2937; background: white;">🍂 Septiembre 2025</option>
                                    <option value="october-2025" style="color: #1f2937; background: white;">🎃 Octubre 2025</option>
                                </optgroup>
                                
                                <!-- Rango Personalizado -->
                                <optgroup label="🔧 Personalizado" style="color: #1f2937; font-weight: bold;">
                                    <option value="custom" style="color: #1f2937; background: white;">📅 Seleccionar fechas...</option>
                                </optgroup>
                            </select>
                        </div>
                        
                            <!-- Checkbox de comparación simplificado -->
                            <div class="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                                <label class="flex items-center space-x-2 cursor-pointer bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 transition-all duration-200 border border-white/20">
                                    <input type="checkbox" id="enable-comparison" onchange="toggleComparison()" checked
                                           class="rounded border-gray-300 text-purple-600 focus:ring-purple-500 focus:ring-offset-0">
                                    <span class="text-white text-xs sm:text-sm font-medium">
                                        <i class="fas fa-chart-line mr-1"></i>
                                        Activar comparación
                                    </span>
                                </label>
                                
                                <!-- Indicador dinámico del período de comparación -->
                                <div id="comparison-period-info" class="text-white text-xs bg-purple-500/20 px-3 py-2 rounded-lg border border-purple-400/30">
                                    <i class="fas fa-arrows-alt-h mr-1"></i>
                                    <span id="comparison-period-text">vs Período anterior equivalente</span>
                                </div>
                            </div>
                        
                        </div>
                        
                        <!-- Panel de fechas personalizado (oculto por defecto) - RESPONSIVE -->
                        <div id="custom-date-panel" class="hidden flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/30 mt-3 lg:mt-0">
                            <div class="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                                <label class="text-white text-xs font-medium">Desde:</label>
                                <input type="date" id="start-date" class="bg-white text-gray-800 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-auto">
                                <label class="text-white text-xs font-medium">Hasta:</label>
                                <input type="date" id="end-date" class="bg-white text-gray-800 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-auto">
                            </div>
                            <div class="flex space-x-2">
                                <button onclick="applyCustomDates()" class="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition-colors">
                                    <i class="fas fa-check mr-1"></i>Aplicar
                                </button>
                                <button onclick="cancelCustomDates()" class="bg-gray-500 text-white px-2 py-1 rounded text-xs hover:bg-gray-600 transition-colors">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                        
                        <!-- Controles de Estado y Usuario - Desktop -->
                        <div class="hidden lg:flex items-center space-x-4">
                        
                            <div class="flex flex-col">
                                <div class="flex items-center space-x-2">
                                    <div class="pulse-dot w-3 h-3 bg-green-400 rounded-full"></div>
                                    <span class="text-white text-sm font-medium">Conectado en vivo</span>
                                </div>
                                <span class="text-white text-xs opacity-70 ml-5">WooCommerce API v3</span>
                            </div>
                            

                            <!-- User Info and Actions - Desktop Only -->
                            <div class="flex items-center space-x-3 border-l border-white/20 pl-4">
                                <div class="text-right">
                                    <p id="user-name" class="text-white text-sm font-medium">Usuario</p>
                                    <p class="text-blue-100 text-xs">Dashboard Adaptoheal</p>
                                </div>
                                
                                <!-- Admin Users Button (only for admins) -->
                                <button id="admin-users-btn" onclick="openUserManagement()" 
                                        class="bg-blue-500/20 hover:bg-blue-500/30 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 border border-blue-400/20 hidden">
                                    <i class="fas fa-users mr-1"></i>Usuarios
                                </button>
                                
                                <button onclick="logout()" 
                                        class="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 border border-white/20">
                                    <i class="fas fa-sign-out-alt mr-1"></i>Salir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- FILTRO DE ESTADOS DE ÓRDENES -->
        <div class="bg-white shadow-lg border-t border-gray-200">
            <div class="container mx-auto px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                        <div class="flex items-center space-x-2">
                            <i class="fas fa-filter text-gray-600"></i>
                            <span class="text-sm font-medium text-gray-700">Estados de Órdenes:</span>
                        </div>
                        
                        <!-- Checkboxes de Estados -->
                        <div class="flex items-center space-x-4 flex-wrap">
                            <label class="flex items-center space-x-1 cursor-pointer">
                                <input type="checkbox" id="status-completed" checked onchange="updateOrderStatusFilter()" 
                                       class="rounded border-gray-300 text-green-600 focus:ring-green-500">
                                <span class="text-xs font-medium text-gray-700">
                                    <span class="inline-block w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                                    Completadas (<span id="count-completed">0</span>)
                                </span>
                            </label>
                            
                            <label class="flex items-center space-x-1 cursor-pointer">
                                <input type="checkbox" id="status-delivered" checked onchange="updateOrderStatusFilter()"
                                       class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                                <span class="text-xs font-medium text-gray-700">
                                    <span class="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
                                    Entregadas (<span id="count-delivered">0</span>)
                                </span>
                            </label>
                            
                            <label class="flex items-center space-x-1 cursor-pointer">
                                <input type="checkbox" id="status-processing" checked onchange="updateOrderStatusFilter()"
                                       class="rounded border-gray-300 text-orange-600 focus:ring-orange-500">
                                <span class="text-xs font-medium text-gray-700">
                                    <span class="inline-block w-2 h-2 bg-orange-500 rounded-full mr-1"></span>
                                    En Proceso (<span id="count-processing">0</span>)
                                </span>
                            </label>
                            
                            <label class="flex items-center space-x-1 cursor-pointer">
                                <input type="checkbox" id="status-on-hold" checked onchange="updateOrderStatusFilter()"
                                       class="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500">
                                <span class="text-xs font-medium text-gray-700">
                                    <span class="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-1"></span>
                                    En Espera (<span id="count-on-hold">0</span>)
                                </span>
                            </label>
                            
                            <label class="flex items-center space-x-1 cursor-pointer">
                                <input type="checkbox" id="status-pending" checked onchange="updateOrderStatusFilter()"
                                       class="rounded border-gray-300 text-gray-600 focus:ring-gray-500">
                                <span class="text-xs font-medium text-gray-700">
                                    <span class="inline-block w-2 h-2 bg-gray-500 rounded-full mr-1"></span>
                                    Pendientes (<span id="count-pending">0</span>)
                                </span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- Presets de WooCommerce -->
                    <div class="flex items-center space-x-2">
                        <span class="text-xs text-gray-500">Presets:</span>
                        <button onclick="applyWooCommercePreset()" 
                                class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-medium hover:bg-blue-200 transition-colors">
                            <i class="fab fa-wordpress mr-1"></i>WooCommerce
                        </button>
                        <button onclick="applyConservativePreset()" 
                                class="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium hover:bg-green-200 transition-colors">
                            <i class="fas fa-shield-alt mr-1"></i>Conservador
                        </button>
                        <button onclick="applyAllStatusPreset()" 
                                class="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-medium hover:bg-purple-200 transition-colors">
                            <i class="fas fa-list mr-1"></i>Todos
                        </button>
                    </div>
                </div>
                
                <!-- INDICADOR DE PERÍODO ACTIVO -->
                <div class="border-t border-gray-100 bg-gray-50 py-2">
                    <div class="container mx-auto px-6">
                        <div class="flex items-center justify-between text-xs">
                            <div class="flex items-center space-x-2">
                                <i class="fas fa-calendar-alt text-gray-500"></i>
                                <span class="text-gray-600">Período activo:</span>
                                <span id="active-period-display" class="font-medium text-gray-800 bg-blue-100 px-2 py-1 rounded">
                                    Cargando...
                                </span>
                            </div>
                            <div class="flex items-center space-x-2">
                                <span class="text-gray-500">Estados activos:</span>
                                <span id="active-statuses-display" class="font-medium text-gray-800">
                                    Completadas, Entregadas
                                </span>
                            </div>
                        </div>
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
                    <p class="text-sm text-gray-500 mt-2">Procesando datos de ventas... Esto puede tardar 10-15 segundos</p>
                    <div class="mt-4 flex items-center justify-center space-x-2">
                        <div class="flex space-x-1">
                            <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                            <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                            <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                        </div>
                        <span class="text-xs text-gray-400 ml-3">⏱️ Tiempo estimado: 10-15 seg</span>
                    </div>
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
                            <!-- Leyenda de período removida - es redundante con el selector -->
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-600 mb-1">Ventas Totales</p>
                            <div class="flex items-center space-x-2">
                                <p id="total-sales" class="text-2xl font-bold text-gray-900">$0</p>
                                <div id="total-sales-change" class=""></div>
                            </div>
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
                            <div class="flex items-center space-x-2">
                                <p id="avg-ticket" class="text-2xl font-bold text-gray-900">$0</p>
                                <div id="avg-ticket-change" class=""></div>
                            </div>
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
                            <div class="flex items-center space-x-2">
                                <p id="orders-count" class="text-2xl font-bold text-gray-900">0</p>
                                <div id="orders-count-change" class=""></div>
                            </div>
                            <p class="text-xs text-gray-500 mt-1">Últimos 30 días</p>
                        </div>
                    </div>

                    <!-- Ficha de conexión API eliminada - estado movido al header -->
                </div>

                <!-- NUEVA SECCIÓN: Tipos de Cliente (Cliente vs Distribuidor) -->
                <div class="glass-effect rounded-xl p-8 card-hover">
                    <div class="flex items-center justify-between mb-6">
                        <div class="flex items-center space-x-3">
                            <div class="p-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600">
                                <i class="fas fa-users text-xl text-white"></i>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold text-gray-800">Tipos de Cliente</h3>
                                <p class="text-sm text-gray-600">Clasificación exacta por email - 26 distribuidores identificados</p>
                            </div>
                        </div>
                        <span class="text-xs font-medium text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                            <i class="fas fa-check-circle mr-1"></i>EXACTO
                        </span>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Distribuidores -->
                        <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
                            <div class="flex items-center justify-between mb-4">
                                <div class="p-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600">
                                    <i class="fas fa-crown text-xl text-white"></i>
                                </div>
                                <span id="distributors-percentage" class="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-full">0%</span>
                            </div>
                            <div>
                                <div class="flex items-center justify-between">
                                    <p class="text-sm font-medium text-gray-600 mb-1">Distribuidores</p>
                                    <div id="distributors-sales-change" class=""></div>
                                </div>
                                <p id="distributors-sales" class="text-xl font-bold text-gray-900">$0 MXN</p>
                                <div class="mt-2 space-y-1">
                                    <p id="distributors-orders" class="text-xs text-gray-500">0 órdenes</p>
                                    <p id="distributors-customers" class="text-xs text-purple-600">0 clientes únicos</p>
                                    <p id="distributors-avg-ticket" class="text-xs text-gray-500">Ticket prom: $0</p>
                                    <p id="distributors-avg-customer" class="text-xs text-purple-600">Por distribuidor: $0</p>
                                </div>
                                <div class="mt-3 text-xs text-gray-400">
                                    <i class="fas fa-info-circle mr-1"></i>
                                    Clasificación: Email en lista exacta de 26 distribuidores registrados
                                </div>
                            </div>
                        </div>
                        
                        <!-- Clientes Regulares -->
                        <div class="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-100">
                            <div class="flex items-center justify-between mb-4">
                                <div class="p-3 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-600">
                                    <i class="fas fa-user text-xl text-white"></i>
                                </div>
                                <span id="customers-percentage" class="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">0%</span>
                            </div>
                            <div>
                                <div class="flex items-center justify-between">
                                    <p class="text-sm font-medium text-gray-600 mb-1">Clientes Regulares</p>
                                    <div id="customers-sales-change" class=""></div>
                                </div>
                                <p id="customers-sales" class="text-xl font-bold text-gray-900">$0 MXN</p>
                                <div class="mt-2 space-y-1">
                                    <p id="customers-orders" class="text-xs text-gray-500">0 órdenes</p>
                                    <p id="customers-customers" class="text-xs text-blue-600">0 clientes únicos</p>
                                    <p id="customers-avg-ticket" class="text-xs text-gray-500">Ticket prom: $0</p>
                                    <p id="customers-avg-customer" class="text-xs text-blue-600">Por cliente: $0</p>
                                </div>
                                <div class="mt-3 text-xs text-gray-400">
                                    <i class="fas fa-shopping-cart mr-1"></i>
                                    Compras regulares y tickets menores
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- NUEVA SECCIÓN: Google Ads -->
                <div class="glass-effect rounded-xl p-8 card-hover">
                    <div class="flex items-center justify-between mb-6">
                        <div class="flex items-center space-x-3">
                            <div class="p-3 rounded-lg bg-gradient-to-r from-red-500 to-pink-600">
                                <i class="fab fa-google text-xl text-white"></i>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold text-gray-800">Google Ads</h3>
                                <p class="text-sm text-gray-600">Campañas publicitarias, impresiones, clicks y conversiones</p>
                            </div>
                        </div>
                        <span class="text-xs font-medium text-red-600 bg-red-100 px-3 py-1 rounded-full">
                            <i class="fas fa-ad mr-1"></i>ADS
                        </span>
                    </div>
                    
                    <div id="google-ads-section">
                        <!-- Loading state -->
                        <div id="google-ads-loading" class="text-center py-8">
                            <i class="fas fa-spinner fa-spin text-2xl text-gray-400 mb-3"></i>
                            <p class="text-sm text-gray-500">Cargando datos de Google Ads...</p>
                        </div>
                        
                        <!-- Google Ads content -->
                        <div id="google-ads-content" class="hidden">
                            <!-- Métricas principales -->
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div class="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-4 border border-red-100">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 bg-red-500 rounded-lg">
                                            <i class="fas fa-eye text-white text-sm"></i>
                                        </div>
                                        <div>
                                            <p class="text-xs font-medium text-gray-600">Impresiones</p>
                                            <p id="google-ads-impressions" class="text-xl font-bold text-gray-900">0</p>
                                            <p id="google-ads-period-label" class="text-xs text-gray-500">período actual</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 bg-blue-500 rounded-lg">
                                            <i class="fas fa-mouse-pointer text-white text-sm"></i>
                                        </div>
                                        <div>
                                            <p class="text-xs font-medium text-gray-600">Clicks</p>
                                            <p id="google-ads-clicks" class="text-xl font-bold text-gray-900">0</p>
                                            <p id="google-ads-ctr" class="text-xs text-gray-500">CTR: 0%</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 bg-green-500 rounded-lg">
                                            <i class="fas fa-dollar-sign text-white text-sm"></i>
                                        </div>
                                        <div>
                                            <p class="text-xs font-medium text-gray-600">Costo Total</p>
                                            <p id="google-ads-cost" class="text-xl font-bold text-gray-900">$0</p>
                                            <p id="google-ads-cpc" class="text-xs text-gray-500">CPC: $0</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 bg-purple-500 rounded-lg">
                                            <i class="fas fa-star text-white text-sm"></i>
                                        </div>
                                        <div>
                                            <p class="text-xs font-medium text-gray-600">Conversiones</p>
                                            <p id="google-ads-conversions" class="text-xl font-bold text-gray-900">0</p>
                                            <p id="google-ads-conversion-rate" class="text-xs text-gray-500">Tasa: 0%</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Campañas activas -->
                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div class="bg-gray-50 rounded-xl p-4">
                                    <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                                        <i class="fas fa-bullhorn text-red-500 mr-2"></i>
                                        Campañas Activas
                                    </h4>
                                    <div id="google-ads-campaigns" class="space-y-2">
                                        <!-- Se llenará dinámicamente -->
                                    </div>
                                </div>
                                
                                <!-- Account Info -->
                                <div class="bg-gray-50 rounded-xl p-4">
                                    <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                                        <i class="fas fa-info-circle text-blue-500 mr-2"></i>
                                        Información de Cuenta
                                    </h4>
                                    <div id="google-ads-account-info" class="space-y-2">
                                        <!-- Se llenará dinámicamente -->
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Error state -->
                        <div id="google-ads-error" class="hidden text-center py-8">
                            <i class="fas fa-exclamation-triangle text-3xl text-yellow-400 mb-3"></i>
                            <p class="text-sm text-gray-500">Error cargando datos de Google Ads</p>
                            <p id="google-ads-error-message" class="text-xs text-gray-400 mt-1"></p>
                        </div>
                    </div>
                </div>

                <!-- NUEVA SECCIÓN: Google Analytics 4 -->
                <div class="glass-effect rounded-xl p-8 card-hover">
                    <div class="flex items-center justify-between mb-6">
                        <div class="flex items-center space-x-3">
                            <div class="p-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600">
                                <i class="fas fa-chart-line text-xl text-white"></i>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold text-gray-800">Google Analytics 4</h3>
                                <p class="text-sm text-gray-600">Tráfico web, páginas populares y demografía</p>
                            </div>
                        </div>
                        <span class="text-xs font-medium text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                            <i class="fas fa-globe mr-1"></i>ANALYTICS
                        </span>
                    </div>
                    
                    <div id="analytics-section">
                        <!-- Loading state -->
                        <div id="analytics-loading" class="text-center py-8">
                            <i class="fas fa-spinner fa-spin text-2xl text-gray-400 mb-3"></i>
                            <p class="text-sm text-gray-500">Cargando datos de Google Analytics...</p>
                        </div>
                        
                        <!-- Analytics content -->
                        <div id="analytics-content" class="hidden">
                            <!-- Usuarios -->
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div class="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-100">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 bg-blue-500 rounded-lg">
                                            <i class="fas fa-users text-white text-sm"></i>
                                        </div>
                                        <div>
                                            <p class="text-xs font-medium text-gray-600">Usuarios Totales</p>
                                            <p id="ga4-total-users" class="text-xl font-bold text-gray-900">0</p>
                                            <p id="ga4-period-label" class="text-xs text-gray-500">período actual</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 border border-green-100">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 bg-green-500 rounded-lg">
                                            <i class="fas fa-user-plus text-white text-sm"></i>
                                        </div>
                                        <div>
                                            <p class="text-xs font-medium text-gray-600">Nuevos Usuarios</p>
                                            <p id="ga4-new-users" class="text-xl font-bold text-gray-900">0</p>
                                            <p id="ga4-new-users-percentage" class="text-xs text-gray-500">0% del total</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 bg-purple-500 rounded-lg">
                                            <i class="fas fa-user-check text-white text-sm"></i>
                                        </div>
                                        <div>
                                            <p class="text-xs font-medium text-gray-600">Usuarios Recurrentes</p>
                                            <p id="ga4-returning-users" class="text-xl font-bold text-gray-900">0</p>
                                            <p id="ga4-returning-percentage" class="text-xs text-gray-500">0% del total</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Páginas más visitadas -->
                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                <div class="bg-gray-50 rounded-xl p-4">
                                    <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                                        <i class="fas fa-fire text-orange-500 mr-2"></i>
                                        Páginas Más Visitadas
                                    </h4>
                                    <div id="ga4-top-pages" class="space-y-2">
                                        <!-- Se llenará dinámicamente -->
                                    </div>
                                </div>
                                
                                <!-- Demografía -->
                                <div class="bg-gray-50 rounded-xl p-4">
                                    <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                                        <i class="fas fa-globe-americas text-blue-500 mr-2"></i>
                                        Top Países
                                    </h4>
                                    <div id="ga4-countries" class="space-y-2">
                                        <!-- Se llenará dinámicamente -->
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Fuentes de tráfico -->
                            <div class="bg-gray-50 rounded-xl p-4">
                                <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                                    <i class="fas fa-share-alt text-green-500 mr-2"></i>
                                    Fuentes de Tráfico
                                </h4>
                                <div id="ga4-traffic-sources" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <!-- Se llenará dinámicamente -->
                                </div>
                            </div>
                        </div>
                        
                        <!-- Error state -->
                        <div id="analytics-error" class="hidden text-center py-8">
                            <i class="fas fa-exclamation-triangle text-3xl text-yellow-400 mb-3"></i>
                            <p class="text-sm text-gray-500">Error cargando datos de Google Analytics</p>
                            <p id="analytics-error-message" class="text-xs text-gray-400 mt-1"></p>
                        </div>
                    </div>
                </div>

                <!-- NUEVA SECCIÓN: Meta Ads (Facebook/Instagram) -->
                <div class="glass-effect rounded-xl p-8 card-hover">
                    <div class="flex items-center justify-between mb-6">
                        <div class="flex items-center space-x-3">
                            <div class="p-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600">
                                <i class="fab fa-facebook text-xl text-white"></i>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold text-gray-800">Meta Ads</h3>
                                <p class="text-sm text-gray-600">Campañas de Facebook e Instagram</p>
                            </div>
                        </div>
                        <span class="text-xs font-medium text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                            <i class="fab fa-meta mr-1"></i>META
                        </span>
                    </div>
                    
                    <div id="meta-ads-section">
                        <!-- Loading state -->
                        <div id="meta-ads-loading" class="text-center py-8">
                            <i class="fas fa-spinner fa-spin text-2xl text-gray-400 mb-3"></i>
                            <p class="text-sm text-gray-500">Cargando datos de Meta Ads...</p>
                        </div>
                        
                        <!-- Meta Ads content -->
                        <div id="meta-ads-content" class="hidden">
                            <!-- Métricas principales -->
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div class="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-100">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 bg-blue-500 rounded-lg">
                                            <i class="fas fa-dollar-sign text-white text-sm"></i>
                                        </div>
                                        <div>
                                            <p class="text-xs font-medium text-gray-600">Gasto Total</p>
                                            <p id="meta-total-spend" class="text-xl font-bold text-gray-900">$0</p>
                                            <p id="meta-spend-period" class="text-xs text-gray-500">período actual</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 bg-green-500 rounded-lg">
                                            <i class="fas fa-eye text-white text-sm"></i>
                                        </div>
                                        <div>
                                            <p class="text-xs font-medium text-gray-600">Impresiones</p>
                                            <p id="meta-total-impressions" class="text-xl font-bold text-gray-900">0</p>
                                            <p id="meta-impressions-period" class="text-xs text-gray-500">período actual</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4 border border-yellow-100">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 bg-yellow-500 rounded-lg">
                                            <i class="fas fa-mouse-pointer text-white text-sm"></i>
                                        </div>
                                        <div>
                                            <p class="text-xs font-medium text-gray-600">Clicks</p>
                                            <p id="meta-total-clicks" class="text-xl font-bold text-gray-900">0</p>
                                            <p id="meta-clicks-period" class="text-xs text-gray-500">período actual</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 bg-purple-500 rounded-lg">
                                            <i class="fas fa-bullseye text-white text-sm"></i>
                                        </div>
                                        <div>
                                            <p class="text-xs font-medium text-gray-600">Conversiones</p>
                                            <p id="meta-total-conversions" class="text-xl font-bold text-gray-900">0</p>
                                            <p id="meta-conversions-period" class="text-xs text-gray-500">período actual</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Métricas de rendimiento -->
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div class="bg-gray-50 rounded-xl p-4">
                                    <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                                        <i class="fas fa-percentage text-blue-500 mr-2"></i>
                                        CTR (Click-Through Rate)
                                    </h4>
                                    <p id="meta-ctr" class="text-2xl font-bold text-blue-600">0%</p>
                                    <p class="text-xs text-gray-500 mt-1">Tasa de clics</p>
                                </div>
                                
                                <div class="bg-gray-50 rounded-xl p-4">
                                    <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                                        <i class="fas fa-money-bill-wave text-green-500 mr-2"></i>
                                        CPM (Costo por mil impresiones)
                                    </h4>
                                    <p id="meta-cpm" class="text-2xl font-bold text-green-600">$0</p>
                                    <p class="text-xs text-gray-500 mt-1">Costo por 1,000 impresiones</p>
                                </div>
                                
                                <div class="bg-gray-50 rounded-xl p-4">
                                    <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                                        <i class="fas fa-hand-pointer text-orange-500 mr-2"></i>
                                        CPC (Costo por click)
                                    </h4>
                                    <p id="meta-cpc" class="text-2xl font-bold text-orange-600">$0</p>
                                    <p class="text-xs text-gray-500 mt-1">Costo promedio por click</p>
                                </div>
                            </div>
                            
                            <!-- Campañas activas y información de cuenta -->
                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div class="bg-gray-50 rounded-xl p-4">
                                    <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                                        <i class="fas fa-bullhorn text-purple-500 mr-2"></i>
                                        Campañas Activas
                                    </h4>
                                    <div id="meta-campaigns-list" class="space-y-3">
                                        <!-- Se llenará dinámicamente -->
                                    </div>
                                </div>
                                
                                <div class="bg-gray-50 rounded-xl p-4">
                                    <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                                        <i class="fas fa-info-circle text-blue-500 mr-2"></i>
                                        Información de Cuenta
                                    </h4>
                                    <div id="meta-account-info" class="space-y-2">
                                        <!-- Se llenará dinámicamente -->
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Error state -->
                        <div id="meta-ads-error" class="hidden text-center py-8">
                            <i class="fas fa-exclamation-triangle text-3xl text-yellow-400 mb-3"></i>
                            <p class="text-sm text-gray-500">Error cargando datos de Meta Ads</p>
                            <p id="meta-ads-error-message" class="text-xs text-gray-400 mt-1"></p>
                        </div>
                    </div>
                </div>

                <!-- NUEVA SECCIÓN: Meta Organic (Facebook Pages + Instagram Business) -->
                <div class="glass-effect rounded-xl p-8 card-hover">
                    <div class="flex items-center justify-between mb-6">
                        <div class="flex items-center space-x-3">
                            <div class="p-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600">
                                <i class="fas fa-heart text-xl text-white"></i>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold text-gray-800">Contenido Orgánico</h3>
                                <p class="text-sm text-gray-600">Facebook e Instagram - Seguidores, interacciones y alcance</p>
                            </div>
                        </div>
                        <span class="text-xs font-medium text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                            <i class="fas fa-users mr-1"></i>ORGÁNICO
                        </span>
                    </div>
                    
                    <div id="meta-organic-section">
                        <!-- Loading state -->
                        <div id="meta-organic-loading" class="text-center py-8">
                            <i class="fas fa-spinner fa-spin text-2xl text-gray-400 mb-3"></i>
                            <p class="text-sm text-gray-500">Cargando contenido orgánico...</p>
                        </div>
                        
                        <!-- Meta Organic content -->
                        <div id="meta-organic-content" class="hidden">
                            <!-- Métricas principales combinadas -->
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 bg-purple-500 rounded-lg">
                                            <i class="fas fa-users text-white text-sm"></i>
                                        </div>
                                        <div>
                                            <p class="text-xs font-medium text-gray-600">Total Seguidores</p>
                                            <p id="organic-total-followers" class="text-xl font-bold text-gray-900">0</p>
                                            <p id="organic-followers-breakdown" class="text-xs text-gray-500">FB + IG</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 bg-blue-500 rounded-lg">
                                            <i class="fas fa-eye text-white text-sm"></i>
                                        </div>
                                        <div>
                                            <p class="text-xs font-medium text-gray-600">Alcance Total</p>
                                            <p id="organic-total-reach" class="text-xl font-bold text-gray-900">0</p>
                                            <p id="organic-reach-period" class="text-xs text-gray-500">período actual</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 bg-green-500 rounded-lg">
                                            <i class="fas fa-heart text-white text-sm"></i>
                                        </div>
                                        <div>
                                            <p class="text-xs font-medium text-gray-600">Interacciones Total</p>
                                            <p id="organic-total-engagement" class="text-xl font-bold text-gray-900">0</p>
                                            <p id="organic-engagement-rate" class="text-xs text-gray-500">0% tasa</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4 border border-orange-100">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 bg-orange-500 rounded-lg">
                                            <i class="fas fa-image text-white text-sm"></i>
                                        </div>
                                        <div>
                                            <p class="text-xs font-medium text-gray-600">Contenido</p>
                                            <p id="organic-total-posts" class="text-xl font-bold text-gray-900">0</p>
                                            <p id="organic-content-breakdown" class="text-xs text-gray-500">posts + stories</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Desglose por plataforma -->
                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                <!-- Facebook Page -->
                                <div class="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                    <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                                        <i class="fab fa-facebook text-blue-600 mr-2"></i>
                                        Facebook Page
                                    </h4>
                                    <div class="space-y-3">
                                        <div class="flex items-center justify-between p-2 bg-white rounded border">
                                            <span class="text-sm text-gray-600">Seguidores:</span>
                                            <span id="fb-followers" class="text-sm font-medium text-gray-800">0</span>
                                        </div>
                                        <div class="flex items-center justify-between p-2 bg-white rounded border">
                                            <span class="text-sm text-gray-600">Alcance único:</span>
                                            <span id="fb-unique-reach" class="text-sm font-medium text-gray-800">0</span>
                                        </div>
                                        <div class="flex items-center justify-between p-2 bg-white rounded border">
                                            <span class="text-sm text-gray-600">Usuarios comprometidos:</span>
                                            <span id="fb-engaged-users" class="text-sm font-medium text-gray-800">0</span>
                                        </div>
                                        <div class="flex items-center justify-between p-2 bg-white rounded border">
                                            <span class="text-sm text-gray-600">Posts publicados:</span>
                                            <span id="fb-posts-count" class="text-sm font-medium text-gray-800">0</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Instagram Business -->
                                <div class="bg-pink-50 rounded-xl p-4 border border-pink-100">
                                    <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                                        <i class="fab fa-instagram text-pink-600 mr-2"></i>
                                        Instagram Business
                                    </h4>
                                    <div class="space-y-3">
                                        <div class="flex items-center justify-between p-2 bg-white rounded border">
                                            <span class="text-sm text-gray-600">Seguidores:</span>
                                            <span id="ig-followers" class="text-sm font-medium text-gray-800">0</span>
                                        </div>
                                        <div class="flex items-center justify-between p-2 bg-white rounded border">
                                            <span class="text-sm text-gray-600">Alcance:</span>
                                            <span id="ig-reach" class="text-sm font-medium text-gray-800">0</span>
                                        </div>
                                        <div class="flex items-center justify-between p-2 bg-white rounded border">
                                            <span class="text-sm text-gray-600">Visitas al perfil:</span>
                                            <span id="ig-profile-views" class="text-sm font-medium text-gray-800">0</span>
                                        </div>
                                        <div class="flex items-center justify-between p-2 bg-white rounded border">
                                            <span class="text-sm text-gray-600">Posts + Stories:</span>
                                            <span id="ig-content-count" class="text-sm font-medium text-gray-800">0</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Top Posts -->
                            <div class="bg-gray-50 rounded-xl p-4">
                                <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                                    <i class="fas fa-fire text-orange-500 mr-2"></i>
                                    Top 5 Posts por Interacciones
                                </h4>
                                <div id="organic-top-posts" class="space-y-3">
                                    <!-- Se llenará dinámicamente -->
                                </div>
                            </div>
                            
                            <!-- Instagram Stories (si hay) -->
                            <div id="ig-stories-container" class="hidden mt-6">
                                <div class="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl p-4 border border-pink-100">
                                    <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
                                        <i class="fas fa-play-circle text-pink-500 mr-2"></i>
                                        Instagram Stories Recientes
                                    </h4>
                                    <div id="ig-stories-list" class="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <!-- Se llenará dinámicamente -->
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Error state -->
                        <div id="meta-organic-error" class="hidden text-center py-8">
                            <i class="fas fa-exclamation-triangle text-3xl text-yellow-400 mb-3"></i>
                            <p class="text-sm text-gray-500">Error cargando contenido orgánico</p>
                            <p id="meta-organic-error-message" class="text-xs text-gray-400 mt-1"></p>
                        </div>
                    </div>
                </div>

                <!-- NUEVA SECCIÓN: Cupones de Descuento -->
                <div class="glass-effect rounded-xl p-8 card-hover">
                    <div class="flex items-center justify-between mb-6">
                        <div class="flex items-center space-x-3">
                            <div class="p-3 rounded-lg bg-gradient-to-r from-orange-500 to-red-600">
                                <i class="fas fa-tags text-xl text-white"></i>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold text-gray-800">Cupones y Promociones</h3>
                                <p class="text-sm text-gray-600">Descuentos tradicionales y costos reales de envío gratis</p>
                            </div>
                        </div>
                        <span class="text-xs font-medium text-orange-600 bg-orange-100 px-3 py-1 rounded-full">
                            <i class="fas fa-percent mr-1"></i>CUPONES
                        </span>
                    </div>
                    
                    <div id="coupons-section">
                        <!-- Loading state -->
                        <div id="coupons-loading" class="text-center py-8">
                            <i class="fas fa-spinner fa-spin text-2xl text-gray-400 mb-3"></i>
                            <p class="text-sm text-gray-500">Cargando cupones...</p>
                        </div>
                        
                        <!-- No coupons state -->
                        <div id="coupons-empty" class="hidden text-center py-8">
                            <i class="fas fa-tags text-3xl text-gray-300 mb-3"></i>
                            <p class="text-sm text-gray-500">No se encontraron cupones en este período</p>
                        </div>
                        
                        <!-- Coupons grid -->
                        <div id="coupons-grid" class="hidden grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            <!-- Los cupones se cargarán aquí dinámicamente -->
                        </div>
                        
                        <!-- Resumen de cupones -->
                        <div id="coupons-summary" class="hidden mt-6 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4 border border-orange-100">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm font-medium text-gray-600">Total Descontado</p>
                                    <div class="flex items-center space-x-2">
                                        <p id="total-coupons-amount" class="text-xl font-bold text-gray-900">$0 MXN</p>
                                        <div id="total-coupons-change" class=""></div>
                                    </div>
                                    <p id="total-coupons-percentage" class="text-xs text-gray-500 mt-1">0% del total de ventas</p>
                                </div>
                                <div class="text-right">
                                    <p class="text-sm font-medium text-gray-600">Órdenes con Cupón</p>
                                    <p id="total-coupons-orders" class="text-xl font-bold text-orange-600">0</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SECCIÓN: Costos Reales e Insights de Envío -->
                <div class="glass-effect rounded-xl p-8 card-hover">
                    <div class="flex items-center justify-between mb-6">
                        <div class="flex items-center space-x-3">
                            <div class="p-3 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-600">
                                <i class="fas fa-shipping-fast text-xl text-white"></i>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold text-gray-800">Costos Reales e Insights de Envío</h3>
                                <p class="text-sm text-gray-600">Datos reales desde Envia.com y análisis de carriers</p>
                            </div>
                        </div>
                        <span class="text-xs font-medium text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                            <i class="fas fa-truck mr-1"></i>ENVIA.COM
                        </span>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Costo Real Total -->
                        <div class="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-100">
                            <div class="flex items-center justify-between mb-4">
                                <div class="p-3 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-600">
                                    <i class="fas fa-dollar-sign text-xl text-white"></i>
                                </div>
                                <span class="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">REAL</span>
                            </div>
                            <div>
                                <p class="text-sm font-medium text-gray-600 mb-1">Costo Real Total</p>
                                <p id="shipping-total-real" class="text-xl font-bold text-gray-900">$0 MXN</p>
                                <div class="mt-2 space-y-1">
                                    <p id="shipping-orders-found" class="text-xs text-gray-500">0 envíos encontrados</p>
                                    <p id="shipping-avg-real" class="text-xs text-blue-600">Promedio: $0</p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Top Envío -->
                        <div class="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-100">
                            <div class="flex items-center justify-between mb-4">
                                <div class="p-3 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-600">
                                    <i class="fas fa-crown text-xl text-white"></i>
                                </div>
                                <span class="text-xs font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">TOP</span>
                            </div>
                            <div>
                                <p class="text-sm font-medium text-gray-600 mb-1">Envío Más Costoso</p>
                                <p id="shipping-top-cost" class="text-lg font-bold text-gray-900">$0</p>
                                <div class="mt-2 space-y-1">
                                    <p id="shipping-top-order" class="text-xs text-gray-500">Orden: -</p>
                                    <p id="shipping-top-carrier" class="text-xs text-yellow-600">-</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Top Órdenes de Envío Gratis Más Costosas -->
                    <div class="mt-6 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-6 border border-red-100">
                        <h4 class="text-lg font-semibold text-gray-800 mb-4">
                            <i class="fas fa-trophy text-red-600 mr-2"></i>
                            Top 5 Envíos "Gratis" Más Costosos
                        </h4>
                        <div id="top-free-shipping-orders" class="space-y-3">
                            <!-- Se cargarán dinámicamente -->
                        </div>
                    </div>
                </div>

                <!-- SECCIÓN COMBINADA: Métodos de Pago y Estados de Órdenes -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- MÉTODOS DE PAGO -->
                    <div class="glass-effect rounded-xl p-8 card-hover">
                        <div class="flex items-center justify-between mb-6">
                            <div class="flex items-center space-x-3">
                                <div class="p-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600">
                                    <i class="fas fa-credit-card text-xl text-white"></i>
                                </div>
                                <div>
                                    <h3 class="text-xl font-bold text-gray-800">Métodos de Pago</h3>
                                    <p class="text-sm text-gray-600">Desglose por tipo de pago</p>
                                </div>
                            </div>
                            <span class="text-xs font-medium text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full">
                                <i class="fas fa-chart-pie mr-1"></i>ANÁLISIS
                            </span>
                        </div>
                        
                        <div class="grid grid-cols-1 gap-4">
                            <!-- Stripe -->
                            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 rounded-lg bg-blue-500">
                                            <i class="fab fa-stripe text-sm text-white"></i>
                                        </div>
                                        <div>
                                            <div class="flex items-center justify-between">
                                                <p class="text-sm font-medium text-gray-600">Stripe (Tarjetas)</p>
                                                <div id="stripe-sales-change" class=""></div>
                                            </div>
                                            <p id="stripe-sales" class="text-lg font-bold text-gray-900">$0 MXN</p>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <span id="stripe-percentage" class="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">0%</span>
                                        <p id="stripe-orders" class="text-xs text-gray-500 mt-1">0 órdenes</p>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- PayPal -->
                            <div class="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4 border border-yellow-100">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 rounded-lg bg-yellow-500">
                                            <i class="fab fa-paypal text-sm text-white"></i>
                                        </div>
                                        <div>
                                            <div class="flex items-center justify-between">
                                                <p class="text-sm font-medium text-gray-600">PayPal</p>
                                                <div id="paypal-sales-change" class=""></div>
                                            </div>
                                            <p id="paypal-sales" class="text-lg font-bold text-gray-900">$0 MXN</p>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <span id="paypal-percentage" class="text-xs font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">0%</span>
                                        <p id="paypal-orders" class="text-xs text-gray-500 mt-1">0 órdenes</p>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Transferencia -->
                            <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 rounded-lg bg-green-500">
                                            <i class="fas fa-university text-sm text-white"></i>
                                        </div>
                                        <div>
                                            <div class="flex items-center justify-between">
                                                <p class="text-sm font-medium text-gray-600">Transferencia</p>
                                                <div id="transfer-sales-change" class=""></div>
                                            </div>
                                            <p id="transfer-sales" class="text-lg font-bold text-gray-900">$0 MXN</p>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <span id="transfer-percentage" class="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">0%</span>
                                        <p id="transfer-orders" class="text-xs text-gray-500 mt-1">0 órdenes</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- ESTADOS DE ÓRDENES -->
                    <div class="glass-effect rounded-xl p-8 card-hover">
                        <div class="flex items-center justify-between mb-6">
                            <div class="flex items-center space-x-3">
                                <div class="p-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600">
                                    <i class="fas fa-tasks text-xl text-white"></i>
                                </div>
                                <div>
                                    <h3 class="text-xl font-bold text-gray-800">Estados de Órdenes</h3>
                                    <p class="text-sm text-gray-600">Desglose por estado de procesamiento</p>
                                </div>
                            </div>
                            <span class="text-xs font-medium text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">
                                <i class="fas fa-chart-bar mr-1"></i>ESTADOS
                            </span>
                        </div>
                        
                        <div class="grid grid-cols-1 gap-4">
                            <!-- Completed -->
                            <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 rounded-lg bg-green-500">
                                            <i class="fas fa-check-circle text-sm text-white"></i>
                                        </div>
                                        <div>
                                            <div class="flex items-center space-x-2">
                                                <p class="text-sm font-medium text-gray-600">Completadas</p>
                                                <div id="completed-sales-change" class=""></div>
                                            </div>
                                            <p id="completed-sales" class="text-lg font-bold text-gray-900">$0 MXN</p>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <span id="completed-percentage" class="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">0%</span>
                                        <p id="completed-orders" class="text-xs text-gray-500 mt-1">0 órdenes</p>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Delivered -->
                            <div class="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 rounded-lg bg-blue-500">
                                            <i class="fas fa-truck text-sm text-white"></i>
                                        </div>
                                        <div>
                                            <div class="flex items-center space-x-2">
                                                <p class="text-sm font-medium text-gray-600">Entregadas</p>
                                                <div id="delivered-sales-change" class=""></div>
                                            </div>
                                            <p id="delivered-sales" class="text-lg font-bold text-gray-900">$0 MXN</p>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <span id="delivered-percentage" class="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">0%</span>
                                        <p id="delivered-orders" class="text-xs text-gray-500 mt-1">0 órdenes</p>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Processing -->
                            <div class="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-4 border border-orange-100">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="flex items-center space-x-3">
                                        <div class="p-2 rounded-lg bg-orange-500">
                                            <i class="fas fa-clock text-sm text-white"></i>
                                        </div>
                                        <div>
                                            <div class="flex items-center space-x-2">
                                                <p class="text-sm font-medium text-gray-600">En Proceso</p>
                                                <div id="processing-sales-change" class=""></div>
                                            </div>
                                            <p id="processing-sales" class="text-lg font-bold text-gray-900">$0 MXN</p>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <span id="processing-percentage" class="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">0%</span>
                                        <p id="processing-orders" class="text-xs text-gray-500 mt-1">0 órdenes</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


                <!-- NUEVO LAYOUT: 2 Columnas (Chat + Analytics) -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    <!-- COLUMNA IZQUIERDA: Chat IA -->
                    <div class="flex flex-col h-full">
                        <!-- Chat IA Card -->
                        <div class="glass-effect rounded-xl p-8 card-hover flex flex-col h-full min-h-[800px]">
                            <div class="flex items-center justify-between mb-6">
                                <div class="flex items-center space-x-3">
                                    <div class="p-3 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600">
                                        <i class="fas fa-robot text-xl text-white"></i>
                                    </div>
                                    <div>
                                        <h2 class="text-xl font-bold text-gray-800">Consulta con IA</h2>
                                        <p class="text-sm text-gray-500">Analista especializado en datos de Adaptoheal</p>
                                    </div>
                                </div>
                                <span class="text-xs font-medium text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                                    <i class="fas fa-brain mr-1"></i>GPT-4o-mini
                                </span>
                            </div>

                            <!-- Consultas sugeridas -->
                            <div class="mb-6">
                                <h4 class="text-sm font-semibold text-gray-700 mb-3">Consultas sugeridas:</h4>
                                <div class="flex flex-wrap gap-2">
                                    <button onclick="setChatMessage('Hoy')" class="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs hover:bg-green-200 transition-colors">
                                        <i class="fas fa-calendar-day mr-1"></i>Hoy
                                    </button>
                                    <button onclick="setChatMessage('Ayer')" class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs hover:bg-blue-200 transition-colors">
                                        <i class="fas fa-calendar-minus mr-1"></i>Ayer
                                    </button>
                                    <button onclick="setChatMessage('El martes')" class="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs hover:bg-purple-200 transition-colors">
                                        <i class="fas fa-calendar-week mr-1"></i>El martes
                                    </button>
                                    <button onclick="setChatMessage('Cliente VIP')" class="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs hover:bg-indigo-200 transition-colors">
                                        <i class="fas fa-crown mr-1"></i>Cliente VIP
                                    </button>
                                    <button onclick="setChatMessage('Esta semana')" class="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs hover:bg-yellow-200 transition-colors">
                                        <i class="fas fa-calendar-week mr-1"></i>Esta semana
                                    </button>
                                    <button onclick="setChatMessage('Mejor día')" class="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs hover:bg-red-200 transition-colors">
                                        <i class="fas fa-chart-line mr-1"></i>Mejor día
                                    </button>
                                </div>
                            </div>

                            <!-- Chat Messages Area -->
                            <div id="chat-messages" class="bg-gray-50 rounded-xl p-4 flex-1 overflow-y-auto mb-4 space-y-4 min-h-[500px]">
                                <div class="text-center text-gray-500 text-sm">
                                    <i class="fas fa-comments text-2xl mb-2 block"></i>
                                    <p>¡Hola! Soy tu analista de datos especializado en Adaptoheal.</p>
                                    <p class="mt-1">Pregúntame sobre ventas, productos, clientes o cualquier métrica.</p>
                                    <p class="mt-2 text-xs">Ejemplo: "¿Cuáles fueron las ventas de ayer?" o "Muéstrame el mejor cliente"</p>
                                </div>
                            </div>

                            <!-- Chat Input -->
                            <div class="flex space-x-3">
                                <input 
                                    type="text" 
                                    id="chat-input" 
                                    placeholder="Pregúntame sobre cualquier fecha... ej: ¿Cuánto vendimos hoy? ¿Qué tal ayer? ¿El martes?" 
                                    class="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
                                    onkeypress="handleChatKeyPress(event)"
                                    disabled
                                >
                                <button 
                                    id="chat-send" 
                                    onclick="sendChatMessage()" 
                                    class="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled
                                >
                                    <i class="fas fa-paper-plane"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- COLUMNA DERECHA: Top Products + Top Orders -->
                    <div class="space-y-6">
                        <!-- Top Products Card -->
                        <div class="glass-effect rounded-xl p-8 card-hover">
                            <div class="flex items-center justify-between mb-6">
                                <div class="flex items-center space-x-3">
                                    <div class="p-2 rounded-lg bg-gradient-to-r from-yellow-400 to-orange-500">
                                        <i class="fas fa-crown text-lg text-white"></i>
                                    </div>
                                    <div>
                                        <h2 class="text-xl font-bold text-gray-800">Top 5 Productos</h2>
                                        <p id="products-period-label" class="text-sm text-gray-500">Por unidades vendidas</p>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <p class="text-xs text-yellow-600 font-medium">POPULARES</p>
                                    <p class="text-xs text-gray-500">Por ventas totales</p>
                                </div>
                            </div>
                            <div id="top-products" class="space-y-3">
                                <!-- Productos se cargan dinámicamente -->
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
                                        <p id="orders-period-label" class="text-sm text-gray-500">Mayor valor</p>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <p class="text-xs text-emerald-600 font-medium">VIP</p>
                                    <p class="text-xs text-gray-500">Clientes premium</p>
                                </div>
                            </div>
                            <div id="top-orders" class="space-y-3">
                                <!-- Órdenes se cargan dinámicamente -->
                            </div>
                        </div>
                    </div>
                </div>



            </div>

            <!-- Error State -->
            <div id="error" class="hidden bg-red-50 border border-red-200 rounded-lg p-6">
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <i class="fas fa-exclamation-triangle text-red-600 mr-3"></i>
                        <div>
                            <h3 id="error-title" class="text-red-800 font-medium">Error de Conexión</h3>
                            <p id="error-message" class="text-red-600 text-sm mt-1">Cargando detalles del error...</p>
                        </div>
                    </div>
                    <button onclick="retryConnection()" class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm">
                        <i class="fas fa-refresh mr-1"></i>Reintentar
                    </button>
                </div>
            </div>
        </div>

        <script>
        // Variables globales
        let dashboardData = null;
        let activePeriod = 'last-7-days';
        let comparisonEnabled = true; // Simplificado: solo on/off
        let customDateRange = null;

        // Función para formatear números como moneda MXN
        const formatCurrency = (amount) => {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 2
          }).format(amount);
        };

        // Función para formatear números grandes
        const formatNumber = (num) => {
          return new Intl.NumberFormat('es-MX').format(num);
        };

        // Función para convertir período a días para APIs (Google Ads/Analytics)
        const getPeriodDays = (period, customDateRange = null) => {
          if (customDateRange) {
            const startDate = new Date(customDateRange.start);
            const endDate = new Date(customDateRange.end);
            const diffTime = Math.abs(endDate - startDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return Math.min(diffDays, 30); // Límite máximo 30 días para APIs
          }
          
          switch(period) {
            case 'today':
              return 1;
            case 'yesterday':
              return 1;
            case 'last-7-days':
              return 7;
            case 'last-14-days':
              return 14;
            case 'last-30-days':
              return 30;
            default:
              return 7; // Por defecto 7 días
          }
        };

        // Función para obtener etiqueta del período
        const getPeriodLabel = (period, customDateRange = null) => {
          if (customDateRange) {
            return 'período personalizado';
          }
          
          switch(period) {
            case 'today':
              return 'hoy';
            case 'yesterday':
              return 'ayer';
            case 'last-7-days':
              return 'últimos 7 días';
            case 'last-14-days':
              return 'últimos 14 días';
            case 'last-30-days':
              return 'últimos 30 días';
            default:
              return 'período actual';
          }
        };

        // Función para manejar cambio de período
        function changePeriod() {
          const selector = document.getElementById('period-selector');
          const selectedPeriod = selector.value;
          
          if (selectedPeriod === 'custom') {
            showCustomDatePanel();
          } else {
            hideCustomDatePanel();
            activePeriod = selectedPeriod;
            
            // Actualizar texto de comparación
            if (comparisonEnabled) {
              updateComparisonPeriodText();
            }
            
            loadDashboard();
          }
        }
        
        // Función para activar/desactivar comparación
        function toggleComparison() {
          const checkbox = document.getElementById('enable-comparison');
          const infoPanel = document.getElementById('comparison-period-info');
          
          comparisonEnabled = checkbox.checked;
          
          if (comparisonEnabled) {
            infoPanel.classList.remove('hidden');
            updateComparisonPeriodText();
          } else {
            infoPanel.classList.add('hidden');
          }
          
          console.log('Comparación:', comparisonEnabled ? 'activada' : 'desactivada');
          
          // Recargar dashboard
          loadDashboard();
        }
        
        // Función para actualizar el texto del período de comparación
        function updateComparisonPeriodText() {
          const textElement = document.getElementById('comparison-period-text');
          if (!textElement) return;
          
          let comparisonText = '';
          
          // Determinar qué período se está comparando basado en el período principal
          switch (activePeriod) {
            case 'today':
              comparisonText = 'vs Ayer';
              break;
            case 'yesterday':
              comparisonText = 'vs Anteayer';
              break;
            case 'last-7-days':
              comparisonText = 'vs 7 días anteriores';
              break;
            case 'last-14-days':
              comparisonText = 'vs 14 días anteriores';
              break;
            case 'last-30-days':
              comparisonText = 'vs 30 días anteriores';
              break;
            case 'this-month':
              comparisonText = 'vs Mes anterior';
              break;
            case 'last-month':
              comparisonText = 'vs 2 meses atrás';
              break;


            case 'custom':
              comparisonText = 'vs Período anterior equivalente';
              break;
            default:
              comparisonText = 'vs Período anterior equivalente';
          }
          
          textElement.textContent = comparisonText;
        }

        // Mostrar panel de fechas personalizadas
        function showCustomDatePanel() {
          const panel = document.getElementById('custom-date-panel');
          panel.classList.remove('hidden');
          
          // Establecer fechas por defecto (agosto 2025)
          document.getElementById('start-date').value = '2025-08-01';
          document.getElementById('end-date').value = '2025-09-30';
        }

        // Ocultar panel de fechas personalizadas
        function hideCustomDatePanel() {
          const panel = document.getElementById('custom-date-panel');
          panel.classList.add('hidden');
          customDateRange = null;
        }

        // Aplicar fechas personalizadas
        function applyCustomDates() {
          const startDate = document.getElementById('start-date').value;
          const endDate = document.getElementById('end-date').value;
          
          if (!startDate || !endDate) {
            alert('Por favor selecciona ambas fechas');
            return;
          }
          
          if (new Date(startDate) > new Date(endDate)) {
            alert('La fecha de inicio debe ser anterior a la fecha final');
            return;
          }
          
          customDateRange = { start: startDate, end: endDate };
          activePeriod = 'custom';
          hideCustomDatePanel();
          
          // Actualizar texto de comparación
          if (comparisonEnabled) {
            updateComparisonPeriodText();
          }
          
          loadDashboard();
        }

        // Cancelar fechas personalizadas
        function cancelCustomDates() {
          hideCustomDatePanel();
          
          // Resetear selector a valor anterior
          const selector = document.getElementById('period-selector');
          selector.value = activePeriod;
        }

        // Función para actualizar filtros de estado de órdenes
        function updateOrderStatusFilter() {
          // Recargar dashboard con nuevos filtros
          loadDashboard();
        }

        // Presets de filtros
        function applyWooCommercePreset() {
          // Activar solo completed, processing y delivered
          document.getElementById('status-completed').checked = true;
          document.getElementById('status-delivered').checked = true;
          document.getElementById('status-processing').checked = true;
          document.getElementById('status-on-hold').checked = false;
          document.getElementById('status-pending').checked = false;
          updateOrderStatusFilter();
        }

        function applyConservativePreset() {
          // Solo completed
          document.getElementById('status-completed').checked = true;
          document.getElementById('status-delivered').checked = false;
          document.getElementById('status-processing').checked = false;
          document.getElementById('status-on-hold').checked = false;
          document.getElementById('status-pending').checked = false;
          updateOrderStatusFilter();
        }

        function applyAllStatusPreset() {
          // Todos los estados
          document.getElementById('status-completed').checked = true;
          document.getElementById('status-delivered').checked = true;
          document.getElementById('status-processing').checked = true;
          document.getElementById('status-on-hold').checked = true;
          document.getElementById('status-pending').checked = true;
          updateOrderStatusFilter();
        }

        // Obtener estados activos
        function getActiveStatuses() {
          const statuses = [];
          if (document.getElementById('status-completed').checked) statuses.push('completed');
          if (document.getElementById('status-delivered').checked) statuses.push('delivered');
          if (document.getElementById('status-processing').checked) statuses.push('processing');
          if (document.getElementById('status-on-hold').checked) statuses.push('on-hold');
          if (document.getElementById('status-pending').checked) statuses.push('pending');
          return statuses;
        }

        // Función para verificar si token está expirado
        function isTokenExpired(token) {
          if (!token) return true;
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const currentTime = Math.floor(Date.now() / 1000);
            return payload.exp < currentTime;
          } catch (error) {
            return true;
          }
        }

        // Función para verificar autenticación antes de cargar dashboard
        function checkAuthBeforeLoad() {
          const token = localStorage.getItem('auth_token');
          
          // Si no hay token, redirigir inmediatamente
          if (!token) {
            console.log('No hay token, redirigiendo a login');
            localStorage.clear();
            window.location.href = '/login';
            return false;
          }
          
          // Verificar si el token está expirado
          if (isTokenExpired(token)) {
            console.log('Token expirado, redirigiendo a login');
            localStorage.clear();
            window.location.href = '/login';
            return false;
          }
          
          // Verificar formato válido del token (debe tener 3 partes separadas por puntos)
          const tokenParts = token.split('.');
          if (tokenParts.length !== 3) {
            console.log('Token con formato inválido, redirigiendo a login');
            localStorage.clear();
            window.location.href = '/login';
            return false;
          }
          
          return true;
        }

        // Cargar dashboard
        async function loadDashboard() {
          // Verificar autenticación antes de proceder
          if (!checkAuthBeforeLoad()) {
            return;
          }
          
          try {
            document.getElementById('loading').classList.remove('hidden');
            document.getElementById('dashboard').classList.add('hidden');
            document.getElementById('error').classList.add('hidden');

            // Construir parámetros de query
            let queryParams = new URLSearchParams();
            
            // Período
            if (customDateRange) {
              queryParams.set('start_date', customDateRange.start);
              queryParams.set('end_date', customDateRange.end);
            } else {
              queryParams.set('period', activePeriod);
            }
            
            // Filtros de estado
            const activeStatuses = getActiveStatuses();
            queryParams.set('status_filters', activeStatuses.join(','));
            
            // Período de comparación (simplificado)
            if (comparisonEnabled) {
              queryParams.set('enableComparison', 'true');
              queryParams.set('comparison_period', 'auto'); // Siempre automático
            }

            console.log('Haciendo request a dashboard con params:', queryParams.toString());
            
            // Usar axios que ya tiene configurado el Authorization header
            const response = await axios.get(\`/api/dashboard?\${queryParams.toString()}\`);
            const result = response.data;

            console.log('Respuesta del API:', result);
            console.log('Success value:', result.success, typeof result.success);

            if (!result || result.success !== true) {
              console.error('API response failed:', result);
              throw new Error(result?.error || result?.message || 'Error de API - respuesta inválida');
            }

            dashboardData = result.data;
            updateDashboardUI();
            updatePeriodDisplay(result.debug?.periodInfo);
            updateStatusCounters(result.debug?.statusBreakdownAll || {});
            updateComparisonInfo(result.data?.comparative?.periodInfo);
            
            // Habilitar chat después de cargar datos
            enableChat();
            
            // Recargar Google Analytics y Google Ads con nuevo período
            console.log('Recargando Google Analytics con nuevo período...');
            await loadAnalytics();
            
            console.log('Recargando Google Ads con nuevo período...');
            await loadGoogleAds();
            
            console.log('Recargando Meta Ads con nuevo período...');
            await loadMetaAds();
            
            console.log('Recargando Meta Organic con nuevo período...');
            await loadMetaOrganic();

          } catch (error) {
            console.error('Error loading dashboard:', error);
            console.error('Error stack:', error.stack);
            console.error('Error response:', error.response);
            
            // Determinar tipo de error y mostrar mensaje apropiado
            let errorTitle = 'Error Inesperado';
            let errorMessage = 'Ocurrió un error inesperado: ' + error.message;
            
            // Verificar si es error de autenticación (token expirado/inválido)
            const isTokenError = (
              (error.response && error.response.status === 401) ||
              (error.message && error.message.includes('Token')) ||
              (error.response && error.response.data && error.response.data.error && 
               (error.response.data.error.includes('Token') || 
                error.response.data.error.includes('token') ||
                error.response.data.error.includes('inválido') ||
                error.response.data.error.includes('expirado')))
            );
            
            if (isTokenError) {
              errorTitle = 'Sesión Expirada';
              errorMessage = 'Tu sesión ha expirado. Redirigiendo al login...';
              // Limpiar completamente el localStorage
              localStorage.removeItem('auth_token');
              localStorage.removeItem('user_info');
              localStorage.clear(); // Limpieza adicional por seguridad
              console.log('Token inválido detectado - Limpiando localStorage y redirigiendo');
              setTimeout(() => {
                window.location.href = '/login';
              }, 2000);
            } else if (error.response && error.response.status >= 500) {
              errorTitle = 'Error del Servidor';
              errorMessage = 'Error interno del servidor. Por favor, intenta más tarde.';
            } else if (error.message.includes('Network Error')) {
              errorTitle = 'Error de Conectividad';
              errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
            } else if (error.response && error.response.data && error.response.data.error) {
              // Si el error menciona token o autenticación
              if (error.response.data.error.includes('Token') || error.response.data.error.includes('token')) {
                errorTitle = 'Problema de Autenticación';
                errorMessage = 'Error de autenticación. Redirigiendo al login...';
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_info');
                setTimeout(() => {
                  window.location.href = '/login';
                }, 2000);
              } else {
                errorTitle = 'Error de API';
                errorMessage = error.response.data.error;
              }
            }
            
            // Mostrar error con detalles específicos
            document.getElementById('error-title').textContent = errorTitle;
            document.getElementById('error-message').textContent = errorMessage;
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('error').classList.remove('hidden');
            document.getElementById('dashboard').classList.add('hidden');
          }
        }

        // Función auxiliar para formatear cambios porcentuales
        function formatPercentageChange(change, showIcon = true) {
          if (change === null || change === undefined || isNaN(change)) {
            return showIcon ? '<span class="text-gray-400 text-xs"><i class="fas fa-minus"></i></span>' : '--';
          }
          
          const isPositive = change >= 0;
          const bgClass = isPositive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200';
          const iconClass = isPositive ? 'fas fa-arrow-up' : 'fas fa-arrow-down';
          const prefix = isPositive ? '+' : '';
          
          if (showIcon) {
            return \`<span class="\${bgClass} text-xs font-semibold px-2 py-1 rounded-full border inline-flex items-center space-x-1"><i class="\${iconClass} text-xs"></i><span>\${prefix}\${Math.abs(change).toFixed(1)}%</span></span>\`;
          } else {
            return \`<span class="\${bgClass} px-2 py-1 rounded text-xs font-medium">\${prefix}\${change.toFixed(1)}%</span>\`;
          }
        }

        // Función para cargar datos de Google Analytics 4
        async function loadAnalytics() {
          try {
            console.log('🔍 Cargando datos de Google Analytics 4...');
            
            // Verificar que los elementos existan
            const loadingElement = document.getElementById('analytics-loading');
            const contentElement = document.getElementById('analytics-content');
            const errorElement = document.getElementById('analytics-error');
            
            if (!loadingElement || !contentElement || !errorElement) {
              console.error('❌ Elementos GA4 no encontrados en el DOM');
              console.error('Loading element:', loadingElement);
              console.error('Content element:', contentElement);
              console.error('Error element:', errorElement);
              return;
            }
            
            // Mostrar loading state
            loadingElement.classList.remove('hidden');
            contentElement.classList.add('hidden');
            errorElement.classList.add('hidden');
            
            // Hacer request a GA4 API con período dinámico
            const days = getPeriodDays(activePeriod, customDateRange);
            console.log('📊 Google Analytics: Usando ' + days + ' días para período ' + activePeriod);
            const response = await axios.get('/api/analytics?days=' + days);
            const result = response.data;
            
            if (!result.success) {
              throw new Error(result.error || 'Error cargando datos GA4');
            }
            
            const ga4Data = result.data;
            console.log('📊 Datos GA4 recibidos:', ga4Data);
            
            // Actualizar label de período
            const periodLabel = getPeriodLabel(activePeriod, customDateRange);
            document.getElementById('ga4-period-label').textContent = periodLabel;
            
            // Actualizar usuarios
            document.getElementById('ga4-total-users').textContent = ga4Data.users.totalUsers.toLocaleString();
            document.getElementById('ga4-new-users').textContent = ga4Data.users.newUsers.toLocaleString();
            document.getElementById('ga4-returning-users').textContent = ga4Data.users.returningUsers.toLocaleString();
            
            // Calcular porcentajes
            const totalUsers = ga4Data.users.totalUsers;
            const newPercentage = totalUsers > 0 ? ((ga4Data.users.newUsers / totalUsers) * 100).toFixed(1) : 0;
            const returningPercentage = totalUsers > 0 ? ((ga4Data.users.returningUsers / totalUsers) * 100).toFixed(1) : 0;
            
            document.getElementById('ga4-new-users-percentage').textContent = \`\${newPercentage}% del total\`;
            document.getElementById('ga4-returning-percentage').textContent = \`\${returningPercentage}% del total\`;
            
            // Mostrar páginas más visitadas
            const topPagesContainer = document.getElementById('ga4-top-pages');
            topPagesContainer.innerHTML = '';
            
            ga4Data.pages.slice(0, 5).forEach((page, index) => {
              const pageElement = document.createElement('div');
              pageElement.className = 'flex items-center justify-between p-2 bg-white rounded border';
              pageElement.innerHTML = \`
                <div class="flex items-center space-x-2">
                  <span class="w-6 h-6 bg-orange-100 text-orange-600 text-xs font-bold rounded-full flex items-center justify-center">\${index + 1}</span>
                  <div>
                    <p class="text-sm font-medium text-gray-800 truncate" style="max-width: 200px;" title="\${page.title}">\${page.title}</p>
                    <p class="text-xs text-gray-500 truncate" style="max-width: 200px;" title="\${page.path}">\${page.path}</p>
                  </div>
                </div>
                <span class="text-sm font-semibold text-gray-600">\${page.pageViews.toLocaleString()}</span>
              \`;
              topPagesContainer.appendChild(pageElement);
            });
            
            // Mostrar países
            const countriesContainer = document.getElementById('ga4-countries');
            countriesContainer.innerHTML = '';
            
            ga4Data.demographics.countries.slice(0, 5).forEach((country, index) => {
              const countryElement = document.createElement('div');
              countryElement.className = 'flex items-center justify-between p-2 bg-white rounded border';
              countryElement.innerHTML = \`
                <div class="flex items-center space-x-2">
                  <span class="w-6 h-6 bg-blue-100 text-blue-600 text-xs font-bold rounded-full flex items-center justify-center">\${index + 1}</span>
                  <span class="text-sm font-medium text-gray-800">\${country.name}</span>
                </div>
                <span class="text-sm font-semibold text-gray-600">\${country.users.toLocaleString()}</span>
              \`;
              countriesContainer.appendChild(countryElement);
            });
            
            // Mostrar fuentes de tráfico
            const trafficContainer = document.getElementById('ga4-traffic-sources');
            trafficContainer.innerHTML = '';
            
            ga4Data.traffic.slice(0, 4).forEach(source => {
              const sourceElement = document.createElement('div');
              sourceElement.className = 'bg-white rounded-lg p-3 border text-center';
              sourceElement.innerHTML = \`
                <p class="text-xs font-medium text-gray-600 uppercase">\${source.channel}</p>
                <p class="text-lg font-bold text-gray-900">\${source.sessions.toLocaleString()}</p>
                <p class="text-xs text-gray-500">\${source.users.toLocaleString()} usuarios</p>
              \`;
              trafficContainer.appendChild(sourceElement);
            });
            
            // Mostrar contenido y ocultar loading
            document.getElementById('analytics-loading').classList.add('hidden');
            document.getElementById('analytics-content').classList.remove('hidden');
            
            console.log('✅ Datos GA4 cargados correctamente');
            
          } catch (error) {
            console.error('❌ Error cargando Google Analytics:', error.message);
            
            // Mostrar error state
            document.getElementById('analytics-loading').classList.add('hidden');
            document.getElementById('analytics-content').classList.add('hidden');
            document.getElementById('analytics-error').classList.remove('hidden');
            document.getElementById('analytics-error-message').textContent = error.message;
          }
        }

        // Función para cargar datos de Google Ads
        async function loadGoogleAds() {
          try {
            console.log('🔍 Cargando datos de Google Ads...');
            
            // Verificar que los elementos existan
            const loadingElement = document.getElementById('google-ads-loading');
            const contentElement = document.getElementById('google-ads-content');
            const errorElement = document.getElementById('google-ads-error');
            
            if (!loadingElement || !contentElement || !errorElement) {
              console.error('❌ Elementos Google Ads no encontrados en el DOM');
              return;
            }
            
            // Mostrar loading state
            loadingElement.classList.remove('hidden');
            contentElement.classList.add('hidden');
            errorElement.classList.add('hidden');
            
            // Hacer request a Google Ads API con período dinámico
            const days = getPeriodDays(activePeriod, customDateRange);
            console.log('📊 Google Ads: Usando ' + days + ' días para período ' + activePeriod);
            const response = await axios.get('/api/google-ads?days=' + days);
            const result = response.data;
            
            if (!result.success) {
              throw new Error(result.error || 'Error cargando datos Google Ads');
            }
            
            const googleAdsData = result.data;
            console.log('📊 Datos Google Ads recibidos:', googleAdsData);
            
            // Actualizar label de período
            const periodLabel = getPeriodLabel(activePeriod, customDateRange);
            document.getElementById('google-ads-period-label').textContent = periodLabel;
            
            // Actualizar métricas principales
            document.getElementById('google-ads-impressions').textContent = googleAdsData.metrics.impressions?.toLocaleString() || '0';
            document.getElementById('google-ads-clicks').textContent = googleAdsData.metrics.clicks?.toLocaleString() || '0';
            document.getElementById('google-ads-cost').textContent = formatCurrency(googleAdsData.metrics.cost || 0);
            document.getElementById('google-ads-conversions').textContent = googleAdsData.metrics.conversions?.toLocaleString() || '0';
            
            // Calcular y mostrar métricas calculadas
            const ctr = googleAdsData.metrics.impressions > 0 ? ((googleAdsData.metrics.clicks / googleAdsData.metrics.impressions) * 100).toFixed(2) : 0;
            const cpc = googleAdsData.metrics.clicks > 0 ? (googleAdsData.metrics.cost / googleAdsData.metrics.clicks).toFixed(2) : 0;
            const conversionRate = googleAdsData.metrics.clicks > 0 ? ((googleAdsData.metrics.conversions / googleAdsData.metrics.clicks) * 100).toFixed(2) : 0;
            
            document.getElementById('google-ads-ctr').textContent = 'CTR: ' + ctr + '%';
            document.getElementById('google-ads-cpc').textContent = 'CPC: $' + cpc;
            document.getElementById('google-ads-conversion-rate').textContent = 'Tasa: ' + conversionRate + '%';
            
            // Mostrar campañas
            const campaignsContainer = document.getElementById('google-ads-campaigns');
            campaignsContainer.innerHTML = '';
            
            if (googleAdsData.campaigns && googleAdsData.campaigns.length > 0) {
              googleAdsData.campaigns.slice(0, 5).forEach((campaign, index) => {
                const campaignElement = document.createElement('div');
                campaignElement.className = 'flex items-center justify-between p-2 bg-white rounded border';
                campaignElement.innerHTML = 
                  '<div class="flex items-center space-x-2">' +
                    '<span class="w-6 h-6 bg-red-100 text-red-600 text-xs font-bold rounded-full flex items-center justify-center">' + (index + 1) + '</span>' +
                    '<div>' +
                      '<p class="text-sm font-medium text-gray-800 truncate" style="max-width: 200px;" title="' + campaign.name + '">' + campaign.name + '</p>' +
                      '<p class="text-xs text-gray-500">Estado: ' + campaign.status + '</p>' +
                    '</div>' +
                  '</div>' +
                  '<div class="text-right">' +
                    '<span class="text-sm font-semibold text-gray-600">' + (campaign.impressions?.toLocaleString() || '0') + '</span>' +
                    '<p class="text-xs text-gray-400">impresiones</p>' +
                  '</div>';
                campaignsContainer.appendChild(campaignElement);
              });
            } else {
              campaignsContainer.innerHTML = '<p class="text-gray-500 text-sm">No hay campañas activas</p>';
            }
            
            // Mostrar información de cuenta
            const accountInfoContainer = document.getElementById('google-ads-account-info');
            accountInfoContainer.innerHTML = '';
            
            if (googleAdsData.account) {
              const accountElement = document.createElement('div');
              accountElement.className = 'space-y-2';
              accountElement.innerHTML = 
                '<div class="flex items-center justify-between p-2 bg-white rounded border">' +
                  '<span class="text-sm text-gray-600">ID de Cliente:</span>' +
                  '<span class="text-sm font-medium text-gray-800">' + (googleAdsData.account.customerId || 'N/A') + '</span>' +
                '</div>' +
                '<div class="flex items-center justify-between p-2 bg-white rounded border">' +
                  '<span class="text-sm text-gray-600">Nombre:</span>' +
                  '<span class="text-sm font-medium text-gray-800">' + (googleAdsData.account.descriptiveName || 'N/A') + '</span>' +
                '</div>' +
                '<div class="flex items-center justify-between p-2 bg-white rounded border">' +
                  '<span class="text-sm text-gray-600">Zona Horaria:</span>' +
                  '<span class="text-sm font-medium text-gray-800">' + (googleAdsData.account.timeZone || 'N/A') + '</span>' +
                '</div>' +
                '<div class="flex items-center justify-between p-2 bg-white rounded border">' +
                  '<span class="text-sm text-gray-600">Moneda:</span>' +
                  '<span class="text-sm font-medium text-gray-800">' + (googleAdsData.account.currencyCode || 'N/A') + '</span>' +
                '</div>';
              accountInfoContainer.appendChild(accountElement);
            } else {
              accountInfoContainer.innerHTML = '<p class="text-gray-500 text-sm">Información de cuenta no disponible</p>';
            }
            
            // Mostrar contenido y ocultar loading
            document.getElementById('google-ads-loading').classList.add('hidden');
            document.getElementById('google-ads-content').classList.remove('hidden');
            
            console.log('✅ Datos Google Ads cargados correctamente');
            
          } catch (error) {
            console.error('❌ Error cargando Google Ads:', error.message);
            
            // Mostrar error state
            document.getElementById('google-ads-loading').classList.add('hidden');
            document.getElementById('google-ads-content').classList.add('hidden');
            document.getElementById('google-ads-error').classList.remove('hidden');
            document.getElementById('google-ads-error-message').textContent = error.message;
          }
        }

        // Función para cargar datos de Meta Ads
        async function loadMetaAds() {
          try {
            console.log('🔍 Cargando datos de Meta Ads...');
            
            // Verificar que los elementos existan
            const loadingElement = document.getElementById('meta-ads-loading');
            const contentElement = document.getElementById('meta-ads-content');
            const errorElement = document.getElementById('meta-ads-error');
            
            if (!loadingElement || !contentElement || !errorElement) {
              console.error('❌ Elementos Meta Ads no encontrados en el DOM');
              return;
            }
            
            // Mostrar loading state
            loadingElement.classList.remove('hidden');
            contentElement.classList.add('hidden');
            errorElement.classList.add('hidden');
            
            // Hacer request a Meta Ads API con período dinámico
            const days = getPeriodDays(activePeriod, customDateRange);
            console.log('📊 Meta Ads: Usando ' + days + ' días para período ' + activePeriod);
            const response = await axios.get('/api/meta-ads?days=' + days);
            const result = response.data;
            
            if (!result.success) {
              throw new Error(result.error || 'Error cargando datos Meta Ads');
            }
            
            const metaAdsData = result.data;
            console.log('📊 Datos Meta Ads recibidos:', metaAdsData);
            
            // Actualizar label de período
            const periodLabel = getPeriodLabel(activePeriod, customDateRange);
            document.getElementById('meta-spend-period').textContent = periodLabel;
            document.getElementById('meta-impressions-period').textContent = periodLabel;
            document.getElementById('meta-clicks-period').textContent = periodLabel;
            document.getElementById('meta-conversions-period').textContent = periodLabel;
            
            // Actualizar métricas principales
            document.getElementById('meta-total-spend').textContent = formatCurrency(metaAdsData.insights.totalSpend || 0);
            document.getElementById('meta-total-impressions').textContent = (metaAdsData.insights.totalImpressions || 0).toLocaleString();
            document.getElementById('meta-total-clicks').textContent = (metaAdsData.insights.totalClicks || 0).toLocaleString();
            document.getElementById('meta-total-conversions').textContent = (metaAdsData.insights.conversions || 0).toLocaleString();
            
            // Actualizar métricas de rendimiento
            document.getElementById('meta-ctr').textContent = (metaAdsData.insights.ctr || 0).toFixed(2) + '%';
            document.getElementById('meta-cpm').textContent = formatCurrency(metaAdsData.insights.cpm || 0);
            document.getElementById('meta-cpc').textContent = formatCurrency(metaAdsData.insights.cpc || 0);
            
            // Mostrar campañas activas
            const campaignsContainer = document.getElementById('meta-campaigns-list');
            campaignsContainer.innerHTML = '';
            
            if (metaAdsData.campaigns && metaAdsData.campaigns.length > 0) {
              metaAdsData.campaigns.slice(0, 5).forEach((campaign, index) => {
                const campaignElement = document.createElement('div');
                campaignElement.className = 'flex items-center justify-between p-2 bg-white rounded border';
                campaignElement.innerHTML = 
                  '<div class="flex items-center space-x-2">' +
                    '<span class="w-6 h-6 bg-blue-100 text-blue-600 text-xs font-bold rounded-full flex items-center justify-center">' + (index + 1) + '</span>' +
                    '<div>' +
                      '<p class="text-sm font-medium text-gray-800 truncate" style="max-width: 200px;" title="' + (campaign.name || 'N/A') + '">' + (campaign.name || 'N/A') + '</p>' +
                      '<p class="text-xs text-gray-500">Estado: ' + (campaign.status || 'N/A') + '</p>' +
                      '<p class="text-xs text-gray-500">Objetivo: ' + (campaign.objective || 'N/A') + '</p>' +
                    '</div>' +
                  '</div>' +
                  '<div class="text-right">' +
                    '<span class="text-sm font-semibold text-gray-600">' + formatCurrency(campaign.dailyBudget || 0) + '</span>' +
                    '<p class="text-xs text-gray-400">presupuesto diario</p>' +
                  '</div>';
                campaignsContainer.appendChild(campaignElement);
              });
            } else {
              campaignsContainer.innerHTML = '<p class="text-gray-500 text-sm">No hay campañas activas</p>';
            }
            
            // Mostrar información de cuenta
            const accountInfoContainer = document.getElementById('meta-account-info');
            accountInfoContainer.innerHTML = '';
            
            if (metaAdsData.account && !metaAdsData.account.error) {
              const accountElement = document.createElement('div');
              accountElement.className = 'space-y-2';
              accountElement.innerHTML = 
                '<div class="flex items-center justify-between p-2 bg-white rounded border">' +
                  '<span class="text-sm text-gray-600">ID de Cuenta:</span>' +
                  '<span class="text-sm font-medium text-gray-800">' + (metaAdsData.account.id || 'N/A') + '</span>' +
                '</div>' +
                '<div class="flex items-center justify-between p-2 bg-white rounded border">' +
                  '<span class="text-sm text-gray-600">Nombre:</span>' +
                  '<span class="text-sm font-medium text-gray-800">' + (metaAdsData.account.name || 'N/A') + '</span>' +
                '</div>' +
                '<div class="flex items-center justify-between p-2 bg-white rounded border">' +
                  '<span class="text-sm text-gray-600">Moneda:</span>' +
                  '<span class="text-sm font-medium text-gray-800">' + (metaAdsData.account.currency || 'N/A') + '</span>' +
                '</div>' +
                '<div class="flex items-center justify-between p-2 bg-white rounded border">' +
                  '<span class="text-sm text-gray-600">Zona Horaria:</span>' +
                  '<span class="text-sm font-medium text-gray-800">' + (metaAdsData.account.timezone || 'N/A') + '</span>' +
                '</div>';
              accountInfoContainer.appendChild(accountElement);
            } else {
              accountInfoContainer.innerHTML = '<p class="text-gray-500 text-sm">Información de cuenta no disponible</p>';
            }
            
            // Mostrar contenido y ocultar loading
            loadingElement.classList.add('hidden');
            contentElement.classList.remove('hidden');
            
            console.log('✅ Datos Meta Ads cargados correctamente');
            
          } catch (error) {
            console.error('❌ Error cargando Meta Ads:', error.message);
            
            // Mostrar error state
            document.getElementById('meta-ads-loading').classList.add('hidden');
            document.getElementById('meta-ads-content').classList.add('hidden');
            document.getElementById('meta-ads-error').classList.remove('hidden');
            document.getElementById('meta-ads-error-message').textContent = error.message;
          }
        }

        // Función para cargar contenido orgánico de Meta (Facebook + Instagram)
        async function loadMetaOrganic() {
          try {
            console.log('🔍 Cargando contenido orgánico de Meta...');
            
            // Verificar que los elementos existan
            const loadingElement = document.getElementById('meta-organic-loading');
            const contentElement = document.getElementById('meta-organic-content');
            const errorElement = document.getElementById('meta-organic-error');
            
            if (!loadingElement || !contentElement || !errorElement) {
              console.error('❌ Elementos Meta Organic no encontrados en el DOM');
              return;
            }
            
            // Mostrar loading state
            loadingElement.classList.remove('hidden');
            contentElement.classList.add('hidden');
            errorElement.classList.add('hidden');
            
            // Hacer request a Meta Organic API con período dinámico
            const days = getPeriodDays(activePeriod, customDateRange);
            console.log('📊 Meta Organic: Usando ' + days + ' días para período ' + activePeriod);
            const response = await axios.get('/api/meta-organic?days=' + days);
            const result = response.data;
            
            if (!result.success) {
              throw new Error(result.error || 'Error cargando contenido orgánico');
            }
            
            const organicData = result.data;
            console.log('📊 Datos Meta Organic recibidos:', organicData);
            
            // Actualizar métricas principales combinadas
            const summary = organicData.summary || {};
            document.getElementById('organic-total-followers').textContent = (summary.totalFollowers || 0).toLocaleString();
            document.getElementById('organic-total-reach').textContent = (summary.totalReach || 0).toLocaleString();
            document.getElementById('organic-total-engagement').textContent = (summary.totalEngagement || 0).toLocaleString();
            document.getElementById('organic-total-posts').textContent = (summary.facebookPosts + summary.instagramPosts + summary.instagramStories || 0).toLocaleString();
            
            // Desglose de seguidores
            const fbFollowers = organicData.facebook?.pageInfo?.followersCount || 0;
            const igFollowers = organicData.instagram?.accountInfo?.followersCount || 0;
            document.getElementById('organic-followers-breakdown').textContent = 'FB: ' + fbFollowers.toLocaleString() + ' | IG: ' + igFollowers.toLocaleString();
            
            // Engagement rate
            document.getElementById('organic-engagement-rate').textContent = (summary.engagementRate || 0) + '% tasa';
            
            // Content breakdown
            document.getElementById('organic-content-breakdown').textContent = 
              (summary.facebookPosts || 0) + ' FB | ' + (summary.instagramPosts || 0) + ' IG | ' + (summary.instagramStories || 0) + ' Stories';
            
            // Actualizar período
            const periodLabel = getPeriodLabel(activePeriod, customDateRange);
            document.getElementById('organic-reach-period').textContent = periodLabel;
            
            // Facebook metrics
            document.getElementById('fb-followers').textContent = fbFollowers.toLocaleString();
            document.getElementById('fb-unique-reach').textContent = (organicData.facebook?.insights?.uniqueImpressions || 0).toLocaleString();
            document.getElementById('fb-engaged-users').textContent = (organicData.facebook?.insights?.engagedUsers || 0).toLocaleString();
            document.getElementById('fb-posts-count').textContent = (summary.facebookPosts || 0).toLocaleString();
            
            // Instagram metrics
            document.getElementById('ig-followers').textContent = igFollowers.toLocaleString();
            document.getElementById('ig-reach').textContent = (organicData.instagram?.insights?.reach || 0).toLocaleString();
            document.getElementById('ig-profile-views').textContent = (organicData.instagram?.insights?.profileViews || 0).toLocaleString();
            document.getElementById('ig-content-count').textContent = (summary.instagramPosts || 0) + ' + ' + (summary.instagramStories || 0);
            
            // Top Posts
            const topPostsContainer = document.getElementById('organic-top-posts');
            topPostsContainer.innerHTML = '';
            
            if (organicData.topPosts && organicData.topPosts.length > 0) {
              organicData.topPosts.forEach((post, index) => {
                const postElement = document.createElement('div');
                postElement.className = 'flex items-center justify-between p-3 bg-white rounded border hover:shadow-sm transition-shadow';
                
                const platform = post.platform === 'facebook' ? 'Facebook' : 'Instagram';
                const platformIcon = post.platform === 'facebook' ? 'fab fa-facebook text-blue-600' : 'fab fa-instagram text-pink-600';
                const postText = post.message || post.caption || 'Sin texto';
                const truncatedText = postText.length > 80 ? postText.substring(0, 80) + '...' : postText;
                
                postElement.innerHTML = 
                  '<div class="flex items-center space-x-3 flex-1">' +
                    '<span class="w-8 h-8 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-600 text-sm font-bold rounded-full flex items-center justify-center">' + (index + 1) + '</span>' +
                    '<div class="flex-1">' +
                      '<div class="flex items-center space-x-2 mb-1">' +
                        '<i class="' + platformIcon + ' text-sm"></i>' +
                        '<span class="text-xs font-medium text-gray-500">' + platform + '</span>' +
                      '</div>' +
                      '<p class="text-sm text-gray-800 leading-tight">' + truncatedText + '</p>' +
                    '</div>' +
                  '</div>' +
                  '<div class="text-right">' +
                    '<span class="text-lg font-bold text-purple-600">' + (post.totalInteractions || post.totalEngagement || 0) + '</span>' +
                    '<p class="text-xs text-gray-400">interacciones</p>' +
                  '</div>';
                
                topPostsContainer.appendChild(postElement);
              });
            } else {
              topPostsContainer.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No hay posts disponibles para este período</p>';
            }
            
            // Instagram Stories
            const storiesContainer = document.getElementById('ig-stories-container');
            const storiesList = document.getElementById('ig-stories-list');
            
            if (organicData.instagram?.stories && organicData.instagram.stories.length > 0) {
              storiesContainer.classList.remove('hidden');
              storiesList.innerHTML = '';
              
              organicData.instagram.stories.slice(0, 8).forEach((story, index) => {
                const storyElement = document.createElement('div');
                storyElement.className = 'bg-white rounded-lg p-3 border border-pink-200 hover:shadow-sm transition-shadow';
                
                const impressions = story.insights?.impressions || 0;
                const reach = story.insights?.reach || 0;
                
                storyElement.innerHTML = 
                  '<div class="text-center">' +
                    '<div class="w-12 h-12 bg-gradient-to-r from-pink-400 to-purple-500 rounded-full mx-auto mb-2 flex items-center justify-center">' +
                      '<i class="fas fa-play text-white text-lg"></i>' +
                    '</div>' +
                    '<p class="text-xs font-medium text-gray-800 mb-1">Story ' + (index + 1) + '</p>' +
                    '<p class="text-xs text-gray-500">' + impressions.toLocaleString() + ' views</p>' +
                    '<p class="text-xs text-gray-400">' + reach.toLocaleString() + ' reach</p>' +
                  '</div>';
                
                storiesList.appendChild(storyElement);
              });
            } else {
              storiesContainer.classList.add('hidden');
            }
            
            // Mostrar contenido y ocultar loading
            loadingElement.classList.add('hidden');
            contentElement.classList.remove('hidden');
            
            console.log('✅ Contenido orgánico Meta cargado correctamente');
            
          } catch (error) {
            console.error('❌ Error cargando contenido orgánico Meta:', error.message);
            
            // Mostrar error state
            document.getElementById('meta-organic-loading').classList.add('hidden');
            document.getElementById('meta-organic-content').classList.add('hidden');
            document.getElementById('meta-organic-error').classList.remove('hidden');
            document.getElementById('meta-organic-error-message').textContent = error.message;
          }
        }

        // Función para actualizar información de comparación
        function updateComparisonInfo(periodInfo) {
          const comparisonInfoDiv = document.getElementById('comparison-period-info');
          const comparisonLabel = document.getElementById('comparison-period-text');
          
          if (!periodInfo || !comparisonLabel) {
            // Si no hay información de comparación o elemento no existe, no hacer nada
            if (comparisonInfoDiv) {
              comparisonInfoDiv.classList.add('hidden');
            }
            return;
          }
          
          let labelText = '';
          const comparisonPeriod = periodInfo.comparisonPeriod || 'auto';
          
          // Crear labels amigables para cada tipo de comparación
          switch (comparisonPeriod) {
            case 'auto':
              labelText = 'vs período anterior equivalente';
              break;
            case 'october-2025':
              labelText = 'vs Octubre 2025';
              break;
            case 'august-2025':
              labelText = 'vs Agosto 2025';
              break;
            case 'september-2025':
              labelText = 'vs Septiembre 2025';
              break;
            case 'july-2025':
              labelText = 'vs Julio 2025';
              break;
            case 'june-2025':
              labelText = 'vs Junio 2025';
              break;
            case 'last-30-days':
              labelText = 'vs Últimos 30 días';
              break;
            case 'last-60-days':
              labelText = 'vs Últimos 60 días';
              break;
            case 'previous-month':
              labelText = 'vs Mes anterior';
              break;
            case 'previous-quarter':
              labelText = 'vs Trimestre anterior';
              break;
            case 'same-month-last-year':
              labelText = 'vs Mismo mes año anterior';
              break;
            default:
              labelText = 'vs período personalizado';
          }
          
          comparisonLabel.textContent = labelText;
          if (comparisonInfoDiv) {
            comparisonInfoDiv.classList.remove('hidden');
          }
        }
        
        // Actualizar UI del dashboard
        function updateDashboardUI() {
          if (!dashboardData) return;

          // KPIs principales
          document.getElementById('total-sales').textContent = formatCurrency(dashboardData.totalSales30Days);
          document.getElementById('avg-ticket').textContent = formatCurrency(dashboardData.avgTicket30Days);
          document.getElementById('orders-count').textContent = formatNumber(dashboardData.ordersCount30Days);
          
          // Indicadores comparativos de KPIs principales
          const comparative = dashboardData.comparative;
          if (comparative) {
            document.getElementById('total-sales-change').innerHTML = formatPercentageChange(comparative.totalSales.change);
            document.getElementById('avg-ticket-change').innerHTML = formatPercentageChange(comparative.avgTicket.change);
            document.getElementById('orders-count-change').innerHTML = formatPercentageChange(comparative.ordersCount.change);
          } else {
            document.getElementById('total-sales-change').innerHTML = '';
            document.getElementById('avg-ticket-change').innerHTML = '';
            document.getElementById('orders-count-change').innerHTML = '';
          }

          // Métodos de pago
          const paymentMethods = dashboardData.paymentMethods;
          document.getElementById('stripe-sales').textContent = formatCurrency(paymentMethods.stripe.sales);
          document.getElementById('stripe-percentage').textContent = paymentMethods.stripe.percentage + '%';
          document.getElementById('stripe-orders').textContent = paymentMethods.stripe.orders + ' órdenes';

          document.getElementById('paypal-sales').textContent = formatCurrency(paymentMethods.paypal.sales);
          document.getElementById('paypal-percentage').textContent = paymentMethods.paypal.percentage + '%';
          document.getElementById('paypal-orders').textContent = paymentMethods.paypal.orders + ' órdenes';

          document.getElementById('transfer-sales').textContent = formatCurrency(paymentMethods.transfer.sales);
          document.getElementById('transfer-percentage').textContent = paymentMethods.transfer.percentage + '%';
          document.getElementById('transfer-orders').textContent = paymentMethods.transfer.orders + ' órdenes';
          
          // Indicadores comparativos para métodos de pago
          if (comparative && comparative.paymentMethods) {
            document.getElementById('stripe-sales-change').innerHTML = formatPercentageChange(comparative.paymentMethods.stripe.salesChange);
            document.getElementById('paypal-sales-change').innerHTML = formatPercentageChange(comparative.paymentMethods.paypal.salesChange);
            document.getElementById('transfer-sales-change').innerHTML = formatPercentageChange(comparative.paymentMethods.transfer.salesChange);
          } else {
            document.getElementById('stripe-sales-change').innerHTML = '';
            document.getElementById('paypal-sales-change').innerHTML = '';
            document.getElementById('transfer-sales-change').innerHTML = '';
          }

          // Estados de órdenes
          const orderStates = dashboardData.orderStates;
          document.getElementById('completed-sales').textContent = formatCurrency(orderStates.completed.sales);
          document.getElementById('completed-percentage').textContent = orderStates.completed.percentage + '%';
          document.getElementById('completed-orders').textContent = orderStates.completed.orders + ' órdenes';

          document.getElementById('delivered-sales').textContent = formatCurrency(orderStates.delivered.sales);
          document.getElementById('delivered-percentage').textContent = orderStates.delivered.percentage + '%';
          document.getElementById('delivered-orders').textContent = orderStates.delivered.orders + ' órdenes';

          document.getElementById('processing-sales').textContent = formatCurrency(orderStates.processing.sales);
          document.getElementById('processing-percentage').textContent = orderStates.processing.percentage + '%';
          document.getElementById('processing-orders').textContent = orderStates.processing.orders + ' órdenes';
          
          // Indicadores comparativos para estados de órdenes
          if (comparative && comparative.orderStates) {
            document.getElementById('completed-sales-change').innerHTML = formatPercentageChange(comparative.orderStates.completed.salesChange);
            document.getElementById('delivered-sales-change').innerHTML = formatPercentageChange(comparative.orderStates.delivered.salesChange);
            document.getElementById('processing-sales-change').innerHTML = formatPercentageChange(comparative.orderStates.processing.salesChange);
          } else {
            document.getElementById('completed-sales-change').innerHTML = '';
            document.getElementById('delivered-sales-change').innerHTML = '';
            document.getElementById('processing-sales-change').innerHTML = '';
          }

          // Tipos de cliente (Distribuidor vs Cliente)
          const customerTypes = dashboardData.customerTypes;
          
          // Distribuidores
          document.getElementById('distributors-sales').textContent = formatCurrency(customerTypes.distributors.sales);
          document.getElementById('distributors-percentage').textContent = customerTypes.distributors.percentage + '%';
          document.getElementById('distributors-orders').textContent = customerTypes.distributors.orders + ' órdenes';
          document.getElementById('distributors-customers').textContent = customerTypes.distributors.customers + ' clientes únicos';
          document.getElementById('distributors-avg-ticket').textContent = 'Ticket prom: ' + formatCurrency(customerTypes.distributors.avgTicket);
          document.getElementById('distributors-avg-customer').textContent = 'Por distribuidor: ' + formatCurrency(customerTypes.distributors.avgPerCustomer);

          // Clientes regulares
          document.getElementById('customers-sales').textContent = formatCurrency(customerTypes.customers.sales);
          document.getElementById('customers-percentage').textContent = customerTypes.customers.percentage + '%';
          document.getElementById('customers-orders').textContent = customerTypes.customers.orders + ' órdenes';
          document.getElementById('customers-customers').textContent = customerTypes.customers.customers + ' clientes únicos';
          document.getElementById('customers-avg-ticket').textContent = 'Ticket prom: ' + formatCurrency(customerTypes.customers.avgTicket);
          document.getElementById('customers-avg-customer').textContent = 'Por cliente: ' + formatCurrency(customerTypes.customers.avgPerCustomer);
          
          // Indicadores comparativos para tipos de cliente
          if (comparative && comparative.customerTypes) {
            document.getElementById('distributors-sales-change').innerHTML = formatPercentageChange(comparative.customerTypes.distributors.salesChange);
            document.getElementById('customers-sales-change').innerHTML = formatPercentageChange(comparative.customerTypes.customers.salesChange);
          } else {
            document.getElementById('distributors-sales-change').innerHTML = '';
            document.getElementById('customers-sales-change').innerHTML = '';
          }

          // Top products
          const topProductsHTML = dashboardData.topProducts.map((product, index) => \`
            <div class="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-100">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                  \${index + 1}
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-800 truncate max-w-[200px]">\${product.name}</p>
                  <p class="text-xs text-gray-500">\${formatCurrency(product.avgPrice)} c/u</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm font-bold text-yellow-700">\${product.quantity} unidades</p>
                <p class="text-xs text-gray-500">\${formatCurrency(product.totalSales)} • \${product.percentage}%</p>
                <p class="text-xs text-gray-500">ID: \${product.id}</p>
              </div>
            </div>
          \`).join('');
          document.getElementById('top-products').innerHTML = topProductsHTML;

          // Top orders
          const topOrdersHTML = dashboardData.topOrders.map((order, index) => \`
            <div class="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-100">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                  \${index + 1}
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-800">\${order.customer}</p>
                  <p class="text-xs text-gray-500">Orden #\${order.id}</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm font-bold text-emerald-700">\${formatCurrency(order.total)}</p>
                <p class="text-xs text-gray-500">\${new Date(order.date).toLocaleDateString('es-MX')}</p>
              </div>
            </div>
          \`).join('');
          document.getElementById('top-orders').innerHTML = topOrdersHTML;
          
          // Actualizar labels de período dinámicamente
          updateProductsAndOrdersLabels();
          
          // Actualizar sección unificada de cupones
          updateUnifiedCouponsSection();
          
          // NUEVO: Actualizar secciones de costos de envío e insights
          updateShippingCostsSection();
          updateShippingInsightsSection();

          document.getElementById('loading').classList.add('hidden');
          document.getElementById('dashboard').classList.remove('hidden');
        }

        // Actualizar display del período activo
        function updatePeriodDisplay(periodInfo) {
          if (!periodInfo) return;
          
          const display = document.getElementById('active-period-display');
          display.textContent = periodInfo.label;
        }

        // Actualizar labels de período para productos y órdenes
        function updateProductsAndOrdersLabels() {
          // Obtener el período actual desde el selector
          const periodSelector = document.getElementById('period-selector');
          const selectedPeriod = periodSelector.value;
          
          let periodLabel = '';
          
          // Mapear los valores del selector a labels amigables
          switch(selectedPeriod) {
            case 'today':
              periodLabel = 'Hoy';
              break;
            case 'yesterday':
              periodLabel = 'Ayer';
              break;
            case 'last-7-days':
              periodLabel = 'Últimos 7 días';
              break;
            case 'last-14-days':
              periodLabel = 'Últimos 14 días';
              break;
            case 'last-30-days':
              periodLabel = 'Últimos 30 días';
              break;
            case 'august-2025':
              periodLabel = 'Agosto 2025';
              break;
            case 'september-2025':
              periodLabel = 'Septiembre 2025';
              break;
            case 'october-2025':
              periodLabel = 'Octubre 2025';
              break;
            case 'custom':
              if (customDateRange) {
                const startDate = new Date(customDateRange.start).toLocaleDateString('es-MX');
                const endDate = new Date(customDateRange.end).toLocaleDateString('es-MX');
                periodLabel = startDate + ' - ' + endDate;
              } else {
                periodLabel = 'Período Personalizado';
              }
              break;
            default:
              periodLabel = 'Período Actual';
          }
          
          // Actualizar los labels
          document.getElementById('products-period-label').textContent = 'Más vendidos (' + periodLabel + ')';
          document.getElementById('orders-period-label').textContent = 'Mayor valor (' + periodLabel + ')';
        }

        // Actualizar contadores de estados
        function updateStatusCounters(statusBreakdown) {
          document.getElementById('count-completed').textContent = statusBreakdown.completed || 0;
          document.getElementById('count-delivered').textContent = statusBreakdown.delivered || 0;
          document.getElementById('count-processing').textContent = statusBreakdown.processing || 0;
          document.getElementById('count-on-hold').textContent = statusBreakdown['on-hold'] || 0;
          document.getElementById('count-pending').textContent = statusBreakdown.pending || 0;
          
          // Actualizar display de estados activos
          const activeStatuses = getActiveStatuses();
          const statusNames = {
            'completed': 'Completadas',
            'delivered': 'Entregadas', 
            'processing': 'En Proceso',
            'on-hold': 'En Espera',
            'pending': 'Pendientes'
          };
          
          const activeStatusDisplay = activeStatuses.map(s => statusNames[s]).join(', ');
          document.getElementById('active-statuses-display').textContent = activeStatusDisplay;
        }

        // Actualizar sección de cupones
        // FUNCIÓN UNIFICADA: Actualizar sección de cupones (tradicionales + envío gratis)
        function updateUnifiedCouponsSection() {
          if (!dashboardData || (!dashboardData.coupons && !dashboardData.freeShippingCoupons)) {
            document.getElementById('coupons-loading').classList.add('hidden');
            document.getElementById('coupons-empty').classList.remove('hidden');
            document.getElementById('coupons-grid').classList.add('hidden');
            document.getElementById('coupons-summary').classList.add('hidden');
            return;
          }
          
          const couponsData = dashboardData.coupons || { couponsUsed: [], totalAmount: 0, totalOrders: 0 };
          const freeShippingData = dashboardData.freeShippingCoupons || { couponsBreakdown: [], totalRealCost: 0, totalOrders: 0 };
          const comparative = dashboardData.comparative;
          
          // Ocultar loading
          document.getElementById('coupons-loading').classList.add('hidden');
          
          // Si no hay cupones de ningún tipo
          if (couponsData.couponsUsed.length === 0 && freeShippingData.couponsBreakdown.length === 0) {
            document.getElementById('coupons-empty').classList.remove('hidden');
            document.getElementById('coupons-grid').classList.add('hidden');
            document.getElementById('coupons-summary').classList.add('hidden');
            // Resetear valores por defecto
            document.getElementById('total-coupons-amount').innerHTML = '$0 MXN';
            document.getElementById('total-coupons-orders').textContent = '0';
            document.getElementById('total-coupons-percentage').textContent = '0% del total de ventas';
            return;
          }
          
          // Mostrar cupones
          document.getElementById('coupons-empty').classList.add('hidden');
          document.getElementById('coupons-grid').classList.remove('hidden');
          document.getElementById('coupons-summary').classList.remove('hidden');
          
          // Filtrar cupones tradicionales (excluir códigos de envío gratis)
          // NOTA: 'guiapropia' ahora aparece como cupón tradicional (cliente paga su propio envío)
          const freeShippingCodes = ['enviodist', 'envío gratis', 'envio gratis', 'free_shipping'];
          const traditionalCoupons = couponsData.couponsUsed.filter(coupon => 
            !freeShippingCodes.includes(coupon.code.toLowerCase())
          );
          
          // Generar HTML para cupones tradicionales
          const traditionalCouponsHTML = traditionalCoupons.map((coupon, index) => {
            const bgColors = [
              'from-orange-50 to-red-50 border-orange-100',
              'from-amber-50 to-yellow-50 border-amber-100',
              'from-rose-50 to-pink-50 border-rose-100',
              'from-violet-50 to-purple-50 border-violet-100',
              'from-cyan-50 to-blue-50 border-cyan-100'
            ];
            const iconColors = [
              'bg-orange-500',
              'bg-amber-500', 
              'bg-rose-500',
              'bg-violet-500',
              'bg-cyan-500'
            ];
            const textColors = [
              'text-orange-600 bg-orange-100',
              'text-amber-600 bg-amber-100',
              'text-rose-600 bg-rose-100', 
              'text-violet-600 bg-violet-100',
              'text-cyan-600 bg-cyan-100'
            ];
            
            const colorIndex = index % bgColors.length;
            
            return \`
              <div class="bg-gradient-to-r \${bgColors[colorIndex]} rounded-xl p-4 border">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center space-x-2">
                    <div class="p-2 rounded-lg \${iconColors[colorIndex]}">
                      <i class="fas fa-tag text-sm text-white"></i>
                    </div>
                    <div>
                      <p class="text-xs font-medium text-gray-600">Cupón Descuento</p>
                      <p class="text-sm font-bold text-gray-900 break-all">\${coupon.code}</p>
                    </div>
                  </div>
                  <span class="text-xs font-bold \${textColors[colorIndex]} px-2 py-1 rounded-full">\${coupon.percentage}%</span>
                </div>
                <div class="space-y-1">
                  <div class="flex items-center justify-between">
                    <p class="text-xs text-gray-500">Total descontado:</p>
                    <p class="text-sm font-bold text-gray-900">\${formatCurrency(coupon.totalDiscount)}</p>
                  </div>
                  <div class="flex items-center justify-between">
                    <p class="text-xs text-gray-500">Órdenes:</p>
                    <p class="text-sm font-medium text-gray-700">\${coupon.ordersCount}</p>
                  </div>
                  <div class="flex items-center justify-between">
                    <p class="text-xs text-gray-500">Promedio/orden:</p>
                    <p class="text-sm font-medium text-gray-700">\${formatCurrency(coupon.avgDiscountPerOrder)}</p>
                  </div>
                </div>
              </div>
            \`;
          }).join('');
          
          // Generar HTML para cupones de envío gratis
          const freeShippingCouponsHTML = freeShippingData.couponsBreakdown.map((coupon, index) => {
            const bgColors = [
              'from-red-50 to-pink-50 border-red-100',
              'from-purple-50 to-indigo-50 border-purple-100',
              'from-blue-50 to-cyan-50 border-blue-100',
              'from-green-50 to-emerald-50 border-green-100'
            ];
            const iconColors = [
              'bg-red-500',
              'bg-purple-500', 
              'bg-blue-500',
              'bg-green-500'
            ];
            
            const colorIndex = index % bgColors.length;
            
            return \`
              <div class="bg-gradient-to-r \${bgColors[colorIndex]} rounded-xl p-4 border">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center space-x-2">
                    <div class="p-2 rounded-lg \${iconColors[colorIndex]}">
                      <i class="fas fa-shipping-fast text-sm text-white"></i>
                    </div>
                    <div>
                      <p class="text-xs font-medium text-gray-600">Envío Gratis</p>
                      <p class="text-sm font-bold text-gray-900 break-all">\${coupon.code}</p>
                    </div>
                  </div>
                  <span class="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">COSTO REAL</span>
                </div>
                <div class="space-y-1">
                  <div class="flex items-center justify-between">
                    <p class="text-xs text-gray-500">Costo absorbido:</p>
                    <p class="text-sm font-bold text-red-600">\${formatCurrency(coupon.totalRealCost)}</p>
                  </div>
                  <div class="flex items-center justify-between">
                    <p class="text-xs text-gray-500">Órdenes:</p>
                    <p class="text-sm font-medium text-gray-700">\${coupon.ordersCount}</p>
                  </div>
                  <div class="flex items-center justify-between">
                    <p class="text-xs text-gray-500">Promedio/orden:</p>
                    <p class="text-sm font-medium text-gray-700">\${formatCurrency(coupon.avgCostPerOrder)}</p>
                  </div>
                </div>
              </div>
            \`;
          }).join('');
          
          // Combinar ambos tipos de cupones
          document.getElementById('coupons-grid').innerHTML = traditionalCouponsHTML + freeShippingCouponsHTML;
          
          // Calcular totales combinados
          const totalDiscountAmount = couponsData.totalAmount || 0;
          const totalFreeShippingCost = freeShippingData.totalRealCost || 0;
          const totalCombinedImpact = totalDiscountAmount + totalFreeShippingCost;
          const totalCombinedOrders = (couponsData.totalOrders || 0) + (freeShippingData.totalOrders || 0);
          
          // Calcular porcentaje del total de ventas
          const totalSales = dashboardData.totalSales30Days || dashboardData.revenue || 0;
          const percentageOfSales = totalSales > 0 ? ((totalCombinedImpact / totalSales) * 100).toFixed(1) : '0';
          
          // Actualizar resumen con datos combinados
          document.getElementById('total-coupons-amount').innerHTML = \`
            <div>
              <div class="text-xl font-bold text-gray-900">\${formatCurrency(totalCombinedImpact)} MXN</div>
              <div class="text-xs text-gray-500 mt-1">
                <span class="text-orange-600">Descuentos: \${formatCurrency(totalDiscountAmount)}</span> • 
                <span class="text-red-600">Envío gratis: \${formatCurrency(totalFreeShippingCost)}</span>
              </div>
              <div class="text-xs font-medium text-blue-600 mt-1">
                \${percentageOfSales}% del total de ventas
              </div>
            </div>
          \`;
          document.getElementById('total-coupons-orders').textContent = formatNumber(totalCombinedOrders);
          
          // Usar la variable totalSales ya declarada arriba
          const percentageOfSales2 = totalSales > 0 ? ((totalCombinedImpact / totalSales) * 100).toFixed(1) : '0';
          document.getElementById('total-coupons-percentage').textContent = percentageOfSales2 + '% del total de ventas';
          
          // Mostrar indicador comparativo si disponible
          if (comparative && comparative.coupons) {
            document.getElementById('total-coupons-change').innerHTML = formatPercentageChange(comparative.coupons.amountChange);
          } else {
            document.getElementById('total-coupons-change').innerHTML = '';
          }
        }

        // FUNCIÓN ACTUALIZADA: Actualizar sección de costos de envío reales
        function updateShippingCostsSection() {
          if (!dashboardData || !dashboardData.shippingCosts) {
            // Si no hay datos, mostrar valores por defecto solo en elementos que existen
            const totalRealElement = document.getElementById('shipping-total-real');
            if (totalRealElement) totalRealElement.textContent = '$0 MXN';
            
            const ordersFoundElement = document.getElementById('shipping-orders-found');
            if (ordersFoundElement) ordersFoundElement.textContent = '0 envíos encontrados';
            
            const avgRealElement = document.getElementById('shipping-avg-real');
            if (avgRealElement) avgRealElement.textContent = 'Promedio: $0';

            const topCostElement = document.getElementById('shipping-top-cost');
            if (topCostElement) topCostElement.textContent = '$0';
            
            const topOrderElement = document.getElementById('shipping-top-order');
            if (topOrderElement) topOrderElement.textContent = 'Orden: -';
            
            const topCarrierElement = document.getElementById('shipping-top-carrier');
            if (topCarrierElement) topCarrierElement.textContent = '-';
            
            return;
          }
          
          const shippingData = dashboardData.shippingCosts;
          
          // Costo Real Total - solo actualizar si los elementos existen
          const totalRealElement = document.getElementById('shipping-total-real');
          if (totalRealElement) totalRealElement.textContent = formatCurrency(shippingData.totalRealCost);
          
          const ordersFoundElement = document.getElementById('shipping-orders-found');
          if (ordersFoundElement) ordersFoundElement.textContent = shippingData.found + ' envíos encontrados';
          
          const avgRealElement = document.getElementById('shipping-avg-real');
          if (avgRealElement) avgRealElement.textContent = 'Promedio: ' + formatCurrency(shippingData.avgRealCost);

          // Top Envío - solo actualizar si los elementos existen
          if (shippingData.topShipments && shippingData.topShipments.length > 0) {
            const topShipment = shippingData.topShipments[0];
            
            const topCostElement = document.getElementById('shipping-top-cost');
            if (topCostElement) topCostElement.textContent = formatCurrency(topShipment.realCost);
            
            const topOrderElement = document.getElementById('shipping-top-order');
            if (topOrderElement) topOrderElement.textContent = 'Orden: #' + topShipment.orderId;
            
            const topCarrierElement = document.getElementById('shipping-top-carrier');
            if (topCarrierElement) topCarrierElement.textContent = topShipment.carrier;
          }
        }

        // FUNCIÓN SIMPLIFICADA: Actualizar sección de insights de envío (solo top orders)
        function updateShippingInsightsSection() {
          if (!dashboardData || !dashboardData.freeShippingCoupons) {
            // Si no hay datos, mostrar mensaje por defecto solo en top orders
            const topOrdersElement = document.getElementById('top-free-shipping-orders');
            if (topOrdersElement) {
              topOrdersElement.innerHTML = '<p class="text-gray-500 text-sm">No hay datos de envíos gratis en este período</p>';
            }
            return;
          }
          
          const freeShippingData = dashboardData.freeShippingCoupons || {};
          
          // Top Órdenes Costosas
          if (freeShippingData.topFreeShippingOrders && freeShippingData.topFreeShippingOrders.length > 0) {
            const topOrdersHTML = freeShippingData.topFreeShippingOrders.map((order, index) => {
              return \`
                <div class="flex items-center justify-between p-3 bg-white rounded-lg border border-red-100">
                  <div class="flex items-center space-x-3">
                    <div class="flex-shrink-0">
                      <span class="inline-flex items-center justify-center w-8 h-8 bg-red-100 text-red-600 rounded-full text-sm font-bold">
                        \${index + 1}
                      </span>
                    </div>
                    <div>
                      <p class="text-sm font-medium text-gray-900">Orden #\${order.orderId}</p>
                      <p class="text-xs text-gray-500">\${order.customerEmail}</p>
                      <p class="text-xs text-red-600">\${order.couponCodes.join(', ')}</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-bold text-red-600">\${formatCurrency(order.realCost)}</p>
                    <p class="text-xs text-gray-500">Orden: \${formatCurrency(order.orderTotal)}</p>
                  </div>
                </div>
              \`;
            }).join('');
            
            document.getElementById('top-free-shipping-orders').innerHTML = topOrdersHTML;
          } else {
            document.getElementById('top-free-shipping-orders').innerHTML = '<p class="text-gray-500 text-sm">No hay órdenes de envío gratis en este período</p>';
          }
        }

        // Función para reintentar conexión
        function retryConnection() {
          document.getElementById('error').classList.add('hidden');
          loadDashboard();
        }

        // Funciones de chat
        function enableChat() {
          document.getElementById('chat-input').disabled = false;
          document.getElementById('chat-send').disabled = false;
        }

        function setChatMessage(message) {
          document.getElementById('chat-input').value = message;
        }

        function handleChatKeyPress(event) {
          if (event.key === 'Enter') {
            sendChatMessage();
          }
        }

        async function sendChatMessage() {
          const input = document.getElementById('chat-input');
          const message = input.value.trim();
          
          if (!message) return;
          
          const messagesContainer = document.getElementById('chat-messages');
          
          // Mostrar mensaje del usuario
          const userMessage = document.createElement('div');
          userMessage.className = 'flex justify-end';
          userMessage.innerHTML = \`
            <div class="bg-purple-500 text-white px-4 py-2 rounded-lg max-w-xs">
              <p class="text-sm">\${message}</p>
            </div>
          \`;
          messagesContainer.appendChild(userMessage);
          
          // Limpiar input
          input.value = '';
          
          // Mostrar indicador de escritura
          const typingIndicator = document.createElement('div');
          typingIndicator.className = 'flex justify-start';
          typingIndicator.innerHTML = \`
            <div class="bg-gray-200 px-4 py-2 rounded-lg">
              <p class="text-sm text-gray-600">
                <i class="fas fa-circle animate-pulse"></i>
                <i class="fas fa-circle animate-pulse" style="animation-delay: 0.2s;"></i>
                <i class="fas fa-circle animate-pulse" style="animation-delay: 0.4s;"></i>
                Analizando...
              </p>
            </div>
          \`;
          messagesContainer.appendChild(typingIndicator);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
          
          try {
            // Usar axios que ya tiene configurado el Authorization header
            const response = await axios.post('/api/chat', { message });
            const result = response.data;
            
            // Remover indicador de escritura
            messagesContainer.removeChild(typingIndicator);
            
            if (result.success) {
              // Mostrar respuesta de la IA
              const aiMessage = document.createElement('div');
              aiMessage.className = 'flex justify-start';
              aiMessage.innerHTML = \`
                <div class="bg-white border border-gray-200 px-4 py-3 rounded-lg max-w-md shadow-sm">
                  <div class="flex items-center space-x-2 mb-2">
                    <i class="fas fa-robot text-purple-500"></i>
                    <span class="text-xs text-gray-500 font-medium">Analista IA</span>
                    <span class="text-xs text-gray-400">• \${result.data.executionTime}ms</span>
                  </div>
                  <div class="text-sm text-gray-800 whitespace-pre-wrap">\${result.data.response}</div>
                </div>
              \`;
              messagesContainer.appendChild(aiMessage);
            } else {
              // Mostrar error
              const errorMessage = document.createElement('div');
              errorMessage.className = 'flex justify-start';
              errorMessage.innerHTML = \`
                <div class="bg-red-50 border border-red-200 px-4 py-2 rounded-lg max-w-xs">
                  <p class="text-sm text-red-600">Error: \${result.error}</p>
                </div>
              \`;
              messagesContainer.appendChild(errorMessage);
            }
            
          } catch (error) {
            // Remover indicador de escritura
            messagesContainer.removeChild(typingIndicator);
            
            // Mostrar error de conexión
            const errorMessage = document.createElement('div');
            errorMessage.className = 'flex justify-start';
            errorMessage.innerHTML = \`
              <div class="bg-red-50 border border-red-200 px-4 py-2 rounded-lg max-w-xs">
                <p class="text-sm text-red-600">Error de conexión. Intenta de nuevo.</p>
              </div>
            \`;
            messagesContainer.appendChild(errorMessage);
          }
          
          // Scroll al final
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Función para verificar autenticación
        function checkAuthentication() {
          const token = localStorage.getItem('auth_token');
          if (!token) {
            window.location.href = '/login';
            return false;
          }
          
          // Configurar axios para usar el token automáticamente
          axios.defaults.headers.common['Authorization'] = \`Bearer \${token}\`;
          return true;
        }

        // Verificar token con el servidor
        async function verifyTokenWithServer() {
          const token = localStorage.getItem('auth_token');
          if (!token) {
            window.location.href = '/login';
            return false;
          }

          try {
            const response = await axios.post('/api/verify-token', {}, {
              headers: { 'Authorization': \`Bearer \${token}\` }
            });
            
            if (response.data.success) {
              return true;
            } else {
              localStorage.removeItem('auth_token');
              localStorage.removeItem('user_info');
              window.location.href = '/login';
              return false;
            }
          } catch (error) {
            console.error('Error verificando token:', error);
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_info');
            window.location.href = '/login';
            return false;
          }
        }

        // Inicializar información del usuario
        function initializeUserInfo() {
          const userInfo = localStorage.getItem('user_info');
          if (userInfo) {
            try {
              const user = JSON.parse(userInfo);
              
              // Actualizar nombre del usuario en ambos headers (desktop y móvil)
              const userNameElement = document.getElementById('user-name');
              const userNameMobileElement = document.getElementById('user-name-mobile');
              
              if (userNameElement) {
                userNameElement.textContent = user.name || 'Usuario';
              }
              if (userNameMobileElement) {
                userNameMobileElement.textContent = user.name || 'Usuario';
              }
              
              // Mostrar botón de gestión de usuarios solo para administradores (desktop y móvil)
              const adminBtn = document.getElementById('admin-users-btn');
              const adminBtnMobile = document.getElementById('admin-users-btn-mobile');
              
              if (user.role === 'admin') {
                if (adminBtn) adminBtn.classList.remove('hidden');
                if (adminBtnMobile) adminBtnMobile.classList.remove('hidden');
                console.log('Botones de administración mostrados para:', user.name);
              }
              
              console.log('Usuario inicializado:', user.name, 'Role:', user.role);
            } catch (error) {
              console.error('Error parsing user info:', error);
            }
          }
        }

        // Inicializar dashboard al cargar la página
        window.addEventListener('DOMContentLoaded', async () => {
          console.log('Dashboard iniciando...');
          
          // Verificar si hay token
          const token = localStorage.getItem('auth_token');
          if (!token) {
            console.log('No hay token, redirigiendo al login');
            window.location.href = '/login';
            return;
          }

          // CRÍTICO: Verificar si el token está expirado antes de usarlo
          if (isTokenExpired(token)) {
            console.log('Token expirado detectado, limpiando y redirigiendo...');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_info');
            // Mostrar mensaje por 2 segundos antes de redirigir
            document.body.innerHTML = '<div style="text-align:center; margin-top:50px; font-family:Arial;"><h2>🔄 Token expirado</h2><p>Redirigiendo al login...</p></div>';
            setTimeout(() => {
              window.location.href = '/login';
            }, 2000);
            return;
          }

          console.log('Token válido encontrado:', token.substring(0, 50) + '...');
          
          // Configurar axios con el token
          axios.defaults.headers.common['Authorization'] = \`Bearer \${token}\`;
          
          // Configurar interceptor de respuesta para manejar errores de token automáticamente
          axios.interceptors.response.use(
            response => response,
            error => {
              console.error('Axios interceptor - Error detectado:', error);
              
              // Verificar si es error de token
              const isTokenError = (
                (error.response && error.response.status === 401) ||
                (error.response && error.response.data && error.response.data.error && 
                 (error.response.data.error.includes('Token') || 
                  error.response.data.error.includes('token') ||
                  error.response.data.error.includes('inválido') ||
                  error.response.data.error.includes('expirado')))
              );
              
              if (isTokenError) {
                console.log('Interceptor - Token inválido detectado, limpiando y redirigiendo');
                localStorage.clear();
                delete axios.defaults.headers.common['Authorization'];
                window.location.href = '/login';
                return Promise.reject(new Error('Token inválido - Redirigiendo al login'));
              }
              
              return Promise.reject(error);
            }
          );
          
          // Inicializar información del usuario
          initializeUserInfo();
          
          // Inicializar checkbox de comparación y texto
          const comparisonCheckbox = document.getElementById('enable-comparison');
          if (comparisonCheckbox) {
            comparisonCheckbox.checked = comparisonEnabled;
            updateComparisonPeriodText();
          }
          
          // Verificar token con el servidor antes de cargar dashboard
          const isValidToken = await verifyTokenWithServer();
          if (!isValidToken) {
            return; // verifyTokenWithServer ya maneja la redirección
          }
          
          // Intentar cargar dashboard directamente
          console.log('Token válido, cargando dashboard...');
          await loadDashboard();
          
          // Cargar datos de Google Analytics 4
          console.log('Cargando datos de Google Analytics 4...');
          await loadAnalytics();
          
          // Cargar datos de Google Ads
          console.log('Cargando datos de Google Ads...');
          await loadGoogleAds();
          
          // Cargar datos de Meta Ads
          console.log('Cargando datos de Meta Ads...');
          await loadMetaAds();
          
          // Cargar contenido orgánico de Meta
          console.log('Cargando contenido orgánico de Meta...');
          await loadMetaOrganic();
        });
        
        // === GESTIÓN DE USUARIOS ===
        
        let currentUsers = [];
        
        // Abrir modal de gestión de usuarios
        function openUserManagement() {
          document.getElementById('user-management-modal').classList.remove('hidden');
          loadUsers();
        }
        
        // Cerrar modal
        function closeUserManagement() {
          document.getElementById('user-management-modal').classList.add('hidden');
        }
        
        // Cargar lista de usuarios
        async function loadUsers() {
          try {
            const response = await axios.get('/api/users');
            currentUsers = response.data.users;
            renderUsersList();
          } catch (error) {
            console.error('Error cargando usuarios:', error);
            showUserMessage('Error cargando usuarios', 'error');
          }
        }
        
        // Renderizar lista de usuarios
        function renderUsersList() {
          const usersList = document.getElementById('users-list');
          usersList.innerHTML = '';
          
          currentUsers.forEach(user => {
            const userRow = document.createElement('div');
            userRow.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200';
            
            const statusBadge = user.isActive ? 
              '<span class="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">Activo</span>' :
              '<span class="text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded-full">Inactivo</span>';
              
            const roleBadge = user.role === 'admin' ?
              '<span class="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded-full">Admin</span>' :
              '<span class="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full">Usuario</span>';
            
            userRow.innerHTML = \`
              <div class="flex-1">
                <div class="flex items-center space-x-3">
                  <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-full flex items-center justify-center">
                    <span class="text-white font-bold text-sm">\${user.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p class="font-semibold text-gray-800">\${user.name}</p>
                    <p class="text-sm text-gray-600">\${user.email}</p>
                    <p class="text-xs text-gray-500">Creado: \${new Date(user.createdAt).toLocaleDateString('es-MX')}</p>
                  </div>
                </div>
              </div>
              <div class="flex items-center space-x-2">
                \${roleBadge}
                \${statusBadge}
                \${user.role !== 'admin' ? \`<button onclick="deleteUser(\${user.id})" class="text-red-600 hover:text-red-800 p-2"><i class="fas fa-trash text-sm"></i></button>\` : ''}
              </div>
            \`;
            
            usersList.appendChild(userRow);
          });
          
          // Actualizar contador
          document.getElementById('users-count').textContent = \`\${currentUsers.length}/5 usuarios\`;
        }
        
        // Agregar nuevo usuario
        async function addUser() {
          const name = document.getElementById('new-user-name').value.trim();
          const email = document.getElementById('new-user-email').value.trim();
          const password = document.getElementById('new-user-password').value;
          
          if (!name || !email || !password) {
            showUserMessage('Todos los campos son obligatorios', 'error');
            return;
          }
          
          if (password.length < 6) {
            showUserMessage('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
          }
          
          try {
            const response = await axios.post('/api/users', {
              name: name,
              email: email,
              password: password,
              role: 'user'
            });
            
            if (response.data.success) {
              showUserMessage('Usuario agregado correctamente', 'success');
              // Limpiar formulario
              document.getElementById('new-user-name').value = '';
              document.getElementById('new-user-email').value = '';
              document.getElementById('new-user-password').value = '';
              // Recargar lista
              loadUsers();
            } else {
              showUserMessage(response.data.message || 'Error agregando usuario', 'error');
            }
          } catch (error) {
            console.error('Error:', error);
            showUserMessage('Error de conexión', 'error');
          }
        }
        
        // Eliminar usuario
        async function deleteUser(userId) {
          if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
            return;
          }
          
          try {
            const response = await axios.delete(\`/api/users/\${userId}\`);
            
            if (response.data.success) {
              showUserMessage('Usuario eliminado correctamente', 'success');
              loadUsers();
            } else {
              showUserMessage(response.data.message || 'Error eliminando usuario', 'error');
            }
          } catch (error) {
            console.error('Error:', error);
            showUserMessage('Error de conexión', 'error');
          }
        }
        
        // Función de logout
        async function logout() {
          try {
            console.log('Iniciando logout...');
            
            // Limpiar datos locales inmediatamente
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_info');
            
            // Opcional: llamar al endpoint de logout
            try {
              await axios.post('/api/logout');
              console.log('Logout API exitoso');
            } catch (error) {
              console.log('Error en logout API (no crítico):', error);
            }
            
            // Limpiar headers de axios
            delete axios.defaults.headers.common['Authorization'];
            
            console.log('Redirigiendo al login...');
            // Redirigir al login
            window.location.href = '/login';
            
          } catch (error) {
            console.error('Error durante logout:', error);
            // Forzar logout aunque haya error
            localStorage.clear();
            window.location.replace('/login');
          }
        }
        
        // Función alternativa de logout (por si falla la principal)
        function forceLogout() {
          localStorage.clear();
          sessionStorage.clear();
          window.location.replace('/login');
        }
        
        // Mostrar mensajes en el modal de usuarios
        function showUserMessage(message, type) {
          const messageDiv = document.getElementById('user-message');
          messageDiv.textContent = message;
          messageDiv.className = \`p-3 rounded-lg text-sm font-medium \${type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}\`;
          messageDiv.classList.remove('hidden');
          
          setTimeout(() => {
            messageDiv.classList.add('hidden');
          }, 5000);
        }
        </script>
        
        <!-- Modal de Gestión de Usuarios -->
        <div id="user-management-modal" class="hidden fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
          <div class="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <!-- Header -->
            <div class="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 rounded-t-xl">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-2xl font-bold text-white">Gestión de Usuarios</h2>
                  <p class="text-blue-100 text-sm mt-1">Administrar acceso al dashboard</p>
                </div>
                <button onclick="closeUserManagement()" class="text-white hover:text-gray-200 text-2xl">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            </div>
            
            <!-- Content -->
            <div class="p-6">
              <!-- Message -->
              <div id="user-message" class="hidden mb-4"></div>
              
              <!-- Stats -->
              <div class="bg-gray-50 rounded-lg p-4 mb-6">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-4">
                    <div class="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                      <i class="fas fa-users text-white text-xl"></i>
                    </div>
                    <div>
                      <p id="users-count" class="text-lg font-semibold text-gray-800">0/5 usuarios</p>
                      <p class="text-sm text-gray-600">Límite máximo: 5 usuarios</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Add User Form -->
              <div class="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 mb-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-4">
                  <i class="fas fa-user-plus mr-2 text-green-600"></i>
                  Agregar Nuevo Usuario
                </h3>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                    <input type="text" id="new-user-name" placeholder="Marco Serrano" 
                           class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" id="new-user-email" placeholder="usuario@adaptoheal.com" 
                           class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                    <input type="password" id="new-user-password" placeholder="Mínimo 6 caracteres" 
                           class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  </div>
                </div>
                
                <button onclick="addUser()" 
                        class="bg-gradient-to-r from-green-500 to-blue-500 text-white px-6 py-2 rounded-lg font-medium hover:from-green-600 hover:to-blue-600 transition-all">
                  <i class="fas fa-plus mr-2"></i>Agregar Usuario
                </button>
              </div>
              
              <!-- Users List -->
              <div>
                <h3 class="text-lg font-semibold text-gray-800 mb-4">
                  <i class="fas fa-list mr-2 text-blue-600"></i>
                  Usuarios Actuales
                </h3>
                
                <div id="users-list" class="space-y-3">
                  <!-- Los usuarios se cargan aquí dinámicamente -->
                </div>
              </div>
            </div>
            
            <!-- Footer -->
            <div class="bg-gray-50 px-6 py-4 rounded-b-xl">
              <div class="flex justify-between items-center">
                <p class="text-sm text-gray-600">
                  <i class="fas fa-info-circle mr-1"></i>
                  Todos los usuarios tienen acceso de solo lectura al dashboard
                </p>
                <button onclick="closeUserManagement()" 
                        class="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
    </body>
    </html>
  `;
};

// Servidor HTTP
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // === RUTAS DE AUTENTICACIÓN ===
    if (pathname === '/login') {
      // Página de login
      try {
        const loginHTML = fs.readFileSync(path.join(__dirname, 'public', 'login.html'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(loginHTML);
      } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Login page not found');
      }
      return;
      
    } else if (pathname === '/fix-token') {
      // Página de actualización de token
      try {
        const fixTokenHTML = fs.readFileSync(path.join(__dirname, 'fix-token.html'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fixTokenHTML);
      } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Fix token page not found');
      }
      return;
      
    } else if (pathname === '/clear-token') {
      // Página de limpieza de token expirado
      try {
        const clearTokenHTML = fs.readFileSync(path.join(__dirname, 'clear-token.html'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(clearTokenHTML);
      } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Clear token page not found');
      }
      return;
      
    } else if (pathname === '/force-clean') {
      // Página de limpieza forzada completa
      try {
        const forceCleanHTML = fs.readFileSync(path.join(__dirname, 'force-clean.html'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(forceCleanHTML);
      } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Force clean page not found');
      }
      return;
      
    } else if (pathname === '/test-dashboard') {
      // Página de prueba del dashboard con auto login
      try {
        const testDashboardHTML = fs.readFileSync(path.join(__dirname, 'test-dashboard.html'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(testDashboardHTML);
      } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Test dashboard page not found');
      }
      return;
      
    } else if (pathname === '/autologin') {
      // Página de auto login para acceder al dashboard
      try {
        const autoLoginHTML = fs.readFileSync(path.join(__dirname, 'autologin.html'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(autoLoginHTML);
      } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Auto login page not found');
      }
      return;
      
    } else if (pathname === '/test-complete') {
      // Página de pruebas completas
      try {
        const testHTML = fs.readFileSync(path.join(__dirname, 'complete_test.html'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(testHTML);
      } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Test page not found');
      }
      return;
      
    } else if (pathname === '/simulate-login') {
      // Página de simulación de login
      try {
        const simulateHTML = fs.readFileSync(path.join(__dirname, 'simulate_login.html'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(simulateHTML);
      } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Simulate page not found');
      }
      return;
      
    } else if (pathname === '/test-shipping') {
      // Página de prueba para integración de costos de envío
      const filePath = path.join(__dirname, 'test-shipping.html');
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Página no encontrada');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data);
        }
      });
      return;
      
    } else if (pathname === '/api/login' && req.method === 'POST') {
      // API Login
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        try {
          const { email, password } = JSON.parse(body);
          const result = await authenticateUser(email, password);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (error) {
          console.error('Login API error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Error interno del servidor' }));
        }
      });
      return;
      
    } else if (pathname === '/api/verify-token' && req.method === 'POST') {
      // Verificar token
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        try {
          const token = req.headers.authorization?.replace('Bearer ', '');
          if (!token) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Token requerido' }));
            return;
          }
          
          const decoded = verifyToken(token);
          if (decoded) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, user: decoded }));
          } else {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Token inválido' }));
          }
        } catch (error) {
          console.error('Token verification error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Error interno del servidor' }));
        }
      });
      return;
      
    } else if (pathname === '/api/logout' && req.method === 'POST') {
      // Logout (client-side token removal)
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Sesión cerrada' }));
      return;
      
    } else if (pathname === '/api/users' && req.method === 'GET') {
      // Listar usuarios (solo admin)
      authMiddleware(req, res, async () => {
        const result = await listUsers(req.user);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      });
      return;
      
    } else if (pathname === '/api/debug-order' && req.method === 'GET') {
      // TEMPORAL: Debug para ver estructura completa de orden
      authMiddleware(req, res, async () => {
        try {
          const orderId = query.order_id || '13786';
          const orderData = await fetchWooCommerceData(`orders/${orderId}`);
          
          console.log('🔍 Estructura de orden completa - shipping_lines:', orderData.shipping_lines);
          console.log('🔍 Shipping total:', orderData.shipping_total);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: true, 
            order_id: orderId,
            shipping_lines: orderData.shipping_lines || [],
            shipping_total: orderData.shipping_total || '0',
            shipping_methods: orderData.shipping_lines?.map(line => ({
              method_title: line.method_title,
              method_id: line.method_id,
              total: line.total
            })) || []
          }));
        } catch (error) {
          console.error('Error obteniendo orden:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: error.message }));
        }
      });
      return;
      
    } else if (pathname === '/api/test-postgres' && req.method === 'GET') {
      // Endpoint para probar conexión PostgreSQL
      authMiddleware(req, res, async () => {
        try {
          // Probar conexión
          const connectionOk = await testConnection();
          
          // Obtener estadísticas de envíos
          const stats = await getShippingStats();
          
          // Obtener algunas muestras de envíos
          const samples = await getAllShipments(5);
          
          // Probar búsqueda por orden específica
          const orderId = query.order_id || '13774';
          const shippingData = await getShippingDataByOrderId(orderId);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: true,
            connection: connectionOk,
            stats: stats,
            samples: samples,
            test_order: {
              order_id: orderId,
              result: shippingData
            }
          }));
        } catch (error) {
          console.error('Error testing PostgreSQL:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: error.message }));
        }
      });
      return;
      
    // Endpoints de prueba de Envia.com eliminados - usando solo datos del Excel
      
    // Endpoint de prueba de Envia.com eliminado - usando solo datos del Excel
      
    } else if (pathname === '/api/users' && req.method === 'POST') {
      // Agregar usuario (solo admin)
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        authMiddleware(req, res, async () => {
          try {
            const userData = JSON.parse(body);
            const result = await addUser(userData, req.user);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (error) {
            console.error('Add user error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Error interno del servidor' }));
          }
        });
      });
      return;
      
    } else if (pathname.startsWith('/api/users/') && req.method === 'DELETE') {
      // Eliminar usuario (solo admin)
      const userId = parseInt(pathname.split('/')[3]);
      authMiddleware(req, res, async () => {
        const result = await deleteUser(userId, req.user);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      });
      return;
      
    // === RUTAS PROTEGIDAS ===
    } else if (pathname === '/') {
      // Página principal (protegida)
      webAuthMiddleware(req, res, () => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getHTML());
      });
      return;
      
    } else if (pathname === '/api/dashboard-public') {
      // TEMPORAL: Dashboard público para pruebas (sin autenticación)
      try {
        console.log('🧪 Public dashboard test - getting shipping costs data...');
        const result = await handleDashboard(query);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error('Public Dashboard API error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Error obteniendo datos del dashboard público',
          details: error.message 
        }));
      }
      return;
      
    } else if (pathname === '/api/dashboard') {
      // API Dashboard (protegida)
      authMiddleware(req, res, async () => {
        const result = await handleDashboard(query);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      });
      return;
      
    } else if (pathname === '/api/analytics') {
      // API Google Analytics 4 (protegida)
      authMiddleware(req, res, async () => {
        try {
          const dateRange = parseInt(query.days) || 7;
          console.log(`🔍 Obteniendo datos GA4 para ${dateRange} días...`);
          
          const ga4Data = await getGA4Insights(dateRange);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            data: ga4Data,
            message: `Datos GA4 obtenidos para los últimos ${dateRange} días`
          }));
        } catch (error) {
          console.error('❌ Error GA4 API:', error.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: error.message,
            data: {
              users: { totalUsers: 0, newUsers: 0, returningUsers: 0, error: 'GA4 no disponible' },
              pages: [],
              demographics: { countries: [], cities: [], devices: [] },
              traffic: []
            }
          }));
        }
      });
      return;
      
    } else if (pathname === '/api/google-ads') {
      // API Google Ads (protegida)
      authMiddleware(req, res, async () => {
        try {
          const dateRange = parseInt(query.days) || 30;
          console.log(`🔍 Obteniendo datos Google Ads para ${dateRange} días...`);
          
          const googleAdsData = await getGoogleAdsInsights(dateRange);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            data: googleAdsData,
            message: `Datos Google Ads obtenidos para los últimos ${dateRange} días`
          }));
        } catch (error) {
          console.error('❌ Error Google Ads API:', error.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: error.message,
            data: {
              account: { error: 'Google Ads no disponible' },
              campaigns: [],
              metrics: { error: 'Google Ads no disponible' }
            }
          }));
        }
      });
      return;
      
    } else if (pathname === '/api/meta-ads') {
      // API Meta Ads (protegida)
      authMiddleware(req, res, async () => {
        try {
          const dateRange = parseInt(query.days) || 30;
          console.log(`🔍 Obteniendo datos Meta Ads para ${dateRange} días...`);
          
          const metaAdsData = await getMetaAdsInsights(dateRange);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            data: metaAdsData,
            message: `Datos Meta Ads obtenidos para los últimos ${dateRange} días`
          }));
        } catch (error) {
          console.error('❌ Error Meta Ads API:', error.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: error.message,
            data: {
              account: { error: 'Meta Ads no disponible' },
              campaigns: [],
              insights: {
                totalSpend: 0,
                totalImpressions: 0,
                totalClicks: 0,
                ctr: 0,
                cpm: 0,
                cpc: 0,
                conversions: 0
              },
              campaignInsights: [],
              summary: {
                totalSpend: 0,
                totalImpressions: 0,
                totalClicks: 0,
                avgCTR: 0,
                avgCPM: 0,
                avgCPC: 0,
                totalConversions: 0,
                activeCampaigns: 0,
                totalCampaigns: 0
              }
            }
          }));
        }
      });
      return;
      
    } else if (pathname === '/api/meta-organic') {
      // API Meta Organic - Facebook Pages + Instagram Business (protegida)
      authMiddleware(req, res, async () => {
        try {
          const dateRange = parseInt(query.days) || 30;
          console.log(`🔍 Obteniendo datos Meta Organic para ${dateRange} días...`);
          
          const metaOrganicData = await getMetaOrganicInsights(dateRange);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            data: metaOrganicData,
            message: `Datos Meta Organic obtenidos para los últimos ${dateRange} días`
          }));
        } catch (error) {
          console.error('❌ Error Meta Organic API:', error.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: error.message,
            data: {
              facebook: { pageInfo: { error: 'Facebook no disponible' }, insights: {}, posts: [] },
              instagram: { accountInfo: { error: 'Instagram no disponible' }, insights: {}, posts: [], stories: [] },
              combined: { totalFollowers: 0, totalImpressions: 0, totalReach: 0, totalEngagement: 0 },
              topPosts: [],
              summary: {
                totalFollowers: 0,
                totalImpressions: 0,
                totalReach: 0,
                totalEngagement: 0,
                engagementRate: 0,
                facebookPosts: 0,
                instagramPosts: 0,
                instagramStories: 0
              }
            }
          }));
        }
      });
      return;
      
    } else if (pathname === '/api/google-ads-auth-url') {
      // TEMPORAL: Generar URL de autorización para Google Ads OAuth
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const { google } = require('googleapis');
      
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_ADS_CLIENT_ID,
        process.env.GOOGLE_ADS_CLIENT_SECRET,
        'http://localhost:8080/oauth/callback'
      );
      
      const scopes = [
        'https://www.googleapis.com/auth/adwords'
      ];
      
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
      });
      
      res.end(JSON.stringify({
        success: true,
        auth_url: authUrl,
        service: 'Google Ads API',
        instructions: [
          '1. Abre esta URL en tu navegador',
          '2. Autoriza el acceso a Google Ads',
          '3. Serás redirigido a localhost:8080 con el código en la URL',
          '4. Copia el código del parámetro ?code= de la URL',
          '5. Usa el endpoint /api/google-ads-exchange-token para obtener el refresh token'
        ]
      }));
      return;
      
    } else if (pathname === '/api/google-ads-exchange-token' && req.method === 'POST') {
      // TEMPORAL: Intercambiar código por refresh token de Google Ads
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        try {
          const { code } = JSON.parse(body);
          const { google } = require('googleapis');
          
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_ADS_CLIENT_ID,
            process.env.GOOGLE_ADS_CLIENT_SECRET,
            'http://localhost:8080/oauth/callback'
          );
          
          const { tokens } = await oauth2Client.getToken(code);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            service: 'Google Ads API',
            tokens: tokens,
            refresh_token: tokens.refresh_token,
            instructions: [
              'Actualiza tu archivo .env con:',
              `GOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token}`,
              'Luego reinicia el servidor para aplicar cambios'
            ]
          }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: error.message
          }));
        }
      });
      return;
      
    } else if (pathname === '/api/chat' && req.method === 'POST') {
      // API Chat (protegida)
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        authMiddleware(req, res, async () => {
          try {
            const { message } = JSON.parse(body);
            const result = await handleChat(message);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (error) {
            console.error('Chat API error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Error procesando chat' }));
          }
        });
      });
      return;
      
    } else if (pathname === '/api/test-order-shipping-public') {
      // TEMPORAL: Versión pública para inspeccionar datos de orden (sin autenticación)
      try {
        const orderId = query.order_id || '13784';
        console.log(`🔍 Public test: Analyzing order ${orderId} shipping data...`);
        
        const orderData = await fetchWooCommerceData(`orders/${orderId}`);
        const enviaShippingCost = await getShippingCostByOrderReference(orderId);
        
        const shippingInfo = {
          order_id: orderData.id,
          total: orderData.total,
          shipping_total: orderData.shipping_total,
          shipping_tax: orderData.shipping_tax,
          shipping_lines: orderData.shipping_lines,
          coupons: orderData.coupon_lines,
          envia_shipping_cost: enviaShippingCost,
          comparison: {
            woocommerce_cost: parseFloat(orderData.shipping_total) || 0,
            envia_real_cost: enviaShippingCost.found ? parseFloat(enviaShippingCost.cost) || 0 : 0,
            difference: enviaShippingCost.found ? 
              (parseFloat(enviaShippingCost.cost) || 0) - (parseFloat(orderData.shipping_total) || 0) : null
          }
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(shippingInfo));
      } catch (error) {
        console.error('Public order shipping test error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Error obteniendo datos de orden',
          details: error.message 
        }));
      }
      return;
      
    } else if (pathname === '/api/test-order-shipping') {
      // TEMPORAL: Inspeccionar datos completos de orden para ver shipping
      authMiddleware(req, res, async () => {
        try {
          const orderId = query.order_id || '13784'; // Usar orden de ejemplo o la especificada
          const orderData = await fetchWooCommerceData(`orders/${orderId}`);
          
          // Extraer solo los campos relevantes de shipping
          const shippingInfo = {
            order_id: orderData.id,
            total: orderData.total,
            shipping_total: orderData.shipping_total,
            shipping_tax: orderData.shipping_tax,
            shipping_lines: orderData.shipping_lines,
            coupons: orderData.coupon_lines,
            meta_data: orderData.meta_data?.filter(meta => 
              meta.key?.toLowerCase().includes('shipping') || 
              meta.key?.toLowerCase().includes('tracking')
            )
          };
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, shipping_info: shippingInfo }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            error: 'Error obteniendo datos de envío',
            details: error.message 
          }));
        }
      });
      return;
      
    } else if (pathname === '/api/test-woo') {
      // Test WooCommerce connection (protegida)
      authMiddleware(req, res, async () => {
        try {
          const data = await fetchWooCommerceData('system_status');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, woocommerce_connected: true, data }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: false, 
            error: 'Error conectando con WooCommerce API',
            details: error.message 
          }));
        }
      });
      return;
      
    } else if (pathname === '/api/debug/products-raw') {
      // Debug: Ver productos sin filtros de estado para comparar con WooCommerce
      try {
        const startDate = new Date('2025-08-01T00:00:00Z').toISOString();
        const endDate = new Date('2025-08-31T23:59:59Z').toISOString();
        
        // Obtener TODAS las órdenes de agosto sin filtros
        const orders = await fetchWooCommerceData(
          'orders',
          `after=${startDate}&before=${endDate}&per_page=100&status=any`
        );
        
        const productStats = {};
        
        // Procesar line_items de TODAS las órdenes
        orders.forEach(order => {
          if (order.line_items && Array.isArray(order.line_items)) {
            order.line_items.forEach(item => {
              const productId = item.product_id;
              const productName = item.name;
              const quantity = parseInt(item.quantity);
              
              if (!productStats[productId]) {
                productStats[productId] = {
                  id: productId,
                  name: productName,
                  totalQuantity: 0,
                  orders: new Set(),
                  ordersByStatus: {}
                };
              }
              
              productStats[productId].totalQuantity += quantity;
              productStats[productId].orders.add(order.id);
              
              // Agrupar por estado de orden
              const status = order.status;
              if (!productStats[productId].ordersByStatus[status]) {
                productStats[productId].ordersByStatus[status] = 0;
              }
              productStats[productId].ordersByStatus[status] += quantity;
            });
          }
        });
        
        // Convertir a array y ordenar por cantidad total
        const result = Object.values(productStats)
          .map(product => ({
            id: product.id,
            name: product.name,
            totalQuantity: product.totalQuantity,
            ordersCount: product.orders.size,
            ordersByStatus: product.ordersByStatus
          }))
          .sort((a, b) => b.totalQuantity - a.totalQuantity);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          period: 'Agosto 2025',
          totalOrders: orders.length,
          orderStates: orders.reduce((acc, order) => {
            acc[order.status] = (acc[order.status] || 0) + 1;
            return acc;
          }, {}),
          topProducts: result.slice(0, 10)
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Error analizando productos sin filtros',
          details: error.message 
        }));
      }
      
    } else if (pathname === '/api/debug/payment-methods') {
      // Debug: Ver métodos de pago reales en las órdenes
      try {
        const orders = await fetchWooCommerceData('orders?per_page=100');
        
        // Recopilar todos los métodos de pago únicos
        const paymentMethods = new Map();
        
        orders.forEach(order => {
          const method = order.payment_method;
          const title = order.payment_method_title;
          const total = parseFloat(order.total);
          
          if (paymentMethods.has(method)) {
            const existing = paymentMethods.get(method);
            existing.count++;
            existing.totalSales += total;
            existing.orders.push({
              id: order.id,
              total: total,
              status: order.status,
              date: order.date_created
            });
          } else {
            paymentMethods.set(method, {
              method: method,
              title: title,
              count: 1,
              totalSales: total,
              orders: [{
                id: order.id,
                total: total,
                status: order.status,
                date: order.date_created
              }]
            });
          }
        });
        
        // Convertir Map a objeto para envío
        const result = Array.from(paymentMethods.values())
          .sort((a, b) => b.totalSales - a.totalSales);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          totalOrders: orders.length,
          paymentMethods: result 
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: 'Error analizando métodos de pago',
          details: error.message 
        }));
      }
      
    } else {
      // 404 Not Found
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Error interno del servidor' }));
  }
});

// Inicializar sistema de autenticación
const initializeServer = async () => {
  await initializeAuth();
  
  // Probar conexión PostgreSQL
  console.log('🔧 Probando conexión PostgreSQL...');
  const pgConnected = await testConnection();
  
  // Inicializar Google Analytics 4
  console.log('🔧 Inicializando Google Analytics 4...');
  let ga4Client = null;
  let ga4Connected = false;
  
  try {
    ga4Client = initializeGA4Client();
    console.log('🔍 GA4 Client Result:', ga4Client ? 'Inicializado' : 'NULL');
    
    if (ga4Client) {
      ga4Connected = await testGA4Connection();
    } else {
      console.log('❌ GA4: Cliente retornó NULL - revisar credenciales');
    }
  } catch (error) {
    console.error('❌ Error inicializando GA4:', error.message);
    console.error('❌ GA4 Error stack:', error.stack);
  }
  
  // Inicializar Google Ads
  console.log('🔧 Inicializando Google Ads...');
  let googleAdsClient = null;
  let googleAdsConnected = false;
  
  try {
    googleAdsClient = initializeGoogleAdsClient();
    console.log('🔍 Google Ads Client Result:', googleAdsClient ? 'Inicializado' : 'NULL');
    
    if (googleAdsClient) {
      googleAdsConnected = await testGoogleAdsConnection();
    } else {
      console.log('❌ Google Ads: Cliente retornó NULL - revisar credenciales');
    }
  } catch (error) {
    console.error('❌ Error inicializando Google Ads:', error.message);
    console.error('❌ Google Ads Error stack:', error.stack);
  }
  
  // Inicializar Meta Ads
  console.log('🔧 Inicializando Meta Ads...');
  let metaAdsClient = null;
  let metaAdsConnected = false;
  
  try {
    metaAdsClient = initializeMetaAdsClient();
    console.log('🔍 Meta Ads Client Result:', metaAdsClient ? 'Inicializado' : 'NULL');
    
    if (metaAdsClient) {
      const metaTest = await testMetaConnection();
      metaAdsConnected = metaTest.success;
      console.log('🔍 Meta Ads Test Result:', metaTest);
    } else {
      console.log('❌ Meta Ads: Cliente retornó NULL - revisar credenciales');
    }
  } catch (error) {
    console.error('❌ Error inicializando Meta Ads:', error.message);
    console.error('❌ Meta Ads Error stack:', error.stack);
  }
  
  // Inicializar Meta Organic (Facebook Pages + Instagram Business)
  console.log('🔧 Inicializando Meta Organic (Facebook Pages + Instagram Business)...');
  let metaOrganicConnected = false;
  
  try {
    const metaOrganicTest = await testMetaOrganicConnection();
    metaOrganicConnected = metaOrganicTest.success;
    console.log('🔍 Meta Organic Test Result:', metaOrganicTest);
    
    if (metaOrganicTest.success && metaOrganicTest.data) {
      console.log('📘 Facebook Page:', metaOrganicTest.data.facebook.name || 'N/A');
      console.log('📸 Instagram Account:', metaOrganicTest.data.instagram.username || 'N/A');
    }
  } catch (error) {
    console.error('❌ Error inicializando Meta Organic:', error.message);
    console.error('❌ Meta Organic Error stack:', error.stack);
  }
  
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Adaptoheal Analytics Dashboard iniciado en puerto ${PORT}`);
    console.log(`📊 Dashboard disponible en: http://localhost:${PORT}`);
    console.log(`🔐 Sistema de autenticación activado - Login: http://localhost:${PORT}/login`);
    console.log(`🤖 Chat IA habilitado con OpenAI GPT-4o-mini`);
    console.log(`🛒 Conectado a WooCommerce: ${WOOCOMMERCE_URL}`);
    console.log(`🗄️ PostgreSQL: ${pgConnected ? '✅ Conectado' : '❌ Desconectado'}`);
    console.log(`📊 Google Analytics 4: ${ga4Connected ? '✅ Conectado' : '❌ Desconectado'}`);
    console.log(`📢 Google Ads: ${googleAdsConnected ? '✅ Conectado' : '❌ Desconectado'}`);
    console.log(`📱 Meta Ads: ${metaAdsConnected ? '✅ Conectado' : '❌ Desconectado'}`);
    console.log(`📘 Meta Organic: ${metaOrganicConnected ? '✅ Conectado' : '❌ Desconectado'}`);
    console.log(`📝 Máximo usuarios permitidos: ${process.env.MAX_USERS || 5}`);
  });
};

// Inicializar servidor con autenticación
initializeServer().catch(console.error);