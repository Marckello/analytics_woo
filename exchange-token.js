// Intercambiar código OAuth por Refresh Token
require('dotenv').config();
const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:8080/oauth2callback';

// Código de autorización que Marco obtuvo
const AUTHORIZATION_CODE = '4/0AVGzR1Abyq3kjuYRnJV2X1o9C0MYd_5dsK5rM7456DbY3atm3o7JWVeI-82fx3d8pQP1Sw';

async function exchangeToken() {
  try {
    console.log('🔄 Intercambiando código por Refresh Token...');
    
    // Crear OAuth2 client
    const oauth2Client = new OAuth2Client(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    // Intercambiar código por tokens
    const { tokens } = await oauth2Client.getToken(AUTHORIZATION_CODE);
    
    console.log('✅ ¡Tokens obtenidos exitosamente!');
    console.log('');
    console.log('🔑 Access Token:', tokens.access_token ? 'Obtenido ✅' : 'Faltante ❌');
    console.log('🔑 Refresh Token:', tokens.refresh_token ? 'Obtenido ✅' : 'Faltante ❌');
    console.log('');
    
    if (tokens.refresh_token) {
      console.log('📝 AGREGA ESTO AL ARCHIVO .env:');
      console.log(`GOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('');
      console.log('🎯 Refresh Token generado:');
      console.log(tokens.refresh_token);
    } else {
      console.log('❌ No se generó Refresh Token. Es posible que ya tengas uno o necesites forzar consent.');
    }
    
  } catch (error) {
    console.error('❌ Error intercambiando tokens:', error.message);
    console.error('Detalles:', error);
  }
}

// Ejecutar
exchangeToken();