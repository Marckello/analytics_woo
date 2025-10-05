// Script para encontrar el ID correcto de Instagram Business
require('dotenv').config();
const axios = require('axios');

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID || '102585747791569';
const META_API_VERSION = 'v19.0';
const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

console.log('🔍 Buscando cuenta de Instagram Business conectada...');
console.log('📘 Facebook Page ID:', FACEBOOK_PAGE_ID);
console.log('🔑 Access Token:', META_ACCESS_TOKEN ? `${META_ACCESS_TOKEN.substring(0, 20)}...` : 'No configurado');

async function findInstagramAccount() {
  try {
    // 1. Obtener información básica de la página
    console.log('\n📊 1. Obteniendo información de la página de Facebook...');
    const pageResponse = await axios.get(`${META_API_BASE_URL}/${FACEBOOK_PAGE_ID}`, {
      params: {
        access_token: META_ACCESS_TOKEN,
        fields: 'id,name,username,instagram_business_account'
      }
    });

    const pageData = pageResponse.data;
    console.log('✅ Página encontrada:', pageData.name);
    console.log('📘 Username FB:', pageData.username || 'N/A');
    
    if (pageData.instagram_business_account) {
      console.log('🎯 Instagram Business Account encontrado:', pageData.instagram_business_account.id);
      
      // 2. Obtener información detallada de Instagram
      console.log('\n📸 2. Obteniendo información de Instagram Business...');
      const igResponse = await axios.get(`${META_API_BASE_URL}/${pageData.instagram_business_account.id}`, {
        params: {
          access_token: META_ACCESS_TOKEN,
          fields: 'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url'
        }
      });

      const igData = igResponse.data;
      console.log('✅ Instagram conectado exitosamente:');
      console.log('   📸 Username:', igData.username);
      console.log('   👥 Seguidores:', (igData.followers_count || 0).toLocaleString());
      console.log('   📱 Siguiendo:', (igData.follows_count || 0).toLocaleString());
      console.log('   📷 Posts:', (igData.media_count || 0).toLocaleString());
      
      console.log('\n🎉 RESULTADO:');
      console.log('=====================================');
      console.log('INSTAGRAM_ACCOUNT_ID=' + pageData.instagram_business_account.id);
      console.log('=====================================');
      
      return {
        success: true,
        instagramId: pageData.instagram_business_account.id,
        instagramUsername: igData.username,
        instagramData: igData
      };
      
    } else {
      console.log('❌ No hay cuenta de Instagram Business conectada a esta página');
      console.log('\n💡 Para conectar Instagram:');
      console.log('1. Ve a tu página de Facebook');
      console.log('2. Configuración > Instagram');  
      console.log('3. Conecta tu cuenta de Instagram Business');
      
      return {
        success: false,
        error: 'No Instagram Business account connected'
      };
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    
    if (error.response?.data?.error?.code === 190) {
      console.log('\n🔑 El token de acceso parece haber expirado o no tener permisos suficientes');
      console.log('💡 Verifica que el token tenga estos permisos:');
      console.log('   - pages_read_engagement');
      console.log('   - pages_show_list'); 
      console.log('   - instagram_basic');
      console.log('   - instagram_manage_insights');
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Ejecutar la búsqueda
findInstagramAccount().then(result => {
  if (result.success) {
    console.log('\n✅ ¡Instagram encontrado y funcionando!');
    process.exit(0);
  } else {
    console.log('\n❌ No se pudo encontrar Instagram Business');
    process.exit(1);
  }
});