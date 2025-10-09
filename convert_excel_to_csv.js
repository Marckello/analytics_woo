const XLSX = require('xlsx');
const fs = require('fs');

try {
  console.log('📊 Convirtiendo Excel a CSV...');
  
  // Leer archivo Excel
  console.log('📂 Leyendo: data_historica_nuevo.xls');
  const workbook = XLSX.readFile('./data_historica_nuevo.xls');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convertir a CSV
  console.log('🔄 Convirtiendo a formato CSV...');
  const csvData = XLSX.utils.sheet_to_csv(worksheet);
  
  // Guardar CSV
  const csvPath = './data_historica.csv';
  fs.writeFileSync(csvPath, csvData, 'utf8');
  
  console.log('✅ Conversión completa!');
  console.log(`📁 Archivo CSV guardado: ${csvPath}`);
  
  // Verificar tamaño
  const stats = fs.statSync(csvPath);
  const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`📊 Tamaño del CSV: ${sizeInMB} MB`);
  
  // Contar líneas
  const lines = csvData.split('\n').length - 1; // -1 por la última línea vacía
  console.log(`📋 Total líneas: ${lines}`);
  
} catch (error) {
  console.error('❌ Error convirtiendo Excel:', error.message);
}
