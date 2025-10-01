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

// Configuración - usando las mismas variables de entorno
const WOOCOMMERCE_URL = process.env.WOOCOMMERCE_URL || 'https://adaptohealmx.com';
const WOOCOMMERCE_CONSUMER_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY || '';
const WOOCOMMERCE_CONSUMER_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Función para autenticar con WooCommerce
const getWooCommerceAuth = () => {
  const credentials = Buffer.from(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`).toString('base64');
  return {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json'
  };
};

// Función para obtener datos de WooCommerce
const fetchWooCommerceData = async (endpoint, params = '') => {
  const apiUrl = `${WOOCOMMERCE_URL}/wp-json/wc/v3/${endpoint}${params ? `?${params}` : ''}`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: getWooCommerceAuth()
    });
    
    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.status}`);
    }
    
    return await response.json();
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
const handleDashboard = async (query) => {
  try {
    // NUEVO: Obtener período de los parámetros de query o fechas personalizadas
    const periodParam = query.period || 'august-september-2025';
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
      case 'september-2025':
        startDate = new Date('2025-09-01T00:00:00Z').toISOString();
        endDate = new Date('2025-09-30T23:59:59Z').toISOString();
        periodLabel = 'Septiembre 2025';
        break;
      case 'august-september-2025':
        startDate = new Date('2025-08-01T00:00:00Z').toISOString();
        endDate = new Date('2025-09-30T23:59:59Z').toISOString();
        periodLabel = 'Agosto - Septiembre 2025';
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
      default:
        startDate = new Date('2025-08-01T00:00:00Z').toISOString();
        endDate = new Date('2025-08-31T23:59:59Z').toISOString();
        periodLabel = 'Agosto 2025';
        break;
      }
    }
    
    // OBTENER TODAS LAS ÓRDENES y filtrar solo estados exitosos
    const allOrders = await fetchWooCommerceData(
      'orders', 
      `after=${startDate}&before=${endDate}&per_page=100`
    );
    
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

    return {
      success: true,
      data: {
        // MÉTRICAS PRINCIPALES TOTALES
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
    
    const augustSales = augustOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    const septemberSales = septemberOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    
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
    
    📈 COMPARATIVA:
    - Diferencia en ventas: ${septemberSales > augustSales ? '+' : ''}$${(septemberSales - augustSales).toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN (${((septemberSales - augustSales) / (augustSales || 1) * 100).toFixed(1)}%)
    - Diferencia en órdenes: ${septemberOrders.length - augustOrders.length} órdenes
    - Mes con mejor performance: ${septemberSales > augustSales ? 'Septiembre' : 'Agosto'} 2025
    
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
                            <p class="text-blue-100 mt-1">Datos en tiempo real | Análisis Inteligente</p>
                        </div>
                    </div>
                    
                    <!-- SELECTOR DE PERÍODO AVANZADO -->
                    <div class="flex items-center space-x-6">
                        <div class="flex items-center space-x-3">
                            <label class="text-white text-sm font-medium">Período:</label>
                            
                            <!-- Selector de períodos predefinidos -->
                            <select id="period-selector" onchange="changePeriod()" 
                                    class="bg-white text-gray-800 border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-gray-50 transition-all shadow-lg">
                                
                                <!-- Períodos Rápidos -->
                                <optgroup label="⚡ Períodos Rápidos" style="color: #1f2937; font-weight: bold;">
                                    <option value="today" style="color: #1f2937; background: white;">📅 Hoy</option>
                                    <option value="yesterday" style="color: #1f2937; background: white;">📅 Ayer</option>
                                    <option value="last-7-days" style="color: #1f2937; background: white;">📊 Últimos 7 días</option>
                                    <option value="last-30-days" style="color: #1f2937; background: white;">📈 Últimos 30 días</option>
                                </optgroup>
                                
                                <!-- Períodos Mensuales -->
                                <optgroup label="📆 Períodos Mensuales" style="color: #1f2937; font-weight: bold;">
                                    <option value="this-month" style="color: #1f2937; background: white;">📅 Este mes</option>
                                    <option value="last-month" style="color: #1f2937; background: white;">📅 Mes anterior</option>
                                </optgroup>
                                
                                <!-- Períodos Específicos de Adaptoheal -->
                                <optgroup label="🏥 Períodos Adaptoheal" style="color: #1f2937; font-weight: bold;">
                                    <option value="august-2025" style="color: #1f2937; background: white;">🎯 Agosto 2025</option>
                                    <option value="september-2025" style="color: #1f2937; background: white;">🎯 Septiembre 2025</option>
                                    <option value="august-september-2025" selected style="color: #1f2937; background: white;">📊 Agosto - Septiembre 2025</option>
                                </optgroup>
                                
                                <!-- Rango Personalizado -->
                                <optgroup label="🔧 Personalizado" style="color: #1f2937; font-weight: bold;">
                                    <option value="custom" style="color: #1f2937; background: white;">📅 Seleccionar fechas...</option>
                                </optgroup>
                            </select>
                        </div>
                        
                        <!-- Panel de fechas personalizado (oculto por defecto) -->
                        <div id="custom-date-panel" class="hidden flex items-center space-x-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/30">
                            <label class="text-white text-xs font-medium">Desde:</label>
                            <input type="date" id="start-date" class="bg-white text-gray-800 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
                            <label class="text-white text-xs font-medium">Hasta:</label>
                            <input type="date" id="end-date" class="bg-white text-gray-800 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
                            <button onclick="applyCustomDates()" class="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition-colors">
                                <i class="fas fa-check mr-1"></i>Aplicar
                            </button>
                            <button onclick="cancelCustomDates()" class="bg-gray-500 text-white px-2 py-1 rounded text-xs hover:bg-gray-600 transition-colors">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        
                        <div class="flex items-center space-x-4">
                            <div class="flex items-center space-x-2">
                                <div class="pulse-dot w-3 h-3 bg-green-400 rounded-full"></div>
                                <span class="text-white text-sm font-medium">En vivo</span>
                            </div>
                            
                            <!-- User Info and Logout -->
                            <div class="flex items-center space-x-3 border-l border-white/20 pl-4">
                                <div class="text-right">
                                    <p id="user-name" class="text-white text-sm font-medium">Usuario</p>
                                    <p class="text-blue-100 text-xs">Dashboard Adaptoheal</p>
                                </div>
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
                                <p class="text-sm font-medium text-gray-600 mb-1">Distribuidores</p>
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
                                <p class="text-sm font-medium text-gray-600 mb-1">Clientes Regulares</p>
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
                                            <p class="text-sm font-medium text-gray-600">Stripe (Tarjetas)</p>
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
                                            <p class="text-sm font-medium text-gray-600">PayPal</p>
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
                                            <p class="text-sm font-medium text-gray-600">Transferencia</p>
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
                                            <p class="text-sm font-medium text-gray-600">Completadas</p>
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
                                            <p class="text-sm font-medium text-gray-600">Entregadas</p>
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
                                            <p class="text-sm font-medium text-gray-600">En Proceso</p>
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
                                        <p id="products-period-label" class="text-sm text-gray-500">Más vendidos</p>
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
                <div class="flex items-center">
                    <i class="fas fa-exclamation-triangle text-red-600 mr-3"></i>
                    <div>
                        <h3 class="text-red-800 font-medium">Error de Conexión</h3>
                        <p class="text-red-600 text-sm mt-1">No se pudo conectar con la API de WooCommerce. Verifica la configuración.</p>
                    </div>
                </div>
            </div>
        </div>

        <script>
        // Variables globales
        let dashboardData = null;
        let activePeriod = 'august-september-2025';
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

        // Función para manejar cambio de período
        function changePeriod() {
          const selector = document.getElementById('period-selector');
          const selectedPeriod = selector.value;
          
          if (selectedPeriod === 'custom') {
            showCustomDatePanel();
          } else {
            hideCustomDatePanel();
            activePeriod = selectedPeriod;
            loadDashboard();
          }
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

        // Cargar dashboard
        async function loadDashboard() {
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

            const response = await fetch(\`/api/dashboard?\${queryParams.toString()}\`);
            const result = await response.json();

            if (!result.success) {
              throw new Error(result.error || 'Error desconocido');
            }

            dashboardData = result.data;
            updateDashboardUI();
            updatePeriodDisplay(result.debug?.periodInfo);
            updateStatusCounters(result.debug?.statusBreakdownAll || {});
            
            // Habilitar chat después de cargar datos
            enableChat();

          } catch (error) {
            console.error('Error loading dashboard:', error);
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('error').classList.remove('hidden');
            document.getElementById('dashboard').classList.add('hidden');
          }
        }

        // Actualizar UI del dashboard
        function updateDashboardUI() {
          if (!dashboardData) return;

          // KPIs principales
          document.getElementById('total-sales').textContent = formatCurrency(dashboardData.totalSales30Days);
          document.getElementById('avg-ticket').textContent = formatCurrency(dashboardData.avgTicket30Days);
          document.getElementById('orders-count').textContent = formatNumber(dashboardData.ordersCount30Days);

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
                <p class="text-sm font-bold text-yellow-700">\${product.quantity} ventas</p>
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
            case 'august-september-2025':
              periodLabel = 'Agosto - Septiembre 2025';
              break;
            case 'august-2025':
              periodLabel = 'Agosto 2025';
              break;
            case 'september-2025':
              periodLabel = 'Septiembre 2025';
              break;
            case 'previous-month':
              periodLabel = 'Mes Anterior';
              break;
            case 'current-month':
              periodLabel = 'Mes Actual';
              break;
            case 'last-7-days':
              periodLabel = 'Últimos 7 días';
              break;
            case 'last-30-days':
              periodLabel = 'Últimos 30 días';
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
            const response = await fetch('/api/chat', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ message })
            });
            
            const result = await response.json();
            
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

        // Inicializar dashboard al cargar la página
        window.addEventListener('DOMContentLoaded', async () => {
          // Primero verificar autenticación
          if (!checkAuthentication()) {
            return; // Ya redirigió al login
          }

          // Verificar token con el servidor
          const isValidToken = await verifyTokenWithServer();
          if (!isValidToken) {
            return; // Ya redirigió al login
          }

          // Token válido, cargar dashboard
          loadDashboard();
        });
        </script>
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
      
    } else if (pathname === '/api/dashboard') {
      // API Dashboard (protegida)
      authMiddleware(req, res, async () => {
        const result = await handleDashboard(query);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
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
  
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Adaptoheal Analytics Dashboard iniciado en puerto ${PORT}`);
    console.log(`📊 Dashboard disponible en: http://localhost:${PORT}`);
    console.log(`🔐 Sistema de autenticación activado - Login: http://localhost:${PORT}/login`);
    console.log(`🤖 Chat IA habilitado con OpenAI GPT-4o-mini`);
    console.log(`🛒 Conectado a WooCommerce: ${WOOCOMMERCE_URL}`);
    console.log(`📝 Máximo usuarios permitidos: ${process.env.MAX_USERS || 5}`);
  });
};

// Inicializar servidor con autenticación
initializeServer().catch(console.error);