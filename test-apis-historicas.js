// Script de prueba para verificar datos reales en APIs para períodos históricos
require('dotenv').config();

const { getGoogleAdsInsights, testGoogleAdsConnection } = require('./google-ads-official.js');
const { getGA4Insights, testGA4Connection } = require('./google-analytics-oauth.js');
const { getMetaAdsInsights, testMetaConnection } = require('./meta-ads.js');
const { getMetaOrganicInsights, testMetaOrganicConnection } = require('./meta-organic.js');

async function testHistoricalAPIs() {
  console.log('🧪 INICIANDO PRUEBAS DE APIs PARA PERÍODOS HISTÓRICOS');
  console.log('='.repeat(60));
  
  const testResults = {
    googleAds: {},
    googleAnalytics: {},
    metaAds: {},
    metaOrganic: {}
  };
  
  // Períodos históricos a probar
  const historicalPeriods = [
    { name: 'Enero 2025', startDate: '2025-01-01', endDate: '2025-01-31', days: 31 },
    { name: 'Febrero 2025', startDate: '2025-02-01', endDate: '2025-02-28', days: 28 },
    { name: 'Marzo 2025', startDate: '2025-03-01', endDate: '2025-03-31', days: 31 },
    { name: 'Julio 2025', startDate: '2025-07-01', endDate: '2025-07-31', days: 31 }
  ];
  
  // Test 1: Google Ads
  console.log('\\n🔴 PRUEBA 1: GOOGLE ADS');
  console.log('-'.repeat(40));
  
  try {
    const adsConnected = await testGoogleAdsConnection();
    console.log(`📡 Conexión Google Ads: ${adsConnected ? '✅ CONECTADO' : '❌ DESCONECTADO'}`);
    testResults.googleAds.connected = adsConnected;
    
    if (adsConnected) {
      for (const period of historicalPeriods) {
        console.log(`\\n📊 Probando ${period.name}...`);
        const adsData = await getGoogleAdsInsights(period.days, period.startDate, period.endDate);
        
        const hasRealData = adsData && adsData.metrics && (
          adsData.metrics.impressions > 0 || 
          adsData.metrics.clicks > 0 || 
          adsData.metrics.cost > 0
        );
        
        console.log(`   - Impresiones: ${adsData?.metrics?.impressions || 0}`);
        console.log(`   - Clicks: ${adsData?.metrics?.clicks || 0}`);
        console.log(`   - Costo: $${adsData?.metrics?.cost || 0}`);
        console.log(`   - Datos reales: ${hasRealData ? '✅ SÍ' : '❌ NO'}`);
        
        testResults.googleAds[period.name] = {
          hasData: hasRealData,
          metrics: adsData?.metrics
        };
      }
    }
  } catch (error) {
    console.error('❌ Error en Google Ads:', error.message);
    testResults.googleAds.error = error.message;
  }
  
  // Test 2: Google Analytics
  console.log('\\n🔵 PRUEBA 2: GOOGLE ANALYTICS');
  console.log('-'.repeat(40));
  
  try {
    const ga4Connected = await testGA4Connection();
    console.log(`📡 Conexión GA4: ${ga4Connected ? '✅ CONECTADO' : '❌ DESCONECTADO'}`);
    testResults.googleAnalytics.connected = ga4Connected;
    
    if (ga4Connected) {
      for (const period of historicalPeriods) {
        console.log(`\\n📊 Probando ${period.name}...`);
        const ga4Data = await getGA4Insights(period.days, period.startDate, period.endDate);
        
        const hasRealData = ga4Data && (
          ga4Data.users?.totalUsers > 0 || 
          ga4Data.pages?.length > 0 ||
          ga4Data.traffic?.length > 0
        );
        
        console.log(`   - Usuarios totales: ${ga4Data?.users?.totalUsers || 0}`);
        console.log(`   - Páginas visitadas: ${ga4Data?.pages?.length || 0}`);
        console.log(`   - Fuentes de tráfico: ${ga4Data?.traffic?.length || 0}`);
        console.log(`   - Datos reales: ${hasRealData ? '✅ SÍ' : '❌ NO'}`);
        
        testResults.googleAnalytics[period.name] = {
          hasData: hasRealData,
          metrics: {
            users: ga4Data?.users?.totalUsers || 0,
            pages: ga4Data?.pages?.length || 0,
            traffic: ga4Data?.traffic?.length || 0
          }
        };
      }
    }
  } catch (error) {
    console.error('❌ Error en Google Analytics:', error.message);
    testResults.googleAnalytics.error = error.message;
  }
  
  // Test 3: Meta Ads
  console.log('\\n🟡 PRUEBA 3: META ADS');
  console.log('-'.repeat(40));
  
  try {
    const metaAdsTest = await testMetaConnection();
    const metaConnected = metaAdsTest.success;
    console.log(`📡 Conexión Meta Ads: ${metaConnected ? '✅ CONECTADO' : '❌ DESCONECTADO'}`);
    testResults.metaAds.connected = metaConnected;
    
    if (metaConnected) {
      for (const period of historicalPeriods) {
        console.log(`\\n📊 Probando ${period.name}...`);
        const metaData = await getMetaAdsInsights(period.days, period.startDate, period.endDate);
        
        const hasRealData = metaData && metaData.metrics && (
          metaData.metrics.impressions > 0 || 
          metaData.metrics.clicks > 0 || 
          metaData.metrics.spend > 0
        );
        
        console.log(`   - Impresiones: ${metaData?.metrics?.impressions || 0}`);
        console.log(`   - Clicks: ${metaData?.metrics?.clicks || 0}`);
        console.log(`   - Gasto: $${metaData?.metrics?.spend || 0}`);
        console.log(`   - Datos reales: ${hasRealData ? '✅ SÍ' : '❌ NO'}`);
        
        testResults.metaAds[period.name] = {
          hasData: hasRealData,
          metrics: metaData?.metrics
        };
      }
    }
  } catch (error) {
    console.error('❌ Error en Meta Ads:', error.message);
    testResults.metaAds.error = error.message;
  }
  
  // Test 4: Meta Organic (Instagram)
  console.log('\\n🟣 PRUEBA 4: META ORGANIC (INSTAGRAM)');
  console.log('-'.repeat(40));
  
  try {
    const metaOrganicTest = await testMetaOrganicConnection();
    const metaOrganicConnected = metaOrganicTest.success;
    console.log(`📡 Conexión Meta Organic: ${metaOrganicConnected ? '✅ CONECTADO' : '❌ DESCONECTADO'}`);
    testResults.metaOrganic.connected = metaOrganicConnected;
    
    if (metaOrganicConnected) {
      for (const period of historicalPeriods) {
        console.log(`\\n📊 Probando ${period.name}...`);
        const metaOrganicData = await getMetaOrganicInsights(period.days, period.startDate, period.endDate);
        
        const hasRealData = metaOrganicData && (
          metaOrganicData.facebook?.reach > 0 || 
          metaOrganicData.instagram?.reach > 0 ||
          metaOrganicData.facebook?.impressions > 0 ||
          metaOrganicData.instagram?.impressions > 0
        );
        
        console.log(`   - Facebook Reach: ${metaOrganicData?.facebook?.reach || 0}`);
        console.log(`   - Instagram Reach: ${metaOrganicData?.instagram?.reach || 0}`);
        console.log(`   - Facebook Impressions: ${metaOrganicData?.facebook?.impressions || 0}`);
        console.log(`   - Instagram Impressions: ${metaOrganicData?.instagram?.impressions || 0}`);
        console.log(`   - Datos reales: ${hasRealData ? '✅ SÍ' : '❌ NO'}`);
        
        testResults.metaOrganic[period.name] = {
          hasData: hasRealData,
          metrics: {
            facebookReach: metaOrganicData?.facebook?.reach || 0,
            instagramReach: metaOrganicData?.instagram?.reach || 0,
            facebookImpressions: metaOrganicData?.facebook?.impressions || 0,
            instagramImpressions: metaOrganicData?.instagram?.impressions || 0
          }
        };
      }
    }
  } catch (error) {
    console.error('❌ Error en Meta Organic:', error.message);
    testResults.metaOrganic.error = error.message;
  }
  
  // Resumen final
  console.log('\\n' + '='.repeat(60));
  console.log('📋 RESUMEN DE PRUEBAS - DATOS REALES DISPONIBLES');
  console.log('='.repeat(60));
  
  const apis = ['googleAds', 'googleAnalytics', 'metaAds', 'metaOrganic'];
  const apiNames = ['Google Ads', 'Google Analytics', 'Meta Ads', 'Meta Organic'];
  
  for (let i = 0; i < apis.length; i++) {
    const apiKey = apis[i];
    const apiName = apiNames[i];
    const apiResults = testResults[apiKey];
    
    console.log(`\\n${apiName}:`);
    console.log(`  Conectado: ${apiResults.connected ? '✅ SÍ' : '❌ NO'}`);
    
    if (apiResults.connected) {
      let hasAnyHistoricalData = false;
      for (const period of historicalPeriods) {
        const periodData = apiResults[period.name];
        if (periodData && periodData.hasData) {
          hasAnyHistoricalData = true;
          console.log(`  ${period.name}: ✅ TIENE DATOS`);
        } else {
          console.log(`  ${period.name}: ❌ SIN DATOS`);
        }
      }
      console.log(`  Recomendación: ${hasAnyHistoricalData ? '✅ MOSTRAR EN PERÍODOS HISTÓRICOS' : '❌ OCULTAR EN PERÍODOS HISTÓRICOS'}`);
    } else {
      console.log(`  Recomendación: ❌ OCULTAR SIEMPRE (NO CONECTADO)`);
    }
  }
  
  console.log('\\n' + '='.repeat(60));
  console.log('✅ PRUEBAS COMPLETADAS');
  console.log('='.repeat(60));
  
  return testResults;
}

// Ejecutar pruebas
if (require.main === module) {
  testHistoricalAPIs()
    .then(results => {
      console.log('\\n📊 Resultados guardados para análisis');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error ejecutando pruebas:', error);
      process.exit(1);
    });
}

module.exports = { testHistoricalAPIs };