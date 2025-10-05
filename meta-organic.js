// Meta Organic Content Module - Facebook Pages + Instagram Business
const axios = require('axios');

// Configuración de Meta Organic APIs
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const FACEBOOK_PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const META_API_VERSION = 'v19.0';
const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// IDs de Facebook e Instagram Business
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID || '102585747791569';
const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID || '17841419039251050';

console.log('🔧 Meta Organic - Configuración cargada:');
console.log('📘 Facebook Page ID:', FACEBOOK_PAGE_ID);
console.log('📸 Instagram Account ID:', INSTAGRAM_ACCOUNT_ID);
console.log('🔑 User Access Token:', META_ACCESS_TOKEN ? `${META_ACCESS_TOKEN.substring(0, 20)}...` : 'No configurado');
console.log('🔑 Page Access Token:', FACEBOOK_PAGE_ACCESS_TOKEN ? `${FACEBOOK_PAGE_ACCESS_TOKEN.substring(0, 20)}...` : 'No configurado');

// Función auxiliar para hacer peticiones a Meta API (Instagram - User Token)
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
    console.error('❌ Error en Meta Organic API:', error.response?.data || error.message);
    throw error;
  }
};

// Función auxiliar para hacer peticiones a Facebook Pages API (Page Token)
const makeFacebookPageRequest = async (endpoint, params = {}) => {
  try {
    const url = `${META_API_BASE_URL}${endpoint}`;
    const response = await axios.get(url, {
      params: {
        access_token: FACEBOOK_PAGE_ACCESS_TOKEN,
        ...params
      },
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error en Facebook Page API:', error.response?.data || error.message);
    throw error;
  }
};

// === FACEBOOK PAGES METRICS ===

// Obtener información básica de la página de Facebook
const getFacebookPageInfo = async () => {
  console.log('🔍 Obteniendo información de página de Facebook...');
  
  try {
    const data = await makeFacebookPageRequest(`/${FACEBOOK_PAGE_ID}`, {
      fields: 'id,name,username,followers_count,fan_count,talking_about_count,category,website,about'
    });

    console.log('✅ Facebook Page Info obtenida:', data.name);
    return {
      id: data.id,
      name: data.name,
      username: data.username,
      followersCount: data.followers_count || data.fan_count || 0,
      talkingAboutCount: data.talking_about_count || 0,
      category: data.category,
      website: data.website,
      about: data.about
    };
  } catch (error) {
    console.error('❌ Error obteniendo info de Facebook Page:', error.message);
    return {
      error: error.message,
      followersCount: 0,
      talkingAboutCount: 0
    };
  }
};

// Obtener insights de la página de Facebook
const getFacebookPageInsights = async (dateRange = 30) => {
  console.log(`🔍 Obteniendo insights de Facebook Page para ${dateRange} días...`);
  
  try {
    // Calcular fechas
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - dateRange);

    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    // Métricas de página que queremos obtener (métricas válidas)
    const metrics = [
      'page_impressions',
      'page_impressions_unique',
      'page_post_engagements',
      'page_posts_impressions',
      'page_fans',
      'page_fan_adds',
      'page_fan_removes'
    ].join(',');

    const data = await makeFacebookPageRequest(`/${FACEBOOK_PAGE_ID}/insights`, {
      metric: metrics,
      since: formattedStartDate,
      until: formattedEndDate,
      period: 'day'
    });

    const insights = data.data || [];
    
    // Procesar métricas
    const processedInsights = {
      impressions: 0,
      uniqueImpressions: 0,
      engagedUsers: 0,
      postEngagements: 0,
      postImpressions: 0,
      totalFans: 0,
      fanAdds: 0,
      fanRemoves: 0,
      netFanChange: 0
    };

    insights.forEach(metric => {
      const values = metric.values || [];
      const totalValue = values.reduce((sum, val) => sum + (val.value || 0), 0);
      
      switch (metric.name) {
        case 'page_impressions':
          processedInsights.impressions = totalValue;
          break;
        case 'page_impressions_unique':
          processedInsights.uniqueImpressions = totalValue;
          break;
        // page_engaged_users no es una métrica válida - removida
        case 'page_post_engagements':
          processedInsights.postEngagements = totalValue;
          break;
        case 'page_posts_impressions':
          processedInsights.postImpressions = totalValue;
          break;
        case 'page_fans':
          processedInsights.totalFans = values.length > 0 ? values[values.length - 1].value : 0;
          break;
        case 'page_fan_adds':
          processedInsights.fanAdds = totalValue;
          break;
        case 'page_fan_removes':
          processedInsights.fanRemoves = totalValue;
          break;
      }
    });

    processedInsights.netFanChange = processedInsights.fanAdds - processedInsights.fanRemoves;

    console.log('✅ Facebook Page Insights procesados:', processedInsights);
    return processedInsights;
  } catch (error) {
    console.error('❌ Error obteniendo Facebook Page insights:', error.message);
    return {
      impressions: 0,
      uniqueImpressions: 0,
      engagedUsers: 0,
      postEngagements: 0,
      postImpressions: 0,
      totalFans: 0,
      fanAdds: 0,
      fanRemoves: 0,
      netFanChange: 0,
      error: error.message
    };
  }
};

// Obtener posts recientes de Facebook con métricas
const getFacebookRecentPosts = async (limit = 10) => {
  console.log(`🔍 Obteniendo ${limit} posts recientes de Facebook...`);
  
  try {
    const data = await makeFacebookPageRequest(`/${FACEBOOK_PAGE_ID}/posts`, {
      fields: 'id,message,created_time,type,permalink_url,reactions.summary(true),comments.summary(true)',
      limit: limit
    });

    const posts = data.data || [];
    console.log(`✅ Facebook: ${posts.length} posts obtenidos`);
    
    return posts.map(post => ({
      id: post.id,
      message: post.message || '',
      createdTime: post.created_time,
      type: post.type,
      statusType: post.status_type,
      permalinkUrl: post.permalink_url,
      shares: 0, // Shares deprecated in v3.3+
      reactions: post.reactions?.summary?.total_count || 0,
      comments: post.comments?.summary?.total_count || 0,
      totalInteractions: (post.reactions?.summary?.total_count || 0) + 
                        (post.comments?.summary?.total_count || 0),
      totalEngagement: (post.reactions?.summary?.total_count || 0) + 
                      (post.comments?.summary?.total_count || 0)
    }));
  } catch (error) {
    console.error('❌ Error obteniendo posts de Facebook:', error.message);
    return [];
  }
};

// === INSTAGRAM BUSINESS METRICS ===

// Obtener información básica de Instagram Business
const getInstagramAccountInfo = async () => {
  console.log('🔍 Obteniendo información de cuenta de Instagram Business...');
  
  try {
    const data = await makeMetaAPIRequest(`/${INSTAGRAM_ACCOUNT_ID}`, {
      fields: 'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website'
    });

    console.log('✅ Instagram Account Info obtenida:', data.username);
    return {
      id: data.id,
      username: data.username,
      name: data.name,
      biography: data.biography,
      followersCount: data.followers_count || 0,
      followsCount: data.follows_count || 0,
      mediaCount: data.media_count || 0,
      profilePictureUrl: data.profile_picture_url,
      website: data.website
    };
  } catch (error) {
    console.error('❌ Error obteniendo info de Instagram:', error.message);
    return {
      error: error.message,
      followersCount: 0,
      followsCount: 0,
      mediaCount: 0
    };
  }
};

// Obtener insights de Instagram Business
const getInstagramInsights = async (dateRange = 30) => {
  console.log(`🔍 Obteniendo insights de Instagram para ${dateRange} días...`);
  
  try {
    // Calcular fechas
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - dateRange);

    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];

    // Métricas de cuenta de Instagram (usando nombres correctos de la API)
    const metrics = [
      'reach', 
      'follower_count'
    ].join(',');

    const data = await makeMetaAPIRequest(`/${INSTAGRAM_ACCOUNT_ID}/insights`, {
      metric: metrics,
      since: formattedStartDate,
      until: formattedEndDate,
      period: 'day'
    });

    const insights = data.data || [];
    
    // Procesar métricas
    const processedInsights = {
      impressions: 0,
      reach: 0,
      profileViews: 0,
      websiteClicks: 0,
      followerCount: 0
    };

    insights.forEach(metric => {
      const values = metric.values || [];
      const totalValue = values.reduce((sum, val) => sum + (val.value || 0), 0);
      
      switch (metric.name) {
        case 'reach':
          processedInsights.reach = totalValue;
          break;
        case 'follower_count':
          processedInsights.followerCount = values.length > 0 ? values[values.length - 1].value : 0;
          break;
      }
    });

    // Intentar obtener profile_views por separado con metric_type
    try {
      const profileViewsData = await makeMetaAPIRequest(`/${INSTAGRAM_ACCOUNT_ID}/insights`, {
        metric: 'profile_views',
        metric_type: 'total_value',
        since: formattedStartDate,
        until: formattedEndDate,
        period: 'day'
      });
      
      if (profileViewsData.data && profileViewsData.data[0]) {
        const values = profileViewsData.data[0].values || [];
        processedInsights.profileViews = values.reduce((sum, val) => sum + (val.value || 0), 0);
      }
    } catch (profileViewsError) {
      console.log('⚠️ No se pudieron obtener profile_views:', profileViewsError.response?.data?.error?.message);
    }

    console.log('✅ Instagram Insights procesados:', processedInsights);
    return processedInsights;
  } catch (error) {
    console.error('❌ Error obteniendo Instagram insights:', error.message);
    return {
      impressions: 0,
      reach: 0,
      profileViews: 0,
      websiteClicks: 0,
      followerCount: 0,
      error: error.message
    };
  }
};

// Obtener posts recientes de Instagram con métricas
const getInstagramRecentPosts = async (limit = 12) => {
  console.log(`🔍 Obteniendo ${limit} posts recientes de Instagram...`);
  
  try {
    // Primero obtener la lista de media
    const mediaData = await makeMetaAPIRequest(`/${INSTAGRAM_ACCOUNT_ID}/media`, {
      fields: 'id,caption,media_type,media_url,permalink,timestamp,thumbnail_url,like_count,comments_count,children{media_url,media_type}',
      limit: limit
    });

    const mediaList = mediaData.data || [];
    console.log(`📸 Instagram: ${mediaList.length} posts obtenidos`);
    
    // Procesar posts con datos directos (más confiable que insights)
    const postsWithInsights = mediaList.map((post) => {
      const likes = post.like_count || 0;
      const comments = post.comments_count || 0;
      const totalInteractions = likes + comments;
      
      return {
        id: post.id,
        caption: post.caption || '',
        mediaType: post.media_type,
        mediaUrl: post.media_url,
        thumbnailUrl: post.thumbnail_url,
        permalink: post.permalink,
        timestamp: post.timestamp,
        children: post.children?.data || [],
        insights: {
          impressions: 0, // No disponible en basic fields
          reach: 0,       // No disponible en basic fields  
          likes: likes,
          comments: comments,
          shares: 0,      // No disponible en basic fields
          saved: 0        // No disponible en basic fields
        },
        totalInteractions: totalInteractions,
        totalEngagement: totalInteractions
      };
    });

    return postsWithInsights;
  } catch (error) {
    console.error('❌ Error obteniendo posts de Instagram:', error.message);
    return [];
  }
};

// Obtener Instagram Stories recientes (últimas 24h)
const getInstagramStories = async () => {
  console.log('🔍 Obteniendo Instagram Stories recientes...');
  
  try {
    const data = await makeMetaAPIRequest(`/${INSTAGRAM_ACCOUNT_ID}/stories`, {
      fields: 'id,media_type,media_url,permalink,timestamp,thumbnail_url'
    });

    const stories = data.data || [];
    console.log(`📱 Instagram Stories: ${stories.length} obtenidas`);
    
    // Para cada story, intentar obtener insights
    const storiesWithInsights = await Promise.all(
      stories.map(async (story) => {
        try {
          const insightsData = await makeMetaAPIRequest(`/${story.id}/insights`, {
            metric: 'impressions,reach,taps_forward,taps_back,exits'
          });

          const insights = insightsData.data || [];
          const processedInsights = {
            impressions: 0,
            reach: 0,
            tapsForward: 0,
            tapsBack: 0,
            exits: 0
          };

          insights.forEach(metric => {
            const value = metric.values?.[0]?.value || 0;
            switch (metric.name) {
              case 'taps_forward':
                processedInsights.tapsForward = value;
                break;
              case 'taps_back':
                processedInsights.tapsBack = value;
                break;
              default:
                processedInsights[metric.name] = value;
            }
          });

          return {
            id: story.id,
            mediaType: story.media_type,
            mediaUrl: story.media_url,
            thumbnailUrl: story.thumbnail_url,
            permalink: story.permalink,
            timestamp: story.timestamp,
            insights: processedInsights
          };
        } catch (insightError) {
          return {
            id: story.id,
            mediaType: story.media_type,
            mediaUrl: story.media_url,
            thumbnailUrl: story.thumbnail_url,
            permalink: story.permalink,
            timestamp: story.timestamp,
            insights: { impressions: 0, reach: 0, tapsForward: 0, tapsBack: 0, exits: 0 }
          };
        }
      })
    );

    return storiesWithInsights;
  } catch (error) {
    console.error('❌ Error obteniendo Instagram Stories:', error.message);
    return [];
  }
};

// === FUNCIÓN PRINCIPAL INTEGRADA ===

// Obtener todos los datos orgánicos de Meta (Facebook + Instagram)
const getMetaOrganicInsights = async (dateRange = 30) => {
  console.log(`🔍 getMetaOrganicInsights: Iniciando análisis completo para ${dateRange} días...`);
  
  try {
    const [
      fbPageInfo,
      fbInsights,
      fbPosts,
      igAccountInfo,
      igInsights,
      igPosts,
      igStories
    ] = await Promise.all([
      getFacebookPageInfo(),
      getFacebookPageInsights(dateRange),
      getFacebookRecentPosts(10),
      getInstagramAccountInfo(),
      getInstagramInsights(dateRange),
      getInstagramRecentPosts(12),
      getInstagramStories()
    ]);

    // Calcular métricas combinadas
    const combinedMetrics = {
      totalFollowers: (fbPageInfo.followersCount || 0) + (igAccountInfo.followersCount || 0),
      totalImpressions: (fbInsights.impressions || 0) + (igInsights.impressions || 0),
      totalReach: (fbInsights.uniqueImpressions || 0) + (igInsights.reach || 0),
      totalEngagement: (fbInsights.postEngagements || 0) + 
                       (igPosts.reduce((sum, post) => sum + post.totalEngagement, 0))
    };

    // Top posts por engagement (Facebook + Instagram)
    const allPosts = [
      ...fbPosts.map(post => ({ ...post, platform: 'facebook', engagementRate: post.totalEngagement })),
      ...igPosts.map(post => ({ ...post, platform: 'instagram', engagementRate: post.totalEngagement }))
    ];
    
    const topPosts = allPosts
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 5);

    const result = {
      facebook: {
        pageInfo: fbPageInfo,
        insights: fbInsights,
        posts: fbPosts
      },
      instagram: {
        accountInfo: igAccountInfo,
        insights: igInsights,
        posts: igPosts,
        stories: igStories
      },
      combined: combinedMetrics,
      topPosts: topPosts,
      summary: {
        totalFollowers: combinedMetrics.totalFollowers,
        totalImpressions: combinedMetrics.totalImpressions,
        totalReach: combinedMetrics.totalReach,
        totalEngagement: combinedMetrics.totalEngagement,
        engagementRate: combinedMetrics.totalReach > 0 ? 
          ((combinedMetrics.totalEngagement / combinedMetrics.totalReach) * 100).toFixed(2) : 0,
        facebookPosts: fbPosts.length,
        instagramPosts: igPosts.length,
        instagramStories: igStories.length
      }
    };

    console.log('✅ Meta Organic Insights completados exitosamente');
    return result;
  } catch (error) {
    console.error('❌ Error obteniendo Meta Organic Insights:', error);
    return {
      facebook: { pageInfo: { error: 'Facebook no disponible' }, insights: {}, posts: [] },
      instagram: { accountInfo: { error: 'Instagram no disponible' }, insights: {}, posts: [], stories: [] },
      combined: { totalFollowers: 0, totalImpressions: 0, totalReach: 0, totalEngagement: 0 },
      topPosts: [],
      summary: {
        totalFollowers: 0,
        totalImpressions: 0,
        totalReach: 0,
        totalEngagement: 0,
        engagementRate: 0,
        facebookPosts: 0,
        instagramPosts: 0,
        instagramStories: 0
      }
    };
  }
};

// Función de prueba de conexión
const testMetaOrganicConnection = async () => {
  console.log('🧪 Probando conexión Meta Organic APIs...');
  
  if (!META_ACCESS_TOKEN) {
    return { success: false, error: 'Access Token no configurado' };
  }

  try {
    const [fbTest, igTest] = await Promise.all([
      getFacebookPageInfo(),
      getInstagramAccountInfo()
    ]);
    
    console.log('✅ Prueba Meta Organic exitosa');
    return { 
      success: true, 
      data: {
        facebook: fbTest,
        instagram: igTest
      }
    };
  } catch (error) {
    console.error('❌ Error en prueba Meta Organic:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  getFacebookPageInfo,
  getFacebookPageInsights,
  getFacebookRecentPosts,
  getInstagramAccountInfo,
  getInstagramInsights,
  getInstagramRecentPosts,
  getInstagramStories,
  getMetaOrganicInsights,
  testMetaOrganicConnection
};