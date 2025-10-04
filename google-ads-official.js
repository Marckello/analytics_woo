// Google Ads API Integration Module - Official Client Library
const { GoogleAdsApi } = require('google-ads-api');

// Configuración de Google Ads
const GOOGLE_ADS_MANAGER_ACCOUNT_ID = '5755810076'; // Cuenta administrador con centro API
const GOOGLE_ADS_CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID; // Cuenta de Adaptoheal para leer datos
const GOOGLE_ADS_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const GOOGLE_ADS_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const GOOGLE_ADS_REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;
const GOOGLE_ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

let googleAdsClient;

// Inicializar cliente oficial de Google Ads
const initializeGoogleAdsClient = () => {
  try {
    console.log('🔧 Inicializando cliente oficial Google Ads...');
    console.log('🔍 Manager Account ID:', GOOGLE_ADS_MANAGER_ACCOUNT_ID);
    console.log('🔍 Customer ID (Adaptoheal):', GOOGLE_ADS_CUSTOMER_ID);
    console.log('🔑 Developer Token configurado:', GOOGLE_ADS_DEVELOPER_TOKEN ? `${GOOGLE_ADS_DEVELOPER_TOKEN.substring(0, 8)}...` : 'No configurado');
    
    // Verificar credenciales
    if (!GOOGLE_ADS_CLIENT_ID || !GOOGLE_ADS_CLIENT_SECRET || !GOOGLE_ADS_REFRESH_TOKEN || !GOOGLE_ADS_DEVELOPER_TOKEN) {
      console.log('❌ Google Ads: Credenciales incompletas');
      return null;
    }

    // Configurar cliente oficial
    googleAdsClient = new GoogleAdsApi({
      client_id: GOOGLE_ADS_CLIENT_ID,
      client_secret: GOOGLE_ADS_CLIENT_SECRET,
      developer_token: GOOGLE_ADS_DEVELOPER_TOKEN
    });

    console.log('✅ Google Ads: Cliente oficial configurado correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error inicializando Google Ads oficial:', error.message);
    return null;
  }
};

// Función para obtener información básica de la cuenta
const getAccountInfo = async () => {
  console.log('🔍 Obteniendo información básica de la cuenta Google Ads...');
  
  if (!googleAdsClient) {
    console.log('❌ Google Ads: Cliente no inicializado');
    return {
      error: 'Google Ads cliente no inicializado'
    };
  }

  try {
    // Crear customer con refresh token
    const customer = googleAdsClient.Customer({
      customer_id: GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, ''),
      login_customer_id: GOOGLE_ADS_MANAGER_ACCOUNT_ID,
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN
    });

    console.log('🔍 Consultando información del customer...');

    // Consulta básica para información de la cuenta
    const query = `
      SELECT 
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone
      FROM customer
      LIMIT 1
    `;

    const response = await customer.query(query);
    
    if (response && response.length > 0) {
      const customerInfo = response[0].customer;
      
      return {
        success: true,
        account: {
          id: customerInfo.id || 'N/A',
          name: customerInfo.descriptive_name || 'N/A',
          currency: customerInfo.currency_code || 'N/A',
          timezone: customerInfo.time_zone || 'N/A'
        },
        source: 'google_ads_official'
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
    console.error('❌ Error details:', error);
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
  
  if (!googleAdsClient) {
    console.log('❌ Google Ads: Cliente no disponible para campañas');
    return [];
  }

  try {
    const customer = googleAdsClient.Customer({
      customer_id: GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, ''),
      login_customer_id: GOOGLE_ADS_MANAGER_ACCOUNT_ID,
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN
    });

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

    const response = await customer.query(query);
    
    const campaigns = response.map(row => ({
      id: row.campaign?.id || 'N/A',
      name: row.campaign?.name || 'Sin nombre',
      status: row.campaign?.status || 'UNKNOWN',
      type: row.campaign?.advertising_channel_type || 'UNKNOWN',
      impressions: parseInt(row.metrics?.impressions || '0'),
      clicks: parseInt(row.metrics?.clicks || '0'),
      cost: parseFloat((row.metrics?.cost_micros || '0') / 1000000).toFixed(2),
      ctr: parseFloat(row.metrics?.ctr || '0').toFixed(2)
    }));

    console.log(`📊 Google Ads: ${campaigns.length} campañas obtenidas`);
    return campaigns;
  } catch (error) {
    console.error('❌ Error obteniendo campañas Google Ads:', error.message);
    return [];
  }
};

// Función para obtener métricas básicas de cuenta
const getAccountMetrics = async (dateRange = 30) => {
  console.log(`🔍 Obteniendo métricas Google Ads para los últimos ${dateRange} días...`);
  
  if (!googleAdsClient) {
    console.log('❌ Google Ads: Cliente no disponible para métricas');
    return {
      impressions: 0,
      clicks: 0,
      cost: 0,
      conversions: 0,
      error: 'Cliente no inicializado'
    };
  }

  try {
    const customer = googleAdsClient.Customer({
      customer_id: GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, ''),
      login_customer_id: GOOGLE_ADS_MANAGER_ACCOUNT_ID,
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN
    });

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

    const response = await customer.query(query);
    
    if (response && response.length > 0) {
      const metrics = response[0].metrics;
      
      return {
        success: true,
        impressions: parseInt(metrics?.impressions || '0'),
        clicks: parseInt(metrics?.clicks || '0'),
        cost: parseFloat((metrics?.cost_micros || '0') / 1000000).toFixed(2),
        conversions: parseFloat(metrics?.conversions || '0').toFixed(1),
        ctr: parseFloat(metrics?.ctr || '0').toFixed(2),
        avgCpc: parseFloat((metrics?.average_cpc || '0') / 1000000).toFixed(2),
        dateRange: dateRange,
        source: 'google_ads_official'
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
  console.log(`🔍 Obteniendo insights Google Ads oficial para los últimos ${dateRange} días...`);

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
      authMethod: 'official_client'
    };

    console.log(`✅ Google Ads Official Insights obtenidos: ${campaigns.length} campañas, ${metrics.impressions} impresiones`);

    return insights;
  } catch (error) {
    console.error('❌ Error obteniendo insights Google Ads oficial:', error.message);
    return {
      account: { error: error.message },
      campaigns: [],
      metrics: { error: error.message },
      error: error.message,
      authMethod: 'official_client'
    };
  }
};

// Función para probar la conexión Google Ads
const testGoogleAdsConnection = async () => {
  try {
    console.log('🔧 Google Ads Official: Probando conexión...');
    
    if (!googleAdsClient) {
      console.log('❌ Google Ads Official: Cliente no inicializado durante test');
      return false;
    }

    console.log('✅ Google Ads Official: Cliente inicializado, probando consulta básica...');
    const testData = await getAccountInfo();
    console.log('📊 Google Ads Official Connection Test Result:', testData);
    
    const hasData = testData.success && !testData.error;
    console.log(`🎯 Google Ads Official Connection Status: ${hasData ? '✅ CONECTADO' : '❌ SIN DATOS'}`);
    
    return hasData;
  } catch (error) {
    console.error('❌ Google Ads Official Connection Test failed:', error.message);
    console.error('❌ Google Ads Official Error details:', error);
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