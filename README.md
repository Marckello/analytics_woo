# Adaptoheal Analytics

## Proyecto Overview
- **Nombre**: Adaptoheal Analytics - Dashboard Inteligente WooCommerce
- **Objetivo**: Dashboard con IA conversacional para analizar datos de ventas de WooCommerce en tiempo real
- **Características**: Métricas del dashboard + Chat IA para consultas en lenguaje natural

## URLs
- **Desarrollo (Sandbox)**: https://3000-i357gmqhrn2gdx2jad3oz-6532622b.e2b.dev
- **API Dashboard**: https://3000-i357gmqhrn2gdx2jad3oz-6532622b.e2b.dev/api/dashboard
- **API Chat IA**: https://3000-i357gmqhrn2gdx2jad3oz-6532622b.e2b.dev/api/chat
- **GitHub**: (pendiente configuración)

## Funcionalidades Completadas

### Dashboard Principal
- ✅ **Ventas totales de los últimos 30 días**: $79,866.59 MXN (42 órdenes)
- ✅ **Ticket promedio**: $1,901.59 MXN
- ✅ **Top 5 productos más vendidos**:
  1. Rhodiola Rosea (3,913 ventas)
  2. Ashwagandha (2,647 ventas)
  3. Sauzgatillo (1,914 ventas)
  4. Reishi (1,755 ventas)
  5. Cordyceps (1,715 ventas)
- ✅ **Top 5 órdenes más grandes**: hasta $7,377.20 MXN

### IA Conversacional
- ✅ **Chat integrado con OpenAI GPT-4o-mini**
- ✅ **Consultas en lenguaje natural**:
  - "¿Cuánto vendimos ayer?"
  - "¿Cuál es el cliente que más ha comprado?"
  - "¿Qué producto es más popular esta semana?"
- ✅ **Contexto automático** con datos actuales de WooCommerce
- ✅ **Respuestas en español** adaptadas al negocio

## URIs Funcionales

### API Endpoints
- `GET /api/dashboard` - Métricas principales del dashboard
- `POST /api/chat` - Chat con IA (parámetro: `{"message": "tu consulta"}`)
- `GET /api/test-woo` - Verificación de conexión WooCommerce

### Frontend
- `/` - Dashboard principal con interfaz completa
- `/static/app.js` - JavaScript del frontend
- `/static/styles.css` - Estilos personalizados

## Arquitectura de Datos

### Integración WooCommerce
- **API REST v3** conectada a adaptohealmx.com
- **Autenticación**: Consumer Key + Consumer Secret
- **Datos en tiempo real**: Órdenes, productos, clientes

### IA y Procesamiento
- **OpenAI GPT-4o-mini** para procesamiento de consultas
- **Contexto dinámico** con datos recientes de WooCommerce
- **Log de consultas** para analytics (preparado para D1)

### Cache (Preparado)
- **Cloudflare D1** configurado para cache futuro
- **Tablas**: products_cache, orders_cache, customers_cache, ai_queries_log

## Guía de Uso

### Para el Usuario Final
1. **Accede al dashboard** en la URL principal
2. **Revisa métricas** automáticamente cargadas (ventas, productos, órdenes)
3. **Haz consultas con IA** en el chat:
   - "¿Cuántos productos de Rhodiola vendimos esta semana?"
   - "¿Quién es el cliente que más ha comprado?"
   - "¿Cuál fue la venta más alta del mes?"
4. **Interactúa naturalmente** - la IA entiende contexto comercial

### Para Desarrolladores
```bash
# Desarrollo local
npm run build && pm2 start ecosystem.config.cjs
curl http://localhost:3000/api/dashboard

# Deploy a Cloudflare Pages (requiere setup previo)
npm run deploy:prod
```

## Deployment

### Estado Actual
- **Plataforma**: Cloudflare Pages (preparado)
- **Status**: ✅ Funcionando en sandbox de desarrollo
- **Tech Stack**: 
  - Backend: Hono + TypeScript + Cloudflare Workers
  - Frontend: TailwindCSS + Vanilla JS + CDNs
  - IA: OpenAI GPT-4o-mini
  - Datos: WooCommerce REST API v3

### Pendiente
- ⏳ Configuración API Cloudflare para deployment
- ⏳ Activación cache D1 para optimización
- ⏳ Setup repositorio GitHub para CI/CD

## Configuración de Secrets

### Variables de Entorno (.dev.vars)
```
WOOCOMMERCE_URL=https://www.adaptohealmx.com
WOOCOMMERCE_CONSUMER_KEY=ck_***
WOOCOMMERCE_CONSUMER_SECRET=cs_***
OPENAI_API_KEY=sk-proj-***
OPENAI_MODEL=gpt-4o-mini
```

### Para Producción (wrangler secrets)
```bash
npx wrangler pages secret put WOOCOMMERCE_CONSUMER_KEY
npx wrangler pages secret put WOOCOMMERCE_CONSUMER_SECRET  
npx wrangler pages secret put OPENAI_API_KEY
```

## Próximos Pasos Recomendados

### Optimizaciones Inmediatas
1. **Activar cache D1** para mejorar rendimiento
2. **Configurar deployment automático** a Cloudflare Pages
3. **Expandir contexto IA** con más datos históricos

### Funcionalidades Avanzadas
1. **Alertas automáticas** (ventas bajas, productos agotados)
2. **Reportes PDF** exportables
3. **Dashboard multi-usuario** con roles
4. **Integración WhatsApp/Telegram** para consultas móviles

### Analytics Avanzado
1. **Predicciones de ventas** con IA
2. **Análisis de tendencias** estacionales
3. **Recomendaciones de productos** basadas en datos
4. **Segmentación de clientes** automática

---

**Última actualización**: 2025-09-29
**Versión**: 1.0.0 - MVP Completo
**Desarrollado para**: Adaptoheal México - Marketing Digital