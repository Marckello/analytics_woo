// Intercambiar código OAuth por refresh token
require('dotenv').config();
const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:8080/oauth2callback';

// El código de autorización que recibiste
const AUTHORIZATION_CODE = '4/0AVGzR1B38wIpphKz21FpkSVEf_wObOk5R4IyoDBt6yV1wfMfd82sXBWsKK74Eh8KL4rq-Q';

async function exchangeToken() {
  console.log('🔄 Intercambiando código por refresh token...');
  
  const oauth2Client = new OAuth2Client(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  try {
    const { tokens } = await oauth2Client.getToken(AUTHORIZATION_CODE);
    
    console.log('✅ ¡Refresh Token generado exitosamente!');
    console.log('');
    console.log('🔑 NUEVO REFRESH TOKEN:');
    console.log(tokens.refresh_token);
    console.log('');
    console.log('📝 CONFIGURA ESTAS VARIABLES EN EASYPANEL:');
    console.log('=====================================');
    console.log('GOOGLE_ADS_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('GA4_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('');
    console.log('🎯 Este token funciona para AMBOS servicios:');
    console.log('   ✅ Google Ads API');
    console.log('   ✅ Google Analytics API');
    console.log('');
    console.log('🚀 Después de configurar en EasyPanel, haz Deploy');
    console.log('   y ambos servicios funcionarán en producción!');
    
  } catch (error) {
    console.error('❌ Error intercambiando token:', error.message);
  }
}

exchangeToken();