// Google Ads API Integration Module - OAuth Mode
const { google } = require('googleapis');
const https = require('https');

// Configuración de Google Ads OAuth
const GOOGLE_ADS_MANAGER_ACCOUNT_ID = '5755810076'; // Cuenta administrador con centro API
const GOOGLE_ADS_CUSTOMER_ID = GOOGLE_ADS_MANAGER_ACCOUNT_ID; // Temporalmente usar cuenta administradora para probar conexión
const GOOGLE_ADS_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const GOOGLE_ADS_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const GOOGLE_ADS_REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;
const GOOGLE_ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

let oauth2Client;

// Inicializar cliente OAuth2 para Google Ads
const initializeGoogleAdsClient = () => {
  try {
    console.log('🔧 Inicializando cliente Google Ads con OAuth...');
    console.log('🔍 Customer ID configurado:', GOOGLE_ADS_CUSTOMER_ID);
    console.log('🔑 Developer Token configurado:', GOOGLE_ADS_DEVELOPER_TOKEN ? `${GOOGLE_ADS_DEVELOPER_TOKEN.substring(0, 8)}...` : 'No configurado');
    
    // Verificar credenciales OAuth
    if (!GOOGLE_ADS_CLIENT_ID || !GOOGLE_ADS_CLIENT_SECRET || !GOOGLE_ADS_REFRESH_TOKEN || !GOOGLE_ADS_DEVELOPER_TOKEN) {
      console.log('❌ Google Ads: Credenciales OAuth incompletas');
      console.log('📋 Verificar: CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, DEVELOPER_TOKEN');
      return null;
    }

    // Configurar cliente OAuth2
    oauth2Client = new google.auth.OAuth2(
      GOOGLE_ADS_CLIENT_ID,
      GOOGLE_ADS_CLIENT_SECRET,
      'http://localhost:8080/oauth/callback'
    );

    // Configurar refresh token
    oauth2Client.setCredentials({
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN
    });

    console.log('✅ Google Ads: Cliente OAuth configurado correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error inicializando Google Ads OAuth:', error.message);
    return null;
  }
};

// Función auxiliar para hacer peticiones HTTP a Google Ads API
const makeGoogleAdsRequest = async (query, customerId = null) => {
  return new Promise((resolve, reject) => {
    try {
      // Obtener access token usando refresh token
      oauth2Client.getAccessToken((err, token) => {
        if (err) {
          console.error('❌ Error obteniendo access token:', err.message);
          reject(err);
          return;
        }

        // Google Ads API requiere Customer ID sin guiones
        // Si no se especifica customerId, usar la cuenta de Adaptoheal para leer datos
        const customerIdToUse = (customerId || GOOGLE_ADS_CUSTOMER_ID).toString().replace(/-/g, '');
        
        const options = {
          hostname: 'googleads.googleapis.com',
          port: 443,
          path: `/v12/customers:listAccessibleCustomers`,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'developer-token': GOOGLE_ADS_DEVELOPER_TOKEN,
            'login-customer-id': GOOGLE_ADS_MANAGER_ACCOUNT_ID
          }
        };

        console.log('📡 Google Ads: Enviando petición HTTP a API...');
        console.log('🔍 Manager Account ID (login):', GOOGLE_ADS_MANAGER_ACCOUNT_ID);
        console.log('🔍 Customer ID (datos):', customerIdToUse);
        console.log('🔍 Developer Token:', GOOGLE_ADS_DEVELOPER_TOKEN ? `${GOOGLE_ADS_DEVELOPER_TOKEN.substring(0, 8)}...` : 'No configurado');
        console.log('🔍 Access Token (primeros 20 chars):', token ? token.substring(0, 20) + '...' : 'No token');
        console.log('🔍 URL completa:', `https://googleads.googleapis.com${options.path}`);
        console.log('🔍 Headers completos:', JSON.stringify(options.headers, null, 2));

        const req = https.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              if (res.statusCode === 200) {
                // Google Ads API search devuelve un JSON único, no múltiples líneas
                const response = JSON.parse(data);
                console.log('✅ Google Ads: Respuesta exitosa recibida');
                resolve([response]); // Envolver en array para compatibilidad
              } else {
                const response = JSON.parse(data);
                console.error('❌ Google Ads API Error:', res.statusCode, response);
                reject(new Error(`Google Ads API Error: ${res.statusCode} - ${response.error?.message || 'Unknown error'}`));
              }
            } catch (parseError) {
              console.error('❌ Error parseando respuesta Google Ads:', parseError.message);
              console.error('❌ Status Code:', res.statusCode);
              console.error('❌ Raw response (first 500 chars):', data.substring(0, 500));
              reject(parseError);
            }
          });
        });

        req.on('error', (error) => {
          console.error('❌ Error en petición Google Ads:', error.message);
          reject(error);
        });

        req.end();
      });
    } catch (error) {
      reject(error);
    }
  });
};

// Función para obtener información básica de la cuenta
const getAccountInfo = async () => {
  console.log('🔍 Obteniendo información básica de la cuenta Google Ads...');
  
  if (!oauth2Client) {
    console.log('❌ Google Ads: Cliente OAuth no inicializado');
    return {
      error: 'Google Ads cliente OAuth no inicializado'
    };
  }

  try {
    const query = `
      SELECT customer.id FROM customer LIMIT 1
    `;

    const responses = await makeGoogleAdsRequest(query);
    
    if (responses && responses.length > 0 && responses[0].results) {
      const customer = responses[0].results[0]?.customer;
      
      return {
        success: true,
        account: {
          id: customer?.id || 'N/A',
          name: customer?.descriptive_name || 'N/A',
          currency: customer?.currency_code || 'N/A',
          timezone: customer?.time_zone || 'N/A',
          status: customer?.status || 'N/A'
        },
        source: 'google_ads_oauth'
      };
    } else {
      return {
        success: false,
        error: 'No se encontraron datos de cuenta',
        account: null
      };
    }
  } catch (error) {
    console.error('❌ Error obteniendo información de cuenta Google Ads:', error.message);
    return {
      success: false,
      error: error.message,
      account: null
    };
  }
};

// Función para obtener campañas básicas
const getCampaigns = async (limit = 10) => {
  console.log(`🔍 Obteniendo campañas Google Ads (${limit} máximo)...`);
  
  if (!oauth2Client) {
    console.log('❌ Google Ads: Cliente OAuth no disponible para campañas');
    return [];
  }

  try {
    const query = `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr
      FROM campaign
      WHERE segments.date DURING LAST_30_DAYS
      ORDER BY metrics.cost_micros DESC
      LIMIT ${limit}
    `;

    const responses = await makeGoogleAdsRequest(query);
    
    if (responses && responses.length > 0) {
      const campaigns = [];
      
      responses.forEach(response => {
        if (response.results) {
          response.results.forEach(result => {
            const campaign = result.campaign;
            const metrics = result.metrics;
            
            campaigns.push({
              id: campaign?.id || 'N/A',
              name: campaign?.name || 'Sin nombre',
              status: campaign?.status || 'UNKNOWN',
              type: campaign?.advertising_channel_type || 'UNKNOWN',
              impressions: parseInt(metrics?.impressions || '0'),
              clicks: parseInt(metrics?.clicks || '0'),
              cost: parseFloat((metrics?.cost_micros || '0') / 1000000).toFixed(2),
              ctr: parseFloat(metrics?.ctr || '0').toFixed(2)
            });
          });
        }
      });

      console.log(`📊 Google Ads: ${campaigns.length} campañas obtenidas`);
      return campaigns;
    } else {
      console.log('⚠️ No se encontraron campañas');
      return [];
    }
  } catch (error) {
    console.error('❌ Error obteniendo campañas Google Ads:', error.message);
    return [];
  }
};

// Función para obtener métricas básicas de cuenta
const getAccountMetrics = async (dateRange = 30) => {
  console.log(`🔍 Obteniendo métricas Google Ads para los últimos ${dateRange} días...`);
  
  if (!oauth2Client) {
    console.log('❌ Google Ads: Cliente OAuth no disponible para métricas');
    return {
      impressions: 0,
      clicks: 0,
      cost: 0,
      conversions: 0,
      error: 'Cliente no inicializado'
    };
  }

  try {
    const query = `
      SELECT 
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM customer
      WHERE segments.date DURING LAST_${dateRange}_DAYS
    `;

    const responses = await makeGoogleAdsRequest(query);
    
    if (responses && responses.length > 0 && responses[0].results) {
      const metrics = responses[0].results[0]?.metrics;
      
      return {
        success: true,
        impressions: parseInt(metrics?.impressions || '0'),
        clicks: parseInt(metrics?.clicks || '0'),
        cost: parseFloat((metrics?.cost_micros || '0') / 1000000).toFixed(2),
        conversions: parseFloat(metrics?.conversions || '0').toFixed(1),
        ctr: parseFloat(metrics?.ctr || '0').toFixed(2),
        avgCpc: parseFloat((metrics?.average_cpc || '0') / 1000000).toFixed(2),
        dateRange: dateRange,
        source: 'google_ads_oauth'
      };
    } else {
      return {
        success: false,
        impressions: 0,
        clicks: 0,
        cost: 0,
        conversions: 0,
        ctr: 0,
        avgCpc: 0,
        error: 'No se encontraron métricas'
      };
    }
  } catch (error) {
    console.error('❌ Error obteniendo métricas Google Ads:', error.message);
    return {
      success: false,
      impressions: 0,
      clicks: 0,
      cost: 0,
      conversions: 0,
      error: error.message
    };
  }
};

// Función para obtener todos los insights de Google Ads
const getGoogleAdsInsights = async (dateRange = 30) => {
  console.log(`🔍 Obteniendo insights Google Ads para los últimos ${dateRange} días...`);

  try {
    const [accountInfo, campaigns, metrics] = await Promise.all([
      getAccountInfo(),
      getCampaigns(10),
      getAccountMetrics(dateRange)
    ]);

    const insights = {
      account: accountInfo,
      campaigns: campaigns,
      metrics: metrics,
      dateRange: dateRange,
      generatedAt: new Date().toISOString(),
      authMethod: 'oauth'
    };

    console.log(`✅ Google Ads OAuth Insights obtenidos: ${campaigns.length} campañas, ${metrics.impressions} impresiones`);

    return insights;
  } catch (error) {
    console.error('❌ Error obteniendo insights Google Ads OAuth:', error.message);
    return {
      account: { error: error.message },
      campaigns: [],
      metrics: { error: error.message },
      error: error.message,
      authMethod: 'oauth'
    };
  }
};

// Función para probar la conexión Google Ads OAuth
const testGoogleAdsConnection = async () => {
  try {
    console.log('🔧 Google Ads OAuth: Probando conexión...');
    
    if (!oauth2Client) {
      console.log('❌ Google Ads OAuth: Cliente no inicializado durante test');
      return false;
    }

    console.log('✅ Google Ads OAuth: Cliente inicializado, probando consulta básica...');
    const testData = await getAccountInfo();
    console.log('📊 Google Ads OAuth Connection Test Result:', testData);
    
    const hasData = testData.success && !testData.error;
    console.log(`🎯 Google Ads OAuth Connection Status: ${hasData ? '✅ CONECTADO' : '❌ SIN DATOS'}`);
    
    return hasData;
  } catch (error) {
    console.error('❌ Google Ads OAuth Connection Test failed:', error.message);
    console.error('❌ Google Ads OAuth Error details:', error);
    return false;
  }
};

module.exports = {
  initializeGoogleAdsClient,
  getAccountInfo,
  getCampaigns,
  getAccountMetrics,
  getGoogleAdsInsights,
  testGoogleAdsConnection
};