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

### 🔐 Sistema de Autenticación y Gestión de Usuarios
- ✅ **Login seguro con JWT** (tokens de 24h de duración)
- ✅ **👁️ Icono del ojo en contraseña** - Mostrar/ocultar contraseña con posicionamiento perfecto
- ✅ **👥 Gestión completa de usuarios** (solo para administradores):
  - Máximo 5 usuarios simultáneos
  - Roles diferenciados (admin vs user)
  - Agregar/eliminar usuarios con validación
  - Contraseñas encriptadas con bcrypt (salt rounds: 12)
- ✅ **🚪 Función de logout funcional** con limpieza completa de sesión
- ✅ **Autenticación por roles** - Botones y funcionalidades según permisos
- ✅ **Usuarios actuales**:
  - 👑 **Admin**: Marco Serrano (marco@serrano.marketing)
  - 👤 **User**: Ana García (ana@adaptohealmx.com)
  - 👤 **User**: Carlos López (carlos@adaptohealmx.com)

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

### 🔐 API Endpoints de Autenticación
- `POST /api/login` - Login seguro con JWT (email + password)
- `POST /api/logout` - Logout con limpieza de sesión
- `POST /api/verify-token` - Verificación de tokens JWT
- `GET /api/users` - **Gestión de usuarios** (solo admin):
  - Lista usuarios actuales (3/5)
  - Información de roles y estados
- `POST /api/users` - **Agregar usuarios** (solo admin)
- `DELETE /api/users/:id` - **Eliminar usuarios** (solo admin, no admin)

### API Endpoints Inteligentes
- `GET /api/dashboard` - Métricas principales del dashboard **con autenticación**
- `POST /api/chat` - **IA con fechas relativas** (parámetro: `{"message": "tu consulta"}`)
  - ✅ Soporta "hoy", "ayer", "el martes", "esta semana"
  - ✅ Zona horaria México automática (GMT-6)
  - ✅ Contexto de fechas específicas
- `GET /api/test-woo` - Verificación de conexión WooCommerce

### Frontend Ultra Moderno
- `/login` - **Página de login moderna** con icono del ojo en contraseña
- `/` - Dashboard principal con interfaz **completamente renovada y protegida**
- 🎯 **Sugerencias inteligentes**: Botones dinámicos "Hoy", "Ayer", "El martes"
- ⚡ **Animaciones suaves** en KPIs y chat
- 🖼️ **Logo corporativo Adaptoheal** integrado
- 📱 **Responsive perfecto** para móvil
- 👥 **Modal de gestión de usuarios** (solo administradores)
- `/static/app.js` - JavaScript optimizado con manejo de fechas y autenticación
- `/static/styles.css` - Estilos con gradientes y efectos glass

## Arquitectura de Datos

### 🔐 Sistema de Usuarios y Seguridad
- **Archivo JSON**: `users.json` con usuarios encriptados
- **Encriptación**: bcrypt con salt rounds 12
- **JWT Tokens**: Expiración 24h con verificación automática
- **Roles**: `admin` (gestión completa) vs `user` (solo dashboard)
- **Límites**: Máximo 5 usuarios simultáneos
- **Middleware**: Protección de rutas por autenticación y rol

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
- **Tablas**: products_cache, orders_cache, customers_cache, ai_queries_log, users_log

## Guía de Uso

### Para el Usuario Final
1. **🔐 Login seguro** en `/login`:
   - Email: tu@adaptoheal.com
   - Contraseña: usa el **👁️ icono del ojo** para mostrar/ocultar
   - Sistema JWT con sesiones de 24h
2. **📊 Accede al dashboard** protegido con métricas en tiempo real
3. **👥 Gestión de usuarios** (solo administradores):
   - Botón "Usuarios" visible automáticamente para admins
   - Agregar hasta 5 usuarios total
   - Asignar roles y gestionar accesos
4. **🤖 Haz consultas con IA** en el chat:
   - "¿Cuántos productos de Rhodiola vendimos esta semana?"
   - "¿Quién es el cliente que más ha comprado?"
   - "¿Cuál fue la venta más alta del mes?"
5. **🚪 Logout seguro** - Botón "Salir" con limpieza completa de sesión

### Para Administradores
```bash
# Credenciales actuales de administrador
Email: marco@serrano.marketing
Password: Adaptoheal2025!

# Usuarios de prueba
Email: ana@adaptohealmx.com / Password: Ana2024!
Email: carlos@adaptohealmx.com / Password: Carlos2024!
```

### Para Desarrolladores
```bash
# Desarrollo local con autenticación
npm run build && pm2 start ecosystem.config.cjs

# Test endpoints protegidos
TOKEN=$(curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"marco@serrano.marketing","password":"Adaptoheal2025!"}' \
  | jq -r '.token')

curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/dashboard
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/users

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

**Última actualización**: 2025-10-01
**Versión**: 2.0.0 - Sistema Completo con Autenticación y Gestión de Usuarios
**Desarrollado para**: Adaptoheal México - Marketing Digital

## 🚀 Changelog v2.0.0

### ✨ Nuevas Funcionalidades
- 👁️ **Icono del ojo en login** - Mostrar/ocultar contraseña con UX perfecto
- 👥 **Sistema completo de gestión de usuarios** - Máximo 5 usuarios con roles
- 🔐 **Autenticación JWT robusta** - Tokens de 24h con verificación automática
- 🚪 **Función de logout funcional** - Limpieza completa de sesión y redirección

### 🔧 Mejoras Técnicas
- Separación perfecta de íconos (candado vs ojo) en formulario de login
- Inicialización automática de información de usuario en dashboard
- Middleware de autenticación por roles con protección de rutas
- Sistema robusto de gestión de usuarios con validaciones completas

### 🛡️ Seguridad Implementada
- Contraseñas encriptadas con bcrypt (salt rounds: 12)
- Tokens JWT con verificación y expiración automática
- Validación de permisos por rol (admin vs user)
- Limpieza segura de sesiones y redirección automática