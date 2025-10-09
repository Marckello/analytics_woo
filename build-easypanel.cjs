// build-easypanel.cjs - Build script para EasyPanel deployment
console.log('🚀 Build iniciado para EasyPanel deployment...');

const fs = require('fs');
const path = require('path');

try {
  // Verificar que los archivos principales existen
  const requiredFiles = [
    'server-ultimate.js',
    'auth.js', 
    'package.json',
    'users.json'
  ];
  
  console.log('📋 Verificando archivos requeridos...');
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`Archivo requerido faltante: ${file}`);
    }
    console.log(`✅ ${file} - OK`);
  }
  
  // Verificar directorio public
  if (!fs.existsSync('public')) {
    console.log('📁 Creando directorio public...');
    fs.mkdirSync('public', { recursive: true });
  }
  
  // Verificar que login.html existe
  if (!fs.existsSync('public/login.html')) {
    console.log('⚠️  Advertencia: public/login.html no encontrado');
  } else {
    console.log('✅ public/login.html - OK');
  }
  
  console.log('✅ Build completado exitosamente para EasyPanel');
  console.log('🎯 Archivos verificados y listos para deployment');
  
} catch (error) {
  console.error('❌ Error en build:', error.message);
  process.exit(1);
}