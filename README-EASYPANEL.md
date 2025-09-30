# Adaptoheal Analytics - Deployment en EasyPanel

## 🎯 Resumen del Proyecto

Dashboard de analytics de WooCommerce con IA conversacional integrada. **Datos 100% reales** (no simulados) con integración OpenAI para análisis inteligente.

### ✅ Características Principales:
- 📊 **Métricas reales** de WooCommerce (ventas, órdenes, métodos de pago)
- 🤖 **Chat IA** con OpenAI GPT-4o-mini para análisis de marketing
- 🎯 **Clasificación exacta** de clientes (26 distribuidores identificados por email)
- 📱 **Responsive design** con Tailwind CSS
- ⚡ **Servidor Node.js** optimizado para EasyPanel

## 🚀 Deployment en EasyPanel

### 1. Configuración de la Aplicación

**Tipo:** Node.js Application
**Node Version:** 18+
**Build Command:** `npm install`  
**Start Command:** `npm run start:easypanel`
**Puerto:** 3000

### 2. Variables de Entorno (CRÍTICAS)

```env
# WooCommerce API (OBLIGATORIOS)
WOOCOMMERCE_URL=https://tu-tienda.com
WOOCOMMERCE_CONSUMER_KEY=ck_tu_consumer_key_aqui
WOOCOMMERCE_CONSUMER_SECRET=cs_tu_consumer_secret_aqui

# OpenAI API (OBLIGATORIO)  
OPENAI_API_KEY=sk-tu_openai_key_aqui
OPENAI_MODEL=gpt-4o-mini

# Servidor (OPCIONAL)
PORT=3000
```

### 3. Estructura del Proyecto

```
adaptoheal-analytics/
├── server-node.js          # Servidor principal para EasyPanel
├── src/index.tsx           # Versión Cloudflare Workers (sandbox)
├── public/static/          # Archivos estáticos (CSS, JS, imágenes)
├── package.json           # Dependencias Node.js + Cloudflare
├── .env.example          # Template de variables de entorno
└── README-EASYPANEL.md   # Esta guía
```

## 📋 Pasos de Deployment

### Opción A: GitHub + EasyPanel (RECOMENDADO)

1. **Conectar GitHub:**
   - Sube el proyecto a un repositorio de GitHub
   - En EasyPanel: New Service → GitHub → Selecciona el repo

2. **Configurar Build:**
   - Build Command: `npm install`
   - Start Command: `npm run start:easypanel`
   - Working Directory: `/` (root del proyecto)

3. **Configurar Variables:**
   - Ve a Environment Variables en EasyPanel
   - Agrega todas las variables del paso 2

4. **Deploy:**
   - EasyPanel automáticamente hace build y deploy
   - Cada git push actualizará automáticamente

### Opción B: Upload Manual

1. **Descargar proyecto:** [Backup completo](https://page.gensparksite.com/project_backups/tooluse_1I7QANEOTfqeloSswiRMTQ.tar.gz)
2. **Extraer y subir** a EasyPanel
3. **Configurar variables** de entorno
4. **Deploy**

## 🔧 APIs Disponibles

- `GET /` - Dashboard principal
- `GET /api/health` - Health check
- `GET /api/dashboard` - Métricas principales
- `GET /api/test-woo` - Test conexión WooCommerce  
- `POST /api/chat` - Chat IA con OpenAI

## 🛠️ Desarrollo Local

```bash
# Instalar dependencias
npm install

# Configurar variables (copiar .env.example a .env)
cp .env.example .env

# Iniciar servidor local
npm run start:easypanel

# Abrir http://localhost:3000
```

## ⚠️ Consideraciones Importantes

1. **Variables de entorno son CRÍTICAS** - sin ellas el dashboard no funcionará
2. **WooCommerce Consumer Key/Secret** deben tener permisos de lectura
3. **OpenAI API Key** necesita créditos disponibles
4. **Puerto 3000** es el default, EasyPanel puede asignar otro
5. **Datos reales:** No hay simulaciones, todo viene de tu WooCommerce

## 📊 Funcionalidades del Dashboard

### Métricas Principales:
- ✅ Ventas totales por período
- ✅ Número de órdenes  
- ✅ Ticket promedio
- ✅ Estado de conexión API

### Análisis Avanzado:
- ✅ **Métodos de pago reales** (Stripe, PayPal, Transferencias)
- ✅ **Estados de órdenes** (Completadas, Entregadas, En proceso)
- ✅ **Tipos de clientes** (Distribuidores vs Regulares)
- ✅ **Productos top** y órdenes más grandes

### Selección de Períodos:
- ✅ Hoy / Ayer
- ✅ Este mes / Mes anterior  
- ✅ Últimos 7/30 días
- ✅ Agosto 2025 / Septiembre 2025
- ✅ **Fechas personalizadas**

### IA Conversacional:
- ✅ Análisis de tendencias de ventas
- ✅ Recomendaciones de marketing
- ✅ Insights sobre comportamiento de clientes
- ✅ Respuestas contextuales en español

## 🎯 Próximos Pasos

1. **Autorizar GitHub** en el sandbox
2. **Subir código** al repositorio
3. **Conectar EasyPanel** con GitHub
4. **Configurar variables** de entorno
5. **¡Listo para producción!**

---

**Desarrollado por:** Assistant IA para Marco
**Stack:** Node.js + Hono + WooCommerce + OpenAI + TailwindCSS  
**Deployment:** EasyPanel + GitHub