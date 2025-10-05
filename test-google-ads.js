// Test directo de Google Ads API
require('dotenv').config();

const { GoogleAdsApi } = require('google-ads-api');

console.log('🎯 Test directo Google Ads API...');

// Verificar variables de entorno
console.log('🔍 Variables verificadas:');
console.log('- GOOGLE_ADS_CUSTOMER_ID:', process.env.GOOGLE_ADS_CUSTOMER_ID);
console.log('- GOOGLE_APPLICATION_CREDENTIALS_JSON existe:', !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

try {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  console.log('✅ Credenciales parseadas:');
  console.log('- Project ID:', credentials.project_id);
  console.log('- Client Email:', credentials.client_email);
  
  // Crear cliente Google Ads
  const client = new GoogleAdsApi({
    client_id: 'placeholder',
    client_secret: 'placeholder', 
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || 'placeholder',
    refresh_token: 'placeholder',
    service_account_credentials: credentials
  });
  
  console.log('✅ Cliente Google Ads creado');
  
  // Crear customer
  const customer = client.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
    refresh_token: 'placeholder'
  });
  
  console.log('📊 Haciendo query de prueba...');
  
  // Query simple para probar acceso
  const query = `
    SELECT
      campaign.name,
      campaign.id,
      campaign.status
    FROM campaign
    LIMIT 1
  `;
  
  customer.query(query).then(response => {
    console.log('✅ ¡Google Ads API funcionando!');
    console.log('📊 Respuesta:', response);
  }).catch(error => {
    console.error('❌ Error en Google Ads API:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error details:', error.details);
    
    console.log('\n🔍 DIAGNÓSTICO GOOGLE ADS:');
    console.log('1. ¿Google Ads API habilitada en Google Cloud?');
    console.log('2. ¿Service Account tiene acceso a Google Ads?');
    console.log('3. ¿Customer ID es correcto?');
    console.log('4. ¿Developer Token configurado?');
  });

} catch (error) {
  console.error('❌ Error inicial:', error.message);
}