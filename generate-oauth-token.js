// Script para generar Refresh Token de Google Ads OAuth
require('dotenv').config();
const { OAuth2Client } = require('google-auth-library');
const http = require('http');
const url = require('url');
const open = require('open');

// Configuración OAuth (actualizaremos con tus credenciales)
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET || '';
const REDIRECT_URI = 'http://localhost:8080/oauth2callback';

async function generateRefreshToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log('❌ Necesitas configurar GOOGLE_ADS_CLIENT_ID y GOOGLE_ADS_CLIENT_SECRET');
    console.log('📋 Pasos:');
    console.log('1. Ve a: https://console.cloud.google.com/apis/credentials');
    console.log('2. Crea OAuth Client ID');
    console.log('3. Agrega las credenciales al .env');
    return;
  }

  console.log('🚀 Generando Refresh Token para Google Ads...');
  
  // Crear OAuth2 client
  const oauth2Client = new OAuth2Client(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  // URL de autorización
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/adwords'],
    prompt: 'consent'
  });

  console.log('🔗 Abre esta URL en tu navegador:');
  console.log(authUrl);
  console.log('');

  // Crear servidor temporal para recibir el código
  const server = http.createServer(async (req, res) => {
    const reqUrl = url.parse(req.url, true);
    
    if (reqUrl.pathname === '/oauth2callback') {
      const code = reqUrl.query.code;
      
      if (code) {
        try {
          // Intercambiar código por tokens
          const { tokens } = await oauth2Client.getToken(code);
          
          console.log('✅ ¡Refresh Token generado exitosamente!');
          console.log('🔑 Refresh Token:', tokens.refresh_token);
          console.log('');
          console.log('📝 Agrega esto a tu .env:');
          console.log(`GOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token}`);
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h2>✅ ¡Autorización Exitosa!</h2>
                <p>Refresh Token generado correctamente.</p>
                <p>Puedes cerrar esta ventana.</p>
              </body>
            </html>
          `);
          
          server.close();
        } catch (error) {
          console.error('❌ Error obteniendo tokens:', error.message);
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<h2>❌ Error en autorización</h2>');
          server.close();
        }
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h2>❌ Código de autorización no recibido</h2>');
      }
    }
  });

  server.listen(8080, () => {
    console.log('🌐 Servidor temporal iniciado en http://localhost:8080');
    console.log('⏳ Esperando autorización...');
    
    // Abrir navegador automáticamente
    try {
      open(authUrl);
    } catch (error) {
      console.log('💡 Copia la URL manualmente al navegador');
    }
  });
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  generateRefreshToken().catch(console.error);
}

module.exports = { generateRefreshToken };