// Script para obtener Page Access Token de Facebook
require('dotenv').config();
const axios = require('axios');

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID || '102585747791569';
const META_API_VERSION = 'v19.0';
const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

console.log('🔍 Obteniendo Page Access Token para Facebook...');

async function getPageToken() {
  try {
    // 1. Primero obtener todas las páginas del usuario
    console.log('\n1️⃣ Obteniendo páginas disponibles...');
    const pagesResponse = await axios.get(`${META_API_BASE_URL}/me/accounts`, {
      params: {
        access_token: META_ACCESS_TOKEN,
        fields: 'id,name,access_token'
      }
    });

    const pages = pagesResponse.data.data || [];
    console.log(`✅ Páginas encontradas: ${pages.length}`);
    
    // 2. Buscar nuestra página específica
    const targetPage = pages.find(page => page.id === FACEBOOK_PAGE_ID);
    
    if (targetPage) {
      console.log(`\n✅ Página encontrada: ${targetPage.name}`);
      console.log(`📘 Page ID: ${targetPage.id}`);
      console.log(`🔑 Page Access Token: ${targetPage.access_token.substring(0, 30)}...`);
      console.log(`📋 Página encontrada correctamente`);
      
      console.log('\n🎉 RESULTADO - Agregar esta variable a tu .env:');
      console.log('=====================================');
      console.log(`FACEBOOK_PAGE_ACCESS_TOKEN=${targetPage.access_token}`);
      console.log('=====================================');
      
      // 3. Probar el Page Access Token obtenido
      console.log('\n3️⃣ Probando Page Access Token...');
      const testResponse = await axios.get(`${META_API_BASE_URL}/${FACEBOOK_PAGE_ID}/insights`, {
        params: {
          access_token: targetPage.access_token,
          metric: 'page_impressions',
          since: '2025-09-05',
          until: '2025-10-05',
          period: 'day'
        }
      });
      
      if (testResponse.data.data) {
        const values = testResponse.data.data[0]?.values || [];
        const total = values.reduce((sum, val) => sum + (val.value || 0), 0);
        console.log(`✅ Test exitoso - page_impressions: ${total}`);
      }
      
      return {
        success: true,
        pageAccessToken: targetPage.access_token,
        pageName: targetPage.name
      };
    } else {
      console.log(`\n❌ No se encontró la página con ID: ${FACEBOOK_PAGE_ID}`);
      console.log('📋 Páginas disponibles:');
      pages.forEach(page => {
        console.log(`   - ${page.name} (ID: ${page.id})`);
      });
      
      return {
        success: false,
        error: 'Page not found'
      };
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    
    if (error.response?.data?.error?.code === 190) {
      console.log('\n💡 El User Access Token parece no tener permisos para acceder a páginas');
      console.log('🔧 Verifica que el token tenga el permiso: pages_show_list');
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Ejecutar
getPageToken().then(result => {
  if (result.success) {
    console.log('\n✅ Page Access Token obtenido exitosamente!');
  } else {
    console.log('\n❌ No se pudo obtener Page Access Token');
  }
});