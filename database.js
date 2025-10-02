// PostgreSQL Database Connection Module
const { Pool } = require('pg');

// Configuración de conexión
const pool = new Pool({
  host: process.env.DB_HOST || 'dashboard_adapto_woo_docs_adapto',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'dashboard_adapto_woo',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'da66fed39b7eba8b8515',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Función para obtener datos de envíos por order_id
const getShippingDataByOrderId = async (orderId) => {
  try {
    console.log(`🔍 Buscando orden ${orderId} en PostgreSQL tablas agosto y septiembre...`);
    
    // BUSCAR EN AMBAS TABLAS: Agosto y Septiembre
    const query = `
      SELECT 
        order_number,
        tracking_number,
        status,
        name as carrier,
        service,
        created_at,
        shipped_at,
        delivered_at,
        CAST(total AS NUMERIC) as total_cost,
        'septiembre' as table_source
      FROM reporte_envios_sept25 
      WHERE CAST(order_number AS TEXT) = $1
      
      UNION ALL
      
      SELECT 
        order_number,
        tracking_number,
        status,
        name as carrier,
        service,
        created_at,
        shipped_at,
        delivered_at,
        CAST(total AS NUMERIC) as total_cost,
        'agosto' as table_source
      FROM reporte_envios_ago25 
      WHERE CAST(order_number AS TEXT) = $1
      
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [orderId.toString()]);
    
    console.log(`🔍 PostgreSQL query result: ${result.rows.length} filas encontradas para orden ${orderId}`);
    
    if (result.rows.length > 0) {
      const shipment = result.rows[0];
      const calculatedCost = parseFloat(shipment.total_cost) || 0;
      
      console.log(`✅ PostgreSQL MATCH: Orden ${orderId} (${shipment.table_source})`);
      console.log(`   - order_number: "${shipment.order_number}"`);
      console.log(`   - tracking_number: "${shipment.tracking_number}"`);
      console.log(`   - carrier: "${shipment.carrier}"`);
      console.log(`   - service: "${shipment.service}"`);
      console.log(`   - cost: $${calculatedCost}`);
      
      return {
        found: true,
        cost: calculatedCost,
        carrier: shipment.carrier || 'Estafeta/DHL',
        service: shipment.service || 'Ground',
        tracking_number: shipment.tracking_number,
        status: shipment.status || 'Delivered',
        order_number: shipment.order_number,
        created_at: shipment.created_at,
        shipped_at: shipment.shipped_at,
        source: 'postgresql_database'
      };
    }
    
    console.log(`❌ PostgreSQL NO MATCH: Orden ${orderId} no encontrada`);
    return { 
      found: false, 
      cost: 0, 
      message: `Orden ${orderId} no encontrada en PostgreSQL`, 
      source: 'not_in_database' 
    };
    
  } catch (error) {
    console.error(`❌ Error PostgreSQL buscando orden ${orderId}:`, error.message);
    return { 
      found: false, 
      cost: 0, 
      error: error.message, 
      source: 'database_error' 
    };
  }
};

// Función para obtener estadísticas de envíos
const getShippingStats = async () => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_shipments,
        COUNT(DISTINCT name) as carriers_count,
        AVG(CAST(total AS NUMERIC)) as avg_cost,
        SUM(CAST(total AS NUMERIC)) as total_cost,
        MIN(created_at) as first_shipment,
        MAX(created_at) as last_shipment
      FROM (
        SELECT name, total, created_at FROM reporte_envios_sept25
        UNION ALL
        SELECT name, total, created_at FROM reporte_envios_ago25
      ) combined_tables
    `;
    
    const result = await pool.query(query);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting shipping stats:', error);
    return null;
  }
};

// Función para listar todos los envíos (para debug)
const getAllShipments = async (limit = 10) => {
  try {
    const query = `
      SELECT 
        order_number,
        tracking_number,
        name as carrier,
        status,
        created_at,
        CAST(total AS NUMERIC) as total_cost,
        'septiembre' as table_source
      FROM reporte_envios_sept25 
      
      UNION ALL
      
      SELECT 
        order_number,
        tracking_number,
        name as carrier,
        status,
        created_at,
        CAST(total AS NUMERIC) as total_cost,
        'agosto' as table_source
      FROM reporte_envios_ago25 
      
      ORDER BY created_at DESC 
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows;
  } catch (error) {
    console.error('Error getting all shipments:', error);
    return [];
  }
};

// Función para obtener múltiples costos de envío por lista de órdenes
const getBulkShippingCosts = async (orderIds) => {
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return {};
  }

  try {
    // Crear placeholders para la consulta IN
    const placeholders = orderIds.map((_, index) => `$${index + 1}`).join(',');
    
    const query = `
      SELECT 
        CAST(order_number AS TEXT) as order_id,
        CAST(tracking_number AS TEXT) as tracking_number,
        name as carrier,
        service,
        status,
        CAST(total AS NUMERIC) as total_cost,
        created_at,
        'septiembre' as table_source
      FROM reporte_envios_sept25 
      WHERE order_number = ANY($1::text[])
      
      UNION ALL
      
      SELECT 
        CAST(order_number AS TEXT) as order_id,
        CAST(tracking_number AS TEXT) as tracking_number,
        name as carrier,
        service,
        status,
        CAST(total AS NUMERIC) as total_cost,
        created_at,
        'agosto' as table_source
      FROM reporte_envios_ago25 
      WHERE order_number = ANY($1::text[])
      
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query, [orderIds.map(id => id.toString())]);
    
    // Crear mapa de resultados
    const costsMap = {};
    result.rows.forEach(row => {
      const orderId = row.order_id;
      if (orderId) {
        costsMap[orderId] = {
          cost: parseFloat(row.total_cost) || 127,
          carrier: row.carrier || 'Estafeta/DHL',
          service: row.service || 'Ground',
          status: row.status || 'Shipped',
          tracking_number: row.tracking_number,
          source: 'postgresql_bulk'
        };
      }
    });
    
    console.log(`📊 PostgreSQL bulk query: ${result.rows.length} envíos encontrados de ${orderIds.length} órdenes`);
    return costsMap;
    
  } catch (error) {
    console.error('❌ Error en consulta bulk PostgreSQL:', error.message);
    return {};
  }
};

// Función para probar la conexión y diagnosticar datos
const testConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ PostgreSQL connection successful:', result.rows[0]);
    
    // DIAGNÓSTICO: Ver datos de AMBAS tablas
    console.log('🔍 DIAGNÓSTICO PostgreSQL - Ambas tablas (Agosto + Septiembre):');
    
    // Contar registros en cada tabla
    const countSept = await pool.query('SELECT COUNT(*) as count FROM reporte_envios_sept25');
    const countAgo = await pool.query('SELECT COUNT(*) as count FROM reporte_envios_ago25');
    
    console.log(`📊 Septiembre: ${countSept.rows[0].count} registros`);
    console.log(`📊 Agosto: ${countAgo.rows[0].count} registros`);
    console.log(`📊 TOTAL: ${parseInt(countSept.rows[0].count) + parseInt(countAgo.rows[0].count)} registros`);
    
    // Mostrar muestras de septiembre
    const septQuery = `SELECT * FROM reporte_envios_sept25 ORDER BY created_at DESC LIMIT 2`;
    const septResult = await pool.query(septQuery);
    
    console.log('📋 MUESTRA SEPTIEMBRE:');
    if (septResult.rows.length > 0) {
      const columns = Object.keys(septResult.rows[0]);
      console.log(`🔍 Columnas Septiembre: ${columns.join(', ')}`);
    }
    
    // Mostrar muestras de agosto  
    const agoQuery = `SELECT * FROM reporte_envios_ago25 ORDER BY created_at DESC LIMIT 2`;
    const agoResult = await pool.query(agoQuery);
    
    console.log('📋 MUESTRA AGOSTO:');
    if (agoResult.rows.length > 0) {
      const columns = Object.keys(agoResult.rows[0]);
      console.log(`🔍 Columnas Agosto: ${columns.join(', ')}`);
    }
    
    // Usar septiembre para el diagnóstico detallado
    const diagnosticResult = septResult;
    
    console.log('📋 TODAS LAS COLUMNAS DISPONIBLES:');
    if (diagnosticResult.rows.length > 0) {
      const columns = Object.keys(diagnosticResult.rows[0]);
      console.log(`🔍 Columnas: ${columns.join(', ')}`);
      
      diagnosticResult.rows.forEach((row, index) => {
        console.log(`\n${index + 1}. REGISTRO COMPLETO:`);
        columns.forEach(col => {
          if (col !== 'COUNT') console.log(`   ${col}: "${row[col]}"`);
        });
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    return false;
  }
};

module.exports = {
  pool,
  getShippingDataByOrderId,
  getBulkShippingCosts,
  getShippingStats,
  getAllShipments,
  testConnection
};