# Adaptoheal Analytics

## Proyecto Overview
- **Nombre**: Adaptoheal Analytics - Dashboard Inteligente WooCommerce
- **Objetivo**: Dashboard con IA conversacional para analizar datos de ventas de WooCommerce en tiempo real
- **Características**: Métricas del dashboard + Chat IA para consultas en lenguaje natural

## URLs
- **Desarrollo (Sandbox)**: https://3000-i357gmqhrn2gdx2jad3oz-6532622b.e2b.dev
- **API Dashboard**: https://3000-i357gmqhrn2gdx2jad3oz-6532622b.e2b.dev/api/dashboard
- **API Chat IA**: https://3000-i357gmqhrn2gdx2jad3oz-6532622b.e2b.dev/api/chat
- **GitHub**: (pendiente - para servidor propio)

## Funcionalidades Completadas

### Dashboard Principal
- ✅ **Datos exclusivos Agosto-Septiembre 2025**: Filtrado específico del período
- ✅ **Ventas totales**: $163,439.79 MXN (72 órdenes completadas)
- ✅ **Análisis mensual**:
  - **Agosto 2025**: $90,011.90 MXN (31 órdenes) - Ticket: $2,903.61 MXN
  - **Septiembre 2025**: $73,427.89 MXN (41 órdenes) - Ticket: $1,790.92 MXN
- ✅ **Top 5 productos más vendidos**:
  1. Rhodiola Rosea (3,913 ventas totales)
  2. Ashwagandha (2,647 ventas totales)
  3. Sauzgatillo (1,914 ventas totales)
  4. Reishi (1,755 ventas totales)
  5. Cordyceps (1,715 ventas totales)
- ✅ **Top 5 órdenes más grandes**: hasta $11,113.40 MXN

### IA Conversacional Avanzada
- ✅ **Chat integrado con OpenAI GPT-4o-mini**
- ✅ **Zona horaria México (GMT-6)** - Entiende fechas en tiempo real
- 🧠 **FECHAS RELATIVAS INTELIGENTES** (ejemplos reales probados):
  - **"¿Cuánto vendimos hoy?"** → "Hoy, 29/09/2025, $1,213.61 MXN con 1 orden" ✅
  - **"¿Cuál fue el producto más vendido ayer?"** → Análisis específico del 28/09 ✅
  - **"¿Cuántas órdenes se hicieron el martes?"** → "El martes 23/09/2025, 5 órdenes, $7,833.68 MXN" ✅
  - **"¿Cuál fue el mejor día de ventas esta semana?"** → Análisis automático del período ✅
- 📊 **Consultas clásicas**:
  - "¿Cuánto vendimos en agosto 2025?" → "$90,011.90 MXN"
  - "¿Quién es el cliente que más ha comprado?" → "María Flor Domínguez Ramos ($11,113.40 MXN)"
- ✅ **Contexto inteligente** con datos organizados por fechas específicas
- ✅ **Respuestas profesionales** con insights de marketing digital en tiempo real

## URIs Funcionales

### API Endpoints Inteligentes
- `GET /api/dashboard` - Métricas principales del dashboard
- `POST /api/chat` - **IA con fechas relativas** (parámetro: `{"message": "tu consulta"}`)
  - ✅ Soporta "hoy", "ayer", "el martes", "esta semana"
  - ✅ Zona horaria México automática (GMT-6)
  - ✅ Contexto de fechas específicas
- `GET /api/test-woo` - Verificación de conexión WooCommerce

### Frontend Ultra Moderno
- `/` - Dashboard principal con interfaz **completamente renovada**
- 🎯 **Sugerencias inteligentes**: Botones dinámicos "Hoy", "Ayer", "El martes"
- ⚡ **Animaciones suaves** en KPIs y chat
- 🖼️ **Logo corporativo Adaptoheal** integrado
- 📱 **Responsive perfecto** para móvil
- `/static/app.js` - JavaScript optimizado con manejo de fechas
- `/static/styles.css` - Estilos con gradientes y efectos glass

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
- **Plataforma**: Listo para servidor propio (código optimizado)
- **Status**: ✅ Completamente funcional en sandbox
- **Tech Stack**: 
  - Backend: Hono + TypeScript (compatible con Node.js y Edge)
  - Frontend: Interfaz moderna con TailwindCSS + animaciones
  - IA: OpenAI GPT-4o-mini con contexto especializado
  - Datos: WooCommerce REST API v3 con filtros de fecha precisos
  - Logo: Integrado logo oficial de Adaptoheal

### Para Servidor Propio
- ✅ **Código completamente portable** (sin dependencias de Cloudflare)
- ✅ **Variables de entorno configuradas** (.dev.vars para desarrollo)
- ✅ **Logo corporativo integrado**
- ✅ **Interfaz moderna y responsive**
- ✅ **IA optimizada** para datos específicos de agosto-septiembre 2025

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