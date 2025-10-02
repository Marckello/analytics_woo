// Google Analytics 4 Data API Integration Module
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

// Configuración de GA4
const GA4_PROPERTY_ID = '3231674558';

// Credenciales del Service Account (desde variables de entorno)
let analyticsDataClient;

// Inicializar cliente GA4
const initializeGA4Client = () => {
  try {
    // Verificar si las credenciales están configuradas
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      console.log('⚠️ GA4: Credenciales no configuradas - funcionalidad deshabilitada');
      return null;
    }

    // Parsear credenciales JSON desde variable de entorno
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    
    analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: credentials,
      projectId: credentials.project_id
    });
    
    console.log('✅ Google Analytics 4 inicializado correctamente');
    return analyticsDataClient;
  } catch (error) {
    console.error('❌ Error inicializando GA4:', error.message);
    return null;
  }
};

// Función para obtener usuarios totales y nuevos usuarios
const getUsersData = async (dateRange = 7) => {
  if (!analyticsDataClient) {
    console.log('⚠️ GA4 no disponible - retornando datos de prueba');
    return {
      totalUsers: 0,
      newUsers: 0,
      returningUsers: 0,
      error: 'GA4 no configurado'
    };
  }

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [
        {
          startDate: `${dateRange}daysAgo`,
          endDate: 'today',
        },
      ],
      metrics: [
        { name: 'totalUsers' },
        { name: 'newUsers' },
      ],
    });

    const totalUsers = response.rows?.[0]?.metricValues?.[0]?.value || 0;
    const newUsers = response.rows?.[0]?.metricValues?.[1]?.value || 0;
    const returningUsers = parseInt(totalUsers) - parseInt(newUsers);

    console.log(`📊 GA4 Users (${dateRange} días): Total=${totalUsers}, Nuevos=${newUsers}, Recurrentes=${returningUsers}`);

    return {
      totalUsers: parseInt(totalUsers),
      newUsers: parseInt(newUsers), 
      returningUsers: Math.max(0, returningUsers),
      dateRange: dateRange,
      source: 'google_analytics'
    };
  } catch (error) {
    console.error('❌ Error obteniendo datos de usuarios GA4:', error.message);
    return {
      totalUsers: 0,
      newUsers: 0,
      returningUsers: 0,
      error: error.message
    };
  }
};

// Función para obtener páginas más visitadas
const getTopPages = async (dateRange = 7, limit = 10) => {
  if (!analyticsDataClient) {
    console.log('⚠️ GA4 no disponible para páginas');
    return [];
  }

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [
        {
          startDate: `${dateRange}daysAgo`,
          endDate: 'today',
        },
      ],
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' },
      ],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
      ],
      orderBys: [
        {
          metric: { metricName: 'screenPageViews' },
          desc: true,
        },
      ],
      limit: limit,
    });

    const topPages = response.rows?.map(row => ({
      path: row.dimensionValues[0].value,
      title: row.dimensionValues[1].value,
      pageViews: parseInt(row.metricValues[0].value),
      avgSessionDuration: parseFloat(row.metricValues[1].value).toFixed(1)
    })) || [];

    console.log(`📄 GA4 Top ${limit} páginas (${dateRange} días):`, topPages.slice(0, 3));

    return topPages;
  } catch (error) {
    console.error('❌ Error obteniendo páginas más visitadas:', error.message);
    return [];
  }
};

// Función para obtener datos demográficos
const getDemographicData = async (dateRange = 7) => {
  if (!analyticsDataClient) {
    console.log('⚠️ GA4 no disponible para demografía');
    return { countries: [], cities: [], devices: [] };
  }

  try {
    // Obtener datos por país
    const [countryResponse] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [
        {
          startDate: `${dateRange}daysAgo`,
          endDate: 'today',
        },
      ],
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'totalUsers' }],
      orderBys: [
        {
          metric: { metricName: 'totalUsers' },
          desc: true,
        },
      ],
      limit: 10,
    });

    // Obtener datos por ciudad  
    const [cityResponse] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [
        {
          startDate: `${dateRange}daysAgo`,
          endDate: 'today',
        },
      ],
      dimensions: [{ name: 'city' }],
      metrics: [{ name: 'totalUsers' }],
      orderBys: [
        {
          metric: { metricName: 'totalUsers' },
          desc: true,
        },
      ],
      limit: 10,
    });

    // Obtener datos por dispositivo
    const [deviceResponse] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [
        {
          startDate: `${dateRange}daysAgo`,
          endDate: 'today',
        },
      ],
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'totalUsers' }],
      orderBys: [
        {
          metric: { metricName: 'totalUsers' },
          desc: true,
        },
      ],
    });

    const countries = countryResponse.rows?.map(row => ({
      name: row.dimensionValues[0].value,
      users: parseInt(row.metricValues[0].value)
    })) || [];

    const cities = cityResponse.rows?.map(row => ({
      name: row.dimensionValues[0].value,
      users: parseInt(row.metricValues[0].value)
    })) || [];

    const devices = deviceResponse.rows?.map(row => ({
      category: row.dimensionValues[0].value,
      users: parseInt(row.metricValues[0].value)
    })) || [];

    console.log(`🌍 GA4 Demografia (${dateRange} días): ${countries.length} países, ${cities.length} ciudades, ${devices.length} dispositivos`);

    return { countries, cities, devices };
  } catch (error) {
    console.error('❌ Error obteniendo datos demográficos:', error.message);
    return { countries: [], cities: [], devices: [] };
  }
};

// Función para obtener datos de tráfico por fuente
const getTrafficSources = async (dateRange = 7) => {
  if (!analyticsDataClient) {
    console.log('⚠️ GA4 no disponible para fuentes de tráfico');
    return [];
  }

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [
        {
          startDate: `${dateRange}daysAgo`,
          endDate: 'today',
        },
      ],
      dimensions: [
        { name: 'sessionDefaultChannelGrouping' },
        { name: 'sessionSource' },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
      ],
      orderBys: [
        {
          metric: { metricName: 'sessions' },
          desc: true,
        },
      ],
      limit: 10,
    });

    const trafficSources = response.rows?.map(row => ({
      channel: row.dimensionValues[0].value,
      source: row.dimensionValues[1].value,
      sessions: parseInt(row.metricValues[0].value),
      users: parseInt(row.metricValues[1].value)
    })) || [];

    console.log(`📊 GA4 Traffic Sources (${dateRange} días):`, trafficSources.slice(0, 3));

    return trafficSources;
  } catch (error) {
    console.error('❌ Error obteniendo fuentes de tráfico:', error.message);
    return [];
  }
};

// Función para obtener todos los insights de GA4
const getGA4Insights = async (dateRange = 7) => {
  console.log(`🔍 Obteniendo insights GA4 para los últimos ${dateRange} días...`);

  try {
    const [usersData, topPages, demographicData, trafficSources] = await Promise.all([
      getUsersData(dateRange),
      getTopPages(dateRange, 10),
      getDemographicData(dateRange),
      getTrafficSources(dateRange)
    ]);

    const insights = {
      users: usersData,
      pages: topPages,
      demographics: demographicData,
      traffic: trafficSources,
      dateRange: dateRange,
      generatedAt: new Date().toISOString()
    };

    console.log(`✅ GA4 Insights obtenidos: ${usersData.totalUsers} usuarios, ${topPages.length} páginas, ${demographicData.countries.length} países`);

    return insights;
  } catch (error) {
    console.error('❌ Error obteniendo insights GA4:', error.message);
    return {
      users: { totalUsers: 0, newUsers: 0, returningUsers: 0, error: error.message },
      pages: [],
      demographics: { countries: [], cities: [], devices: [] },
      traffic: [],
      error: error.message
    };
  }
};

// Función para probar la conexión GA4
const testGA4Connection = async () => {
  try {
    if (!analyticsDataClient) {
      console.log('⚠️ GA4: Cliente no inicializado');
      return false;
    }

    const testData = await getUsersData(1); // Solo último día
    console.log('✅ GA4 Connection Test:', testData);
    return testData.totalUsers !== undefined;
  } catch (error) {
    console.error('❌ GA4 Connection Test failed:', error.message);
    return false;
  }
};

module.exports = {
  initializeGA4Client,
  getUsersData,
  getTopPages,
  getDemographicData,
  getTrafficSources,
  getGA4Insights,
  testGA4Connection
};