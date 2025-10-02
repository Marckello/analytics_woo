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
    console.log(`🔍 Buscando orden ${orderId} en PostgreSQL tabla reporte_envios_sept25...`);
    
    // Consulta con mejor diagnóstico
    const query = `
      SELECT 
        tracking,
        tracking_number,
        status,
        name as carrier,
        service,
        created_at,
        shipped_at,
        -- Buscar costo en múltiples columnas posibles
        COALESCE(
          CAST(cost AS NUMERIC), 
          CAST(price AS NUMERIC), 
          CAST(total AS NUMERIC),
          CAST(amount AS NUMERIC),
          0  -- Cambio: 0 en lugar de 127 para debug
        ) as total_cost
      FROM reporte_envios_sept25 
      WHERE 
        CAST(tracking AS TEXT) = $1
        OR CAST(tracking_number AS TEXT) = $1
        OR tracking LIKE $2 
        OR tracking_number LIKE $2
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [orderId.toString(), `%${orderId}%`]);
    
    console.log(`🔍 PostgreSQL query result: ${result.rows.length} filas encontradas para orden ${orderId}`);
    
    if (result.rows.length > 0) {
      const shipment = result.rows[0];
      const calculatedCost = parseFloat(shipment.total_cost) || 0;
      
      console.log(`✅ PostgreSQL MATCH: Orden ${orderId}`);
      console.log(`   - tracking: "${shipment.tracking}"`); 
      console.log(`   - tracking_number: "${shipment.tracking_number}"`);
      console.log(`   - carrier: "${shipment.carrier}"`);
      console.log(`   - cost: $${calculatedCost}`);
      
      return {
        found: true,
        cost: calculatedCost,
        carrier: shipment.carrier || 'Unknown',
        service: shipment.service || 'Ground Standard',
        tracking_number: shipment.tracking_number,
        status: shipment.status || 'Shipped',
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
        AVG(COALESCE(cost, 0)) as avg_cost,
        SUM(COALESCE(cost, 0)) as total_cost,
        MIN(created_at) as first_shipment,
        MAX(created_at) as last_shipment
      FROM reporte_envios_sept25
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
        tracking,
        tracking_number,
        name as carrier,
        status_verbose,
        created_at,
        COALESCE(cost, 0) as total_cost
      FROM reporte_envios_sept25 
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
        CAST(tracking AS TEXT) as order_id,
        CAST(tracking_number AS TEXT) as tracking_number,
        name as carrier,
        service_verbose,
        status_verbose,
        COALESCE(
          CAST(cost AS NUMERIC), 
          CAST(price AS NUMERIC), 
          CAST(total AS NUMERIC),
          CAST(amount AS NUMERIC),
          127.0
        ) as total_cost,
        created_at
      FROM reporte_envios_sept25 
      WHERE 
        tracking = ANY($1::text[])
        OR tracking_number = ANY($1::text[])
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query, [orderIds.map(id => id.toString())]);
    
    // Crear mapa de resultados
    const costsMap = {};
    result.rows.forEach(row => {
      const orderId = row.order_id || row.tracking_number;
      if (orderId) {
        costsMap[orderId] = {
          cost: parseFloat(row.total_cost) || 127,
          carrier: row.carrier || 'Estafeta/DHL',
          service: row.service_verbose || 'Ground',
          status: row.status_verbose || 'Shipped',
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
    
    // DIAGNÓSTICO: Ver qué datos hay en la tabla
    const diagnosticQuery = `
      SELECT 
        tracking, 
        tracking_number, 
        name, 
        status,
        created_at,
        COUNT(*) OVER() as total_records
      FROM reporte_envios_sept25 
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    
    const diagnosticResult = await pool.query(diagnosticQuery);
    console.log('🔍 DIAGNÓSTICO PostgreSQL - Primeros 5 registros:');
    console.log('📊 Total registros en tabla:', diagnosticResult.rows[0]?.total_records || 0);
    
    diagnosticResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. tracking: "${row.tracking}", tracking_number: "${row.tracking_number}", name: "${row.name}"`);
    });
    
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