// Google Analytics 4 Data API Integration Module - OAuth Implementation
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

// Configuración de GA4
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '3231674558';
const GA4_CLIENT_ID = process.env.GA4_CLIENT_ID;
const GA4_CLIENT_SECRET = process.env.GA4_CLIENT_SECRET;
const GA4_REFRESH_TOKEN = process.env.GA4_REFRESH_TOKEN;

let analyticsDataClient;

// Inicializar cliente GA4 con OAuth
const initializeGA4Client = () => {
  try {
    console.log('🔧 Inicializando cliente GA4 con OAuth...');
    console.log('🔍 Property ID configurado:', GA4_PROPERTY_ID);
    
    // Verificar credenciales OAuth
    if (!GA4_CLIENT_ID || !GA4_CLIENT_SECRET || !GA4_REFRESH_TOKEN) {
      console.log('❌ GA4 OAuth: Credenciales incompletas');
      console.log('🔍 Client ID:', GA4_CLIENT_ID ? `${GA4_CLIENT_ID.substring(0, 20)}...` : 'No configurado');
      console.log('🔍 Client Secret:', GA4_CLIENT_SECRET ? 'Configurado' : 'No configurado');
      console.log('🔍 Refresh Token:', GA4_REFRESH_TOKEN ? 'Configurado' : 'No configurado');
      return null;
    }

    console.log('✅ GA4 OAuth: Credenciales encontradas, configurando cliente...');
    
    // Configurar cliente OAuth
    analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: {
        client_id: GA4_CLIENT_ID,
        client_secret: GA4_CLIENT_SECRET,
        refresh_token: GA4_REFRESH_TOKEN,
        type: 'authorized_user'
      }
    });
    
    console.log('✅ Google Analytics 4 OAuth inicializado correctamente');
    return analyticsDataClient;
  } catch (error) {
    console.error('❌ Error inicializando GA4 OAuth:', error.message);
    return null;
  }
};

// Función para obtener usuarios totales y nuevos usuarios
const getUsersData = async (dateRange = 7) => {
  console.log(`🔍 getUsersData OAuth: Iniciando consulta para ${dateRange} días...`);
  
  if (!analyticsDataClient) {
    console.log('❌ GA4 OAuth: Cliente no inicializado - retornando datos vacíos');
    return {
      totalUsers: 0,
      newUsers: 0,
      returningUsers: 0,
      sessionsPerUser: '0.00',
      avgSessionDuration: '00:00:00'
    };
  }

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - dateRange);

    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    console.log(`📊 GA4 OAuth: Consultando datos desde ${formattedStartDate} hasta ${formattedEndDate}`);

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{
        startDate: formattedStartDate,
        endDate: formattedEndDate
      }],
      metrics: [
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'averageSessionDuration' }
      ],
      dimensions: [{ name: 'date' }]
    });

    let totalUsers = 0;
    let newUsers = 0;
    let totalSessions = 0;
    let avgDuration = 0;

    if (response.rows && response.rows.length > 0) {
      response.rows.forEach(row => {
        totalUsers += parseInt(row.metricValues[0].value) || 0;
        newUsers += parseInt(row.metricValues[1].value) || 0;
        totalSessions += parseInt(row.metricValues[2].value) || 0;
        avgDuration += parseFloat(row.metricValues[3].value) || 0;
      });

      // Calcular promedios
      avgDuration = avgDuration / response.rows.length;
    }

    const returningUsers = Math.max(0, totalUsers - newUsers);
    const sessionsPerUser = totalUsers > 0 ? (totalSessions / totalUsers).toFixed(2) : '0.00';
    
    // Convertir duración promedio a formato HH:MM:SS
    const formatDuration = (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const result = {
      totalUsers,
      newUsers,
      returningUsers,
      sessionsPerUser,
      avgSessionDuration: formatDuration(avgDuration),
      totalSessions
    };

    console.log('✅ GA4 OAuth: Datos de usuarios obtenidos exitosamente');
    console.log('📊 GA4 OAuth:', JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error('❌ Error obteniendo datos de usuarios GA4 OAuth:', error);
    return {
      totalUsers: 0,
      newUsers: 0,
      returningUsers: 0,
      sessionsPerUser: '0.00',
      avgSessionDuration: '00:00:00'
    };
  }
};

// Función para obtener datos de tráfico (sources)
const getTrafficData = async (dateRange = 7) => {
  console.log(`🔍 getTrafficData OAuth: Iniciando consulta para ${dateRange} días...`);
  
  if (!analyticsDataClient) {
    console.log('❌ GA4 OAuth: Cliente no inicializado - retornando datos vacíos');
    return [];
  }

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - dateRange);

    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    console.log(`📊 GA4 OAuth: Consultando tráfico desde ${formattedStartDate} hasta ${formattedEndDate}`);

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{
        startDate: formattedStartDate,
        endDate: formattedEndDate
      }],
      metrics: [
        { name: 'sessions' },
        { name: 'users' }
      ],
      dimensions: [
        { name: 'sessionDefaultChannelGroup' },
        { name: 'sessionSource' }
      ],
      orderBys: [{
        metric: { metricName: 'sessions' },
        desc: true
      }],
      limit: 10
    });

    const trafficData = [];
    
    if (response.rows && response.rows.length > 0) {
      response.rows.forEach(row => {
        const channelGroup = row.dimensionValues[0].value;
        const source = row.dimensionValues[1].value;
        const sessions = parseInt(row.metricValues[0].value) || 0;
        const users = parseInt(row.metricValues[1].value) || 0;

        trafficData.push({
          channel: channelGroup,
          source: source,
          sessions: sessions,
          users: users
        });
      });
    }

    console.log('✅ GA4 OAuth: Datos de tráfico obtenidos exitosamente');
    console.log('📊 GA4 OAuth Tráfico:', JSON.stringify(trafficData.slice(0, 3), null, 2));
    
    return trafficData;
  } catch (error) {
    console.error('❌ Error obteniendo datos de tráfico GA4 OAuth:', error);
    return [];
  }
};

// Función para obtener páginas más visitadas
const getTopPages = async (dateRange = 7) => {
  console.log(`🔍 getTopPages OAuth: Iniciando consulta para ${dateRange} días...`);
  
  if (!analyticsDataClient) {
    console.log('❌ GA4 OAuth: Cliente no inicializado - retornando datos vacíos');
    return [];
  }

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - dateRange);

    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    console.log(`📊 GA4 OAuth: Consultando páginas desde ${formattedStartDate} hasta ${formattedEndDate}`);

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{
        startDate: formattedStartDate,
        endDate: formattedEndDate
      }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'sessions' }
      ],
      dimensions: [
        { name: 'pageTitle' },
        { name: 'pagePath' }
      ],
      orderBys: [{
        metric: { metricName: 'screenPageViews' },
        desc: true
      }],
      limit: 10
    });

    const pagesData = [];
    
    if (response.rows && response.rows.length > 0) {
      response.rows.forEach(row => {
        const title = row.dimensionValues[0].value;
        const path = row.dimensionValues[1].value;
        const pageViews = parseInt(row.metricValues[0].value) || 0;
        const sessions = parseInt(row.metricValues[1].value) || 0;

        pagesData.push({
          title: title,
          path: path,
          pageViews: pageViews,
          sessions: sessions
        });
      });
    }

    console.log('✅ GA4 OAuth: Páginas obtenidas exitosamente');
    return pagesData;
  } catch (error) {
    console.error('❌ Error obteniendo páginas GA4 OAuth:', error);
    return [];
  }
};

// Función para obtener datos demográficos
const getDemographicData = async (dateRange = 7) => {
  console.log(`🔍 getDemographicData OAuth: Iniciando consulta para ${dateRange} días...`);
  
  if (!analyticsDataClient) {
    console.log('❌ GA4 OAuth: Cliente no inicializado - retornando datos vacíos');
    return { countries: [], cities: [] };
  }

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - dateRange);

    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    console.log(`📊 GA4 OAuth: Consultando demografía desde ${formattedStartDate} hasta ${formattedEndDate}`);

    // Consulta para países
    const [countriesResponse] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{
        startDate: formattedStartDate,
        endDate: formattedEndDate
      }],
      metrics: [
        { name: 'activeUsers' }
      ],
      dimensions: [
        { name: 'country' }
      ],
      orderBys: [{
        metric: { metricName: 'activeUsers' },
        desc: true
      }],
      limit: 10
    });

    const countries = [];
    if (countriesResponse.rows && countriesResponse.rows.length > 0) {
      countriesResponse.rows.forEach(row => {
        const name = row.dimensionValues[0].value;
        const users = parseInt(row.metricValues[0].value) || 0;

        countries.push({
          name: name,
          users: users
        });
      });
    }

    console.log('✅ GA4 OAuth: Demografía obtenida exitosamente');
    return { 
      countries: countries,
      cities: [] // Simplificado por ahora
    };
  } catch (error) {
    console.error('❌ Error obteniendo demografía GA4 OAuth:', error);
    return { countries: [], cities: [] };
  }
};

// Función para obtener fuentes de tráfico (alias de getTrafficData)
const getTrafficSources = async (dateRange = 7) => {
  return await getTrafficData(dateRange);
};

// Función de insights integrados
const getGA4Insights = async (dateRange = 7) => {
  console.log(`🔍 getGA4Insights OAuth: Iniciando análisis completo para ${dateRange} días...`);
  
  try {
    const [usersData, trafficData, pagesData, demographicData] = await Promise.all([
      getUsersData(dateRange),
      getTrafficData(dateRange),
      getTopPages(dateRange),
      getDemographicData(dateRange)
    ]);

    const insights = {
      users: usersData,
      traffic: trafficData,
      pages: pagesData,
      demographics: demographicData,
      summary: {
        totalUsers: usersData.totalUsers,
        newUsersRate: usersData.totalUsers > 0 ? ((usersData.newUsers / usersData.totalUsers) * 100).toFixed(1) : '0.0',
        topTrafficSource: trafficData.length > 0 ? trafficData[0].source : 'No data',
        totalSessions: trafficData.reduce((sum, item) => sum + item.sessions, 0)
      }
    };

    console.log('✅ GA4 OAuth Insights completados exitosamente');
    return insights;
  } catch (error) {
    console.error('❌ Error obteniendo insights GA4 OAuth:', error);
    return {
      users: {
        totalUsers: 0,
        newUsers: 0,
        returningUsers: 0,
        sessionsPerUser: '0.00',
        avgSessionDuration: '00:00:00'
      },
      traffic: [],
      pages: [],
      demographics: { countries: [], cities: [] },
      summary: {
        totalUsers: 0,
        newUsersRate: '0.0',
        topTrafficSource: 'No data',
        totalSessions: 0
      }
    };
  }
};

// Función de prueba de conexión
const testGA4Connection = async () => {
  console.log('🧪 Probando conexión GA4 OAuth...');
  
  if (!analyticsDataClient) {
    return { success: false, error: 'Cliente no inicializado' };
  }

  try {
    const testData = await getUsersData(1);
    console.log('✅ Prueba GA4 OAuth exitosa:', testData);
    return { success: true, data: testData };
  } catch (error) {
    console.error('❌ Error en prueba GA4 OAuth:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  initializeGA4Client,
  getUsersData,
  getTrafficData,
  getTopPages,
  getDemographicData,
  getTrafficSources,
  getGA4Insights,
  testGA4Connection
};