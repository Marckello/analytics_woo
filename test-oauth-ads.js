// Test Google Ads con OAuth
require('dotenv').config();
const { GoogleAdsApi } = require('google-ads-api');

console.log('🎯 Test Google Ads con OAuth...');

// Verificar variables
console.log('🔍 Variables verificadas:');
console.log('- GOOGLE_ADS_CUSTOMER_ID:', process.env.GOOGLE_ADS_CUSTOMER_ID);
console.log('- GOOGLE_ADS_CLIENT_ID:', process.env.GOOGLE_ADS_CLIENT_ID ? 'Configurado ✅' : 'Faltante ❌');
console.log('- GOOGLE_ADS_CLIENT_SECRET:', process.env.GOOGLE_ADS_CLIENT_SECRET ? 'Configurado ✅' : 'Faltante ❌');
console.log('- GOOGLE_ADS_REFRESH_TOKEN:', process.env.GOOGLE_ADS_REFRESH_TOKEN ? 'Configurado ✅' : 'Faltante ❌');

try {
  // Crear cliente Google Ads con OAuth
  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || 'placeholder'
  });
  
  console.log('✅ Cliente Google Ads OAuth creado');
  
  // Crear customer
  const customer = client.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN
  });
  
  console.log('📊 Haciendo query de prueba...');
  
  // Query simple para probar acceso
  const query = `
    SELECT
      campaign.name,
      campaign.id,
      campaign.status
    FROM campaign
    LIMIT 3
  `;
  
  customer.query(query).then(response => {
    console.log('✅ ¡Google Ads OAuth funcionando perfectamente!');
    console.log('📊 Campañas encontradas:', response.length);
    
    if (response.length > 0) {
      console.log('🎯 Ejemplo de campaña:');
      console.log('- Nombre:', response[0].campaign.name);
      console.log('- ID:', response[0].campaign.id);
      console.log('- Estado:', response[0].campaign.status);
    }
  }).catch(error => {
    console.error('❌ Error en Google Ads OAuth:', error.message || error);
    console.error('❌ Error code:', error.code || 'Sin código');
    console.error('❌ Error completo:', error);
    
    if (error.message && error.message.includes('DEVELOPER_TOKEN')) {
      console.log('');
      console.log('🔍 DIAGNÓSTICO:');
      console.log('El error indica que necesitas un Developer Token válido.');
      console.log('Google Ads API requiere un Developer Token aprobado por Google.');
      console.log('');
      console.log('📋 SOLUCIONES:');
      console.log('1. Solicitar Developer Token en Google Ads API Center');
      console.log('2. Usar una cuenta de prueba/test de Google Ads');
      console.log('3. Verificar que la cuenta tenga permisos de API');
    } else {
      console.log('');
      console.log('🔍 DIAGNÓSTICO GENERAL:');
      console.log('1. ¿Google Ads API habilitada en Google Cloud?');
      console.log('2. ¿OAuth Client configurado correctamente?');
      console.log('3. ¿Customer ID es correcto?');
    }
  });

} catch (error) {
  console.error('❌ Error inicial:', error.message);
}