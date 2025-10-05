// Script para explorar la tabla data_shopify
require('dotenv').config();

const { exploreShopifyTable, getShopifyData } = require('./database.js');

async function exploreShopify() {
  try {
    console.log('🛍️ EXPLORANDO TABLA DATA_SHOPIFY...\n');
    
    // Explorar estructura y datos básicos
    const exploration = await exploreShopifyTable();
    
    if (!exploration) {
      console.log('❌ No se pudo explorar la tabla data_shopify');
      return;
    }
    
    console.log('\n📊 RESUMEN:');
    console.log(`- Total registros: ${exploration.totalRecords.toLocaleString()}`);
    console.log(`- Columnas: ${exploration.structure.length}`);
    console.log(`- Fechas: ${exploration.dateRange.fecha_min} → ${exploration.dateRange.fecha_max}`);
    
    console.log('\n🔍 COLUMNAS DISPONIBLES:');
    exploration.structure.forEach(col => {
      console.log(`  📋 ${col.column_name.padEnd(25)} | ${col.data_type.padEnd(15)} | ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Probar obtener datos de una fecha específica
    console.log('\n🧪 PROBANDO OBTENER DATOS DE ENERO 2025...');
    const testData = await getShopifyData('2025-01-01', '2025-01-31');
    
    if (testData.length > 0) {
      console.log(`✅ Datos de prueba: ${testData.length} órdenes encontradas en enero 2025`);
      console.log('📄 Ejemplo de orden mapeada:');
      console.log(JSON.stringify(testData[0], null, 2));
    } else {
      console.log('⚠️ No se encontraron datos en enero 2025');
      
      // Probar con datos más recientes
      console.log('\n🧪 PROBANDO CON DATOS MÁS RECIENTES (JULIO 2025)...');
      const recentData = await getShopifyData('2025-07-01', '2025-07-31');
      
      if (recentData.length > 0) {
        console.log(`✅ Datos recientes: ${recentData.length} órdenes en julio 2025`);
        console.log('📄 Ejemplo de orden mapeada:');
        console.log(JSON.stringify(recentData[0], null, 2));
      } else {
        console.log('⚠️ No se encontraron datos en julio 2025 tampoco');
      }
    }
    
  } catch (error) {
    console.error('❌ Error explorando Shopify:', error.message);
  } finally {
    process.exit();
  }
}

// Ejecutar exploración
exploreShopify();