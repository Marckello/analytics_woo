// Debug script para Meta Organic - Revisar qué métricas están disponibles
require('dotenv').config();
const axios = require('axios');

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const FACEBOOK_PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID || '102585747791569';
const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID || '17841419039251050';
const META_API_VERSION = 'v19.0';
const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

console.log('🔍 Debugging Meta Organic APIs...');
console.log('📘 Facebook Page ID:', FACEBOOK_PAGE_ID);
console.log('📸 Instagram Account ID:', INSTAGRAM_ACCOUNT_ID);
console.log('🔑 Page Access Token:', FACEBOOK_PAGE_ACCESS_TOKEN ? 'Configurado' : 'No configurado');

// Función auxiliar para hacer peticiones (Instagram - User Token)
const makeRequest = async (endpoint, params = {}) => {
  try {
    const url = `${META_API_BASE_URL}${endpoint}`;
    const response = await axios.get(url, {
      params: { access_token: META_ACCESS_TOKEN, ...params },
      timeout: 30000
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
};

// Función auxiliar para hacer peticiones (Facebook Pages - Page Token)
const makePageRequest = async (endpoint, params = {}) => {
  try {
    const url = `${META_API_BASE_URL}${endpoint}`;
    const response = await axios.get(url, {
      params: { access_token: FACEBOOK_PAGE_ACCESS_TOKEN, ...params },
      timeout: 30000
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
};

async function debugMetaOrganic() {
  console.log('\n=== FACEBOOK PAGE DEBUG ===');
  
  // 1. Facebook Page basic info
  console.log('\n1️⃣ Facebook Page - Información básica:');
  const fbBasic = await makePageRequest(`/${FACEBOOK_PAGE_ID}`, {
    fields: 'id,name,followers_count,fan_count,talking_about_count'
  });
  if (fbBasic.success) {
    console.log('✅ FB Basic:', fbBasic.data);
  } else {
    console.log('❌ FB Basic Error:', fbBasic.error);
  }

  // 2. Facebook Page insights - revisar qué métricas están disponibles
  console.log('\n2️⃣ Facebook Page - Insights disponibles:');
  
  // Calcular fechas para los últimos 30 días
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 30);
  const formattedStartDate = startDate.toISOString().split('T')[0];
  const formattedEndDate = endDate.toISOString().split('T')[0];

  console.log(`📅 Período: ${formattedStartDate} a ${formattedEndDate}`);

  // Probar métricas básicas de Facebook
  const basicMetrics = ['page_impressions', 'page_engaged_users', 'page_fans'];
  
  for (const metric of basicMetrics) {
    const fbInsight = await makePageRequest(`/${FACEBOOK_PAGE_ID}/insights`, {
      metric: metric,
      since: formattedStartDate,
      until: formattedEndDate,
      period: 'day'
    });
    
    if (fbInsight.success) {
      const values = fbInsight.data.data?.[0]?.values || [];
      const total = values.reduce((sum, val) => sum + (val.value || 0), 0);
      console.log(`✅ ${metric}: ${total} (${values.length} days)`);
    } else {
      console.log(`❌ ${metric} Error:`, fbInsight.error?.error?.message || 'Unknown error');
    }
  }

  // 3. Facebook Posts
  console.log('\n3️⃣ Facebook Page - Posts recientes:');
  const fbPosts = await makePageRequest(`/${FACEBOOK_PAGE_ID}/posts`, {
    fields: 'id,message,created_time,reactions.summary(true),comments.summary(true),shares',
    limit: 5
  });
  
  if (fbPosts.success) {
    const posts = fbPosts.data.data || [];
    console.log(`✅ FB Posts encontrados: ${posts.length}`);
    posts.forEach((post, i) => {
      const reactions = post.reactions?.summary?.total_count || 0;
      const comments = post.comments?.summary?.total_count || 0;
      const shares = post.shares?.count || 0;
      console.log(`   ${i+1}. Reactions: ${reactions}, Comments: ${comments}, Shares: ${shares}`);
    });
  } else {
    console.log('❌ FB Posts Error:', fbPosts.error);
  }

  console.log('\n=== INSTAGRAM DEBUG ===');

  // 4. Instagram basic info
  console.log('\n4️⃣ Instagram - Información básica:');
  const igBasic = await makeRequest(`/${INSTAGRAM_ACCOUNT_ID}`, {
    fields: 'id,username,followers_count,follows_count,media_count'
  });
  if (igBasic.success) {
    console.log('✅ IG Basic:', igBasic.data);
  } else {
    console.log('❌ IG Basic Error:', igBasic.error);
  }

  // 5. Instagram insights - revisar permisos
  console.log('\n5️⃣ Instagram - Insights (requiere permisos específicos):');
  
  const igMetrics = ['impressions', 'reach', 'profile_views', 'follower_count'];
  
  for (const metric of igMetrics) {
    const igInsight = await makeRequest(`/${INSTAGRAM_ACCOUNT_ID}/insights`, {
      metric: metric,
      since: formattedStartDate,
      until: formattedEndDate,
      period: 'day'
    });
    
    if (igInsight.success) {
      const values = igInsight.data.data?.[0]?.values || [];
      const total = values.reduce((sum, val) => sum + (val.value || 0), 0);
      console.log(`✅ ${metric}: ${total}`);
    } else {
      console.log(`❌ ${metric} Error:`, igInsight.error?.error?.message || 'Unknown error');
      console.log(`   Code: ${igInsight.error?.error?.code}, Subcode: ${igInsight.error?.error?.error_subcode}`);
    }
  }

  // 6. Instagram Media
  console.log('\n6️⃣ Instagram - Posts/Media:');
  const igMedia = await makeRequest(`/${INSTAGRAM_ACCOUNT_ID}/media`, {
    fields: 'id,caption,media_type,timestamp,like_count,comments_count',
    limit: 5
  });
  
  if (igMedia.success) {
    const media = igMedia.data.data || [];
    console.log(`✅ IG Media encontrados: ${media.length}`);
    media.forEach((post, i) => {
      console.log(`   ${i+1}. Tipo: ${post.media_type}, Likes: ${post.like_count || 'N/A'}, Comments: ${post.comments_count || 'N/A'}`);
    });
  } else {
    console.log('❌ IG Media Error:', igMedia.error);
  }

  // 7. Instagram Stories
  console.log('\n7️⃣ Instagram - Stories:');
  const igStories = await makeRequest(`/${INSTAGRAM_ACCOUNT_ID}/stories`, {
    fields: 'id,media_type,timestamp'
  });
  
  if (igStories.success) {
    const stories = igStories.data.data || [];
    console.log(`✅ IG Stories encontradas: ${stories.length}`);
  } else {
    console.log('❌ IG Stories Error:', igStories.error);
  }

  console.log('\n=== PERMISOS Y RECOMENDACIONES ===');
  console.log('\n💡 Para obtener métricas completas, verifica que tengas estos permisos:');
  console.log('📘 Facebook: pages_read_engagement, pages_show_list, read_insights');
  console.log('📸 Instagram: instagram_basic, instagram_manage_insights, pages_read_engagement');
  console.log('\n🔧 También verifica que:');
  console.log('1. La página de Facebook tenga suficiente actividad reciente');
  console.log('2. Instagram Business esté correctamente conectado a Facebook');
  console.log('3. El token tenga permisos para leer insights de Instagram Business');
}

// Ejecutar debug
debugMetaOrganic().then(() => {
  console.log('\n✅ Debug completado');
}).catch(error => {
  console.error('❌ Error en debug:', error);
});