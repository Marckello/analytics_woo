// 🔍 AUDITORÍA COMPLETA DE DATOS FICTICIOS/HARDCODEADOS
// Búsqueda exhaustiva de datos que NO sean reales en el dashboard

const fs = require('fs');
const path = require('path');

// Patrones a buscar para identificar datos ficticios
const PATTERNS = {
  // Números sospechosos (comunes en datos de prueba)
  fakeNumbers: /\b(1234|5678|9999|1111|2222|3333|4444|5555|6666|7777|8888|0000|123456|654321)\b/g,
  
  // Datos de ejemplo/prueba
  testData: /\b(test|demo|sample|example|fake|dummy|mock|placeholder)\b/gi,
  
  // Emails ficticios
  fakeEmails: /(test@|demo@|example@|fake@|dummy@|sample@|admin@test|user@test)/gi,
  
  // Números hardcodeados en contexto de métricas
  hardcodedMetrics: /(impressions.*:\s*\d+|clicks.*:\s*\d+|cost.*:\s*\d+\.\d+|revenue.*:\s*\d+)/gi,
  
  // Datos hardcodeados en return statements
  hardcodedReturns: /return\s*{\s*[^}]*(\d{3,}|success.*true)[^}]*}/g,
  
  // URLs de prueba/desarrollo
  testUrls: /(localhost|127\.0\.0\.1|test\.com|example\.com|demo\.com)/gi,
  
  // Tokens/keys ficticios
  fakeTokens: /(sk-test|pk_test|test_key|demo_key|fake_token)/gi
};

function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const results = {
      file: filePath,
      issues: []
    };
    
    // Analizar cada patrón
    Object.entries(PATTERNS).forEach(([type, pattern]) => {
      const matches = content.match(pattern);
      if (matches) {
        results.issues.push({
          type,
          matches: [...new Set(matches)], // Eliminar duplicados
          count: matches.length
        });
      }
    });
    
    // Análisis específico para diferentes tipos de archivos
    const fileName = path.basename(filePath);
    
    if (fileName.endsWith('.js')) {
      // Buscar funciones que retornen datos hardcodeados
      const functionReturns = content.match(/function.*{[\s\S]*?return\s*{[\s\S]*?}[\s\S]*?}/g);
      if (functionReturns) {
        functionReturns.forEach(func => {
          if (func.includes('impressions') || func.includes('clicks') || func.includes('cost')) {
            results.issues.push({
              type: 'suspiciousFunction',
              matches: [func.substring(0, 100) + '...'],
              count: 1
            });
          }
        });
      }
      
      // Buscar variables con valores numéricos sospechosos
      const suspiciousVars = content.match(/\w+\s*=\s*\d{3,}/g);
      if (suspiciousVars) {
        results.issues.push({
          type: 'suspiciousVariables',
          matches: suspiciousVars,
          count: suspiciousVars.length
        });
      }
    }
    
    return results.issues.length > 0 ? results : null;
  } catch (error) {
    return {
      file: filePath,
      error: error.message
    };
  }
}

function scanDirectory(dirPath, extensions = ['.js', '.json', '.html', '.env']) {
  const results = [];
  
  function scanRecursive(currentPath) {
    try {
      const items = fs.readdirSync(currentPath);
      
      items.forEach(item => {
        const fullPath = path.join(currentPath, item);
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          // Ignorar directorios comunes que no contienen código relevante
          if (!['node_modules', '.git', '.wrangler', 'dist', 'build'].includes(item)) {
            scanRecursive(fullPath);
          }
        } else if (stats.isFile()) {
          const ext = path.extname(fullPath);
          if (extensions.includes(ext)) {
            const analysis = analyzeFile(fullPath);
            if (analysis) {
              results.push(analysis);
            }
          }
        }
      });
    } catch (error) {
      console.error(`Error escaneando ${currentPath}:`, error.message);
    }
  }
  
  scanRecursive(dirPath);
  return results;
}

// Análisis específico de APIs y módulos críticos
function analyzeAPIs() {
  const apiModules = [
    './google-ads-official.js',
    './google-analytics-oauth.js', 
    './meta-ads.js',
    './meta-organic.js',
    './server-ultimate.js'
  ];
  
  const apiResults = [];
  
  apiModules.forEach(module => {
    if (fs.existsSync(module)) {
      console.log(`\\n🔍 Analizando API: ${module}`);
      
      const content = fs.readFileSync(module, 'utf8');
      
      // Buscar funciones que devuelvan datos específicos
      const dataReturns = content.match(/return\s*{[^}]*(?:impressions|clicks|cost|users|reach)[^}]*}/g);
      if (dataReturns) {
        console.log(`  ⚠️  Encontradas ${dataReturns.length} funciones que retornan métricas:`);
        dataReturns.forEach((ret, i) => {
          console.log(`    ${i+1}. ${ret.substring(0, 80)}...`);
        });
      }
      
      // Buscar valores hardcodeados en contexto de métricas
      const hardcodedValues = content.match(/(impressions|clicks|cost|users|reach).*?[:=]\s*\d+/g);
      if (hardcodedValues) {
        console.log(`  🚨 Valores hardcodeados encontrados:`);
        hardcodedValues.forEach(val => console.log(`    - ${val}`));
      }
      
      // Verificar si hay datos de fallback/error
      const fallbackData = content.match(/(error.*?|fallback.*?|default.*?)return.*?{[^}]*\d+[^}]*}/g);
      if (fallbackData) {
        console.log(`  📋 Datos de fallback/error:`);
        fallbackData.forEach(fb => console.log(`    - ${fb.substring(0, 60)}...`));
      }
    }
  });
  
  return apiResults;
}

// Ejecutar auditoría completa
function runCompleteAudit() {
  console.log('🔍 INICIANDO AUDITORÍA COMPLETA DE DATOS FICTICIOS');
  console.log('=' .repeat(60));
  
  console.log('\\n📂 Escaneando todos los archivos del proyecto...');
  const projectResults = scanDirectory('./');
  
  console.log('\\n🔌 Analizando módulos de APIs específicamente...');
  analyzeAPIs();
  
  console.log('\\n📊 RESUMEN DE RESULTADOS');
  console.log('-'.repeat(40));
  
  if (projectResults.length === 0) {
    console.log('✅ No se encontraron datos ficticios evidentes');
  } else {
    console.log(`⚠️  Se encontraron ${projectResults.length} archivos con posibles datos ficticios:`);
    
    projectResults.forEach(result => {
      console.log(`\\n📄 ${result.file}:`);
      if (result.error) {
        console.log(`  ❌ Error: ${result.error}`);
      } else {
        result.issues.forEach(issue => {
          console.log(`  🔍 ${issue.type}: ${issue.count} ocurrencias`);
          issue.matches.slice(0, 3).forEach(match => {
            console.log(`    - ${match}`);
          });
          if (issue.matches.length > 3) {
            console.log(`    ... y ${issue.matches.length - 3} más`);
          }
        });
      }
    });
  }
  
  console.log('\\n🎯 RECOMENDACIONES:');
  console.log('1. Verificar que todos los números encontrados sean reales');
  console.log('2. Confirmar que las APIs retornen datos de fuentes legítimas');
  console.log('3. Eliminar cualquier dato de prueba/placeholder');
  console.log('4. Asegurar que los fallbacks muestren 0 o "Sin datos" en lugar de números ficticios');
  
  console.log('\\n✅ AUDITORÍA COMPLETADA');
  console.log('=' .repeat(60));
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runCompleteAudit();
}

module.exports = { runCompleteAudit, analyzeFile, scanDirectory };