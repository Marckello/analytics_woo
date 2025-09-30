// Servidor Node.js para EasyPanel
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import fetch from 'node-fetch'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config()

// Hacer fetch disponible globalmente (para compatibilidad)
if (!globalThis.fetch) {
  globalThis.fetch = fetch
}

const app = new Hono()

// Middleware CORS para APIs
app.use('/api/*', cors())

// Servir archivos estáticos desde public
app.use('/static/*', serveStatic({ root: './public' }))

// Variables de entorno para EasyPanel
const getEnv = () => ({
  WOOCOMMERCE_URL: process.env.WOOCOMMERCE_URL,
  WOOCOMMERCE_CONSUMER_KEY: process.env.WOOCOMMERCE_CONSUMER_KEY, 
  WOOCOMMERCE_CONSUMER_SECRET: process.env.WOOCOMMERCE_CONSUMER_SECRET,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini'
})

// Función para autenticar con WooCommerce
const getWooCommerceAuth = (env) => {
  const credentials = Buffer.from(`${env.WOOCOMMERCE_CONSUMER_KEY}:${env.WOOCOMMERCE_CONSUMER_SECRET}`).toString('base64')
  return {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json'
  }
}

// Función para obtener datos de WooCommerce
const fetchWooCommerceData = async (endpoint, env, params) => {
  const url = `${env.WOOCOMMERCE_URL}/wp-json/wc/v3/${endpoint}${params ? `?${params}` : ''}`
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getWooCommerceAuth(env)
    })
    
    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching WooCommerce data:', error)
    throw error
  }
}

// Función para llamar OpenAI API
const callOpenAI = async (prompt, env) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      messages: [
        {
          role: 'system', 
          content: 'Eres un asistente de marketing digital experto en análisis de datos de e-commerce. Responde siempre en español de México con un tono profesional pero amigable. Usa emojis relevantes y estructura tus respuestas con viñetas cuando sea apropiado.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ],
      max_tokens: 600,
      temperature: 0.3
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// Importar todas las rutas desde el archivo principal
// Nota: Necesitaremos adaptar las rutas para usar getEnv() en lugar de c.env

// Manejar favicon.ico
app.get('/favicon.ico', (c) => {
  return c.text('', 404)
})

console.log('🚀 Configuración del servidor Node.js lista para EasyPanel')
console.log('📁 Variables de entorno requeridas:')
console.log('   - WOOCOMMERCE_URL')
console.log('   - WOOCOMMERCE_CONSUMER_KEY') 
console.log('   - WOOCOMMERCE_CONSUMER_SECRET')
console.log('   - OPENAI_API_KEY')
console.log('   - OPENAI_MODEL (opcional)')

// TEMPORAL: Ruta de prueba
app.get('/api/health', (c) => {
  const env = getEnv()
  return c.json({
    status: 'ok',
    server: 'Node.js + Hono para EasyPanel',
    hasWooConfig: !!(env.WOOCOMMERCE_URL && env.WOOCOMMERCE_CONSUMER_KEY),
    hasOpenAI: !!env.OPENAI_API_KEY
  })
})

export default app
export { getEnv, fetchWooCommerceData, callOpenAI }