const XLSX = require('xlsx');

// Función para procesar Excel y convertir a formato WooCommerce
const processExcelData = (filePath, month, year = 2025) => {
  try {
    console.log(`📊 Procesando Excel para: ${month} ${year}`);
    
    // Leer archivo Excel
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length <= 1) {
      return { orders: [], totalRecords: 0 };
    }
    
    const headers = jsonData[0];
    const orders = [];
    
    // Mapear índices de columnas importantes
    const indices = {
      name: headers.indexOf('Name'),
      email: headers.indexOf('Email'),
      financialStatus: headers.indexOf('Financial Status'),
      paidAt: headers.indexOf('Paid at'),
      fulfillmentStatus: headers.indexOf('Fulfillment Status'),
      fulfilledAt: headers.indexOf('Fulfilled at'),
      currency: headers.indexOf('Currency'),
      subtotal: headers.indexOf('Subtotal'),
      shipping: headers.indexOf('Shipping'),
      taxes: headers.indexOf('Taxes'),
      total: headers.indexOf('Total'),
      discountCode: headers.indexOf('Discount Code'),
      discountAmount: headers.indexOf('Discount Amount'),
      shippingMethod: headers.indexOf('Shipping Method'),
      createdAt: headers.indexOf('Created at'),
      lineitemName: headers.indexOf('Lineitem name'),
      lineitemPrice: headers.indexOf('Lineitem price'),
      lineitemQuantity: headers.indexOf('Lineitem quantity'),
      lineitemSku: headers.indexOf('Lineitem sku'),
      billingName: headers.indexOf('Billing Name'),
      shippingName: headers.indexOf('Shipping Name'),
      paymentMethod: headers.indexOf('Payment Method'),
      paymentReference: headers.indexOf('Payment Reference'),
      id: headers.indexOf('Id')
    };
    
    // Mapeo de meses
    const monthMap = {
      'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
      'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
      'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
    };
    
    const targetMonth = monthMap[month.toLowerCase()];
    
    console.log(`🔍 Buscando datos para mes ${targetMonth} del año ${year}...`);
    
    let processedOrders = new Map(); // Para agrupar por ID de orden
    let totalRecords = 0;
    
    // Procesar cada fila (omitir headers)
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      // Verificar que sea orden pagada
      if (row[indices.financialStatus] !== 'paid') continue;
      
      // Verificar fecha
      const createdAt = row[indices.createdAt];
      if (!createdAt) continue;
      
      const orderDate = new Date(createdAt);
      if (orderDate.getFullYear() !== year || (orderDate.getMonth() + 1) !== targetMonth) continue;
      
      totalRecords++;
      
      const orderId = row[indices.id] || `excel_${i}`;
      
      // Si es la primera vez que vemos esta orden, crear estructura base
      if (!processedOrders.has(orderId)) {
        processedOrders.set(orderId, {
          id: orderId,
          number: row[indices.name] || `#${orderId}`,
          status: row[indices.fulfillmentStatus] || 'completed',
          currency: row[indices.currency] || 'MXN',
          date_created: createdAt,
          date_paid: row[indices.paidAt] || createdAt,
          total: String(row[indices.total] || 0),
          subtotal: String(row[indices.subtotal] || 0),
          total_tax: String(row[indices.taxes] || 0),
          shipping_total: String(row[indices.shipping] || 0),
          discount_total: String(row[indices.discountAmount] || 0),
          
          // Información del cliente
          billing: {
            first_name: row[indices.billingName] || '',
            email: row[indices.email] || ''
          },
          
          shipping: {
            first_name: row[indices.shippingName] || row[indices.billingName] || ''
          },
          
          // Método de pago (mapear a formato WooCommerce)
          payment_method: mapPaymentMethod(row[indices.paymentMethod]),
          payment_method_title: row[indices.paymentMethod] || 'Unknown',
          
          // Cupones
          coupon_lines: [],
          
          // Items de la orden
          line_items: [],
          
          // Shipping lines
          shipping_lines: []
        });
        
        // Agregar cupón si existe
        if (row[indices.discountCode] && row[indices.discountAmount] > 0) {
          processedOrders.get(orderId).coupon_lines.push({
            code: row[indices.discountCode],
            discount: String(row[indices.discountAmount]),
            discount_tax: "0"
          });
        }
        
        // Agregar shipping si existe
        if (row[indices.shippingMethod] && row[indices.shipping] > 0) {
          processedOrders.get(orderId).shipping_lines.push({
            method_title: row[indices.shippingMethod],
            method_id: row[indices.shippingMethod].toLowerCase().replace(/\s+/g, '_'),
            total: String(row[indices.shipping])
          });
        }
      }
      
      // Agregar line item si existe
      if (row[indices.lineitemName] && row[indices.lineitemPrice] && row[indices.lineitemQuantity]) {
        processedOrders.get(orderId).line_items.push({
          name: row[indices.lineitemName],
          product_id: 0,
          variation_id: 0,
          quantity: row[indices.lineitemQuantity],
          tax_class: "",
          subtotal: String(row[indices.lineitemPrice] * row[indices.lineitemQuantity]),
          total: String(row[indices.lineitemPrice] * row[indices.lineitemQuantity]),
          price: row[indices.lineitemPrice],
          sku: row[indices.lineitemSku] || ''
        });
      }
    }
    
    const finalOrders = Array.from(processedOrders.values());
    
    console.log(`✅ Excel procesado: ${finalOrders.length} órdenes para ${month} ${year}`);
    console.log(`📊 Registros totales procesados: ${totalRecords}`);
    
    return {
      orders: finalOrders,
      totalRecords: totalRecords,
      month: month,
      year: year
    };
    
  } catch (error) {
    console.error('❌ Error procesando Excel:', error);
    return { orders: [], totalRecords: 0, error: error.message };
  }
};

// Función para mapear métodos de pago a formato WooCommerce
const mapPaymentMethod = (excelPaymentMethod) => {
  if (!excelPaymentMethod) return 'unknown';
  
  const method = excelPaymentMethod.toLowerCase();
  
  if (method.includes('stripe')) return 'stripe';
  if (method.includes('paypal')) return 'paypal';
  if (method.includes('card') || method.includes('credit')) return 'stripe';
  
  return 'other';
};

module.exports = {
  processExcelData
};
