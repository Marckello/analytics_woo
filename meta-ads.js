// Meta (Facebook/Instagram) Ads Integration Module
const axios = require('axios');

// Configuración de Meta Ads
const META_BUSINESS_PORTFOLIO_ID = process.env.META_BUSINESS_PORTFOLIO_ID || '660847034322804';
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || '1191696211941702';
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_API_VERSION = 'v19.0'; // Última versión estable

// Base URL para Facebook Marketing API
const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// Inicializar cliente Meta Ads
const initializeMetaAdsClient = () => {
  try {
    console.log('🔧 Inicializando cliente Meta Ads...');
    console.log('💼 Business Portfolio ID:', META_BUSINESS_PORTFOLIO_ID);
    console.log('📊 Ad Account ID:', META_AD_ACCOUNT_ID);
    console.log('🔑 Access Token configurado:', META_ACCESS_TOKEN ? `${META_ACCESS_TOKEN.substring(0, 20)}...` : 'No configurado');
    
    // Verificar credenciales
    if (!META_ACCESS_TOKEN) {
      console.log('❌ Meta Ads: Access Token no configurado');
      return null;
    }

    console.log('✅ Meta Ads: Cliente configurado correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error inicializando Meta Ads:', error.message);
    return null;
  }
};

// Función para hacer peticiones a Meta API
const makeMetaAPIRequest = async (endpoint, params = {}) => {
  try {
    const url = `${META_API_BASE_URL}${endpoint}`;
    const response = await axios.get(url, {
      params: {
        access_token: META_ACCESS_TOKEN,
        ...params
      },
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error en Meta API:', error.response?.data || error.message);
    throw error;
  }
};

// Obtener información básica de la cuenta de anuncios
const getAdAccountInfo = async () => {
  console.log('🔍 Obteniendo información de la cuenta Meta Ads...');
  
  if (!META_ACCESS_TOKEN) {
    console.log('❌ Meta Ads: Access Token no configurado');
    return {
      error: 'Meta Ads Access Token no configurado'
    };
  }

  try {
    const accountId = `act_${META_AD_ACCOUNT_ID}`;
    const data = await makeMetaAPIRequest(`/${accountId}`, {
      fields: 'name,account_status,currency,timezone_name,spend_cap,amount_spent,balance,account_id'
    });

    console.log('✅ Meta Ads: Información de cuenta obtenida');
    return {
      success: true,
      account: {
        id: data.account_id,
        name: data.name,
        currency: data.currency,
        status: data.account_status,
        timezone: data.timezone_name,
        spendCap: data.spend_cap,
        amountSpent: data.amount_spent,
        balance: data.balance
      }
    };
  } catch (error) {
    console.error('❌ Error obteniendo info de cuenta Meta:', error.message);
    return {
      error: error.message,
      success: false
    };
  }
};

// Obtener campañas activas
const getCampaigns = async (dateRange = 7) => {
  console.log(`🔍 Obteniendo campañas Meta para los últimos ${dateRange} días...`);
  
  if (!META_ACCESS_TOKEN) {
    return [];
  }

  try {
    const accountId = `act_${META_AD_ACCOUNT_ID}`;
    const data = await makeMetaAPIRequest(`/${accountId}/campaigns`, {
      fields: 'id,name,status,objective,created_time,updated_time,daily_budget,lifetime_budget,budget_remaining',
      limit: 50
    });

    const campaigns = data.data || [];
    console.log(`✅ Meta Ads: ${campaigns.length} campañas obtenidas`);
    
    return campaigns.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      objective: campaign.objective,
      dailyBudget: campaign.daily_budget,
      lifetimeBudget: campaign.lifetime_budget,
      budgetRemaining: campaign.budget_remaining,
      createdTime: campaign.created_time,
      updatedTime: campaign.updated_time
    }));
  } catch (error) {
    console.error('❌ Error obteniendo campañas Meta:', error.message);
    return [];
  }
};

// Obtener métricas de rendimiento (insights)
const getAdInsights = async (dateRange = 7) => {
  console.log(`🔍 Obteniendo insights Meta para los últimos ${dateRange} días...`);
  
  if (!META_ACCESS_TOKEN) {
    return {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      ctr: 0,
      cpm: 0,
      cpc: 0,
      conversions: 0
    };
  }

  try {
    // Calcular fechas
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - dateRange);

    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    console.log(`📊 Meta Ads: Consultando insights desde ${formattedStartDate} hasta ${formattedEndDate}`);

    const accountId = `act_${META_AD_ACCOUNT_ID}`;
    const data = await makeMetaAPIRequest(`/${accountId}/insights`, {
      fields: 'spend,impressions,clicks,ctr,cpm,cpc,conversions,reach,frequency,cost_per_conversion',
      time_range: JSON.stringify({
        since: formattedStartDate,
        until: formattedEndDate
      }),
      level: 'account',
      limit: 1000
    });

    const insights = data.data && data.data[0] ? data.data[0] : {};
    
    const result = {
      totalSpend: parseFloat(insights.spend) || 0,
      totalImpressions: parseInt(insights.impressions) || 0,
      totalClicks: parseInt(insights.clicks) || 0,
      ctr: parseFloat(insights.ctr) || 0,
      cpm: parseFloat(insights.cpm) || 0,
      cpc: parseFloat(insights.cpc) || 0,
      conversions: parseInt(insights.conversions) || 0,
      reach: parseInt(insights.reach) || 0,
      frequency: parseFloat(insights.frequency) || 0,
      costPerConversion: parseFloat(insights.cost_per_conversion) || 0
    };

    console.log('✅ Meta Ads: Insights obtenidos exitosamente');
    console.log('📊 Meta Ads:', JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error('❌ Error obteniendo insights Meta:', error.message);
    return {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      ctr: 0,
      cpm: 0,
      cpc: 0,
      conversions: 0,
      reach: 0,
      frequency: 0,
      costPerConversion: 0
    };
  }
};

// Obtener insights por campaña
const getCampaignInsights = async (dateRange = 7) => {
  console.log(`🔍 Obteniendo insights por campaña Meta para ${dateRange} días...`);
  
  if (!META_ACCESS_TOKEN) {
    return [];
  }

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - dateRange);

    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    const accountId = `act_${META_AD_ACCOUNT_ID}`;
    const data = await makeMetaAPIRequest(`/${accountId}/insights`, {
      fields: 'campaign_id,campaign_name,spend,impressions,clicks,ctr,cpm,cpc,conversions',
      time_range: JSON.stringify({
        since: formattedStartDate,
        until: formattedEndDate
      }),
      level: 'campaign',
      limit: 50
    });

    const campaigns = data.data || [];
    console.log(`✅ Meta Ads: ${campaigns.length} campañas con insights obtenidas`);
    
    return campaigns.map(campaign => ({
      id: campaign.campaign_id,
      name: campaign.campaign_name,
      spend: parseFloat(campaign.spend) || 0,
      impressions: parseInt(campaign.impressions) || 0,
      clicks: parseInt(campaign.clicks) || 0,
      ctr: parseFloat(campaign.ctr) || 0,
      cpm: parseFloat(campaign.cpm) || 0,
      cpc: parseFloat(campaign.cpc) || 0,
      conversions: parseInt(campaign.conversions) || 0
    }));
  } catch (error) {
    console.error('❌ Error obteniendo insights por campaña:', error.message);
    return [];
  }
};

// Función integrada para obtener todos los datos Meta
const getMetaAdsInsights = async (dateRange = 7) => {
  console.log(`🔍 getMetaAdsInsights: Iniciando análisis completo para ${dateRange} días...`);
  
  try {
    const [accountInfo, campaigns, insights, campaignInsights] = await Promise.all([
      getAdAccountInfo(),
      getCampaigns(dateRange),
      getAdInsights(dateRange),
      getCampaignInsights(dateRange)
    ]);

    const result = {
      account: accountInfo.account || accountInfo,
      campaigns: campaigns,
      insights: insights,
      campaignInsights: campaignInsights,
      summary: {
        totalSpend: insights.totalSpend,
        totalImpressions: insights.totalImpressions,
        totalClicks: insights.totalClicks,
        avgCTR: insights.ctr,
        avgCPM: insights.cpm,
        avgCPC: insights.cpc,
        totalConversions: insights.conversions,
        activeCampaigns: campaigns.filter(c => c.status === 'ACTIVE').length,
        totalCampaigns: campaigns.length
      }
    };

    console.log('✅ Meta Ads Insights completados exitosamente');
    return result;
  } catch (error) {
    console.error('❌ Error obteniendo insights Meta Ads:', error);
    return {
      account: { error: 'Meta Ads no disponible' },
      campaigns: [],
      insights: {
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        ctr: 0,
        cpm: 0,
        cpc: 0,
        conversions: 0
      },
      campaignInsights: [],
      summary: {
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        avgCTR: 0,
        avgCPM: 0,
        avgCPC: 0,
        totalConversions: 0,
        activeCampaigns: 0,
        totalCampaigns: 0
      }
    };
  }
};

// Función de prueba de conexión
const testMetaConnection = async () => {
  console.log('🧪 Probando conexión Meta Ads...');
  
  if (!META_ACCESS_TOKEN) {
    return { success: false, error: 'Access Token no configurado' };
  }

  try {
    const accountInfo = await getAdAccountInfo();
    console.log('✅ Prueba Meta Ads exitosa:', accountInfo);
    return { success: true, data: accountInfo };
  } catch (error) {
    console.error('❌ Error en prueba Meta Ads:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  initializeMetaAdsClient,
  getAdAccountInfo,
  getCampaigns,
  getAdInsights,
  getCampaignInsights,
  getMetaAdsInsights,
  testMetaConnection
};