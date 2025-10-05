// Test directo de Google Analytics 4
require('dotenv').config();
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

async function testGA4Direct() {
  try {
    console.log('🔧 Test directo GA4...');
    
    // Verificar variables de entorno
    console.log('🔍 Variables verificadas:');
    console.log('- GA4_PROPERTY_ID:', process.env.GA4_PROPERTY_ID);
    console.log('- GOOGLE_APPLICATION_CREDENTIALS_JSON existe:', !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    
    // Parsear credenciales
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    console.log('✅ Credenciales parseadas:');
    console.log('- Project ID:', credentials.project_id);
    console.log('- Client Email:', credentials.client_email);
    
    // Crear cliente
    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: credentials,
      projectId: credentials.project_id
    });
    
    console.log('✅ Cliente GA4 creado');
    
    // Test simple query
    console.log('📊 Haciendo query de prueba...');
    
    const [response] = await analyticsDataClient.runReport({
      property: `properties/3231674558`,
      dateRanges: [
        {
          startDate: '7daysAgo',
          endDate: 'today',
        },
      ],
      metrics: [
        { name: 'totalUsers' },
      ],
    });
    
    console.log('✅ Query exitosa!');
    console.log('📊 Response:', JSON.stringify(response, null, 2));
    
  } catch (error) {
    console.error('❌ Error en test GA4:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error details:', error.details);
    
    // Información adicional sobre el error
    if (error.message.includes('PERMISSION_DENIED')) {
      console.log('\n🔍 DIAGNÓSTICO PERMISSION_DENIED:');
      console.log('1. ¿Analytics Data API habilitada? (Acabas de hacerlo - puede tardar)');
      console.log('2. ¿Service Account tiene acceso al Property?');
      console.log('3. ¿Property ID es correcto?');
    }
  }
}

testGA4Direct();