const XLSX = require('xlsx');

try {
  console.log('📊 Leyendo estructura del Excel...');
  
  // Leer el archivo Excel
  const workbook = XLSX.readFile('./data_historica_nuevo.xls');
  
  // Obtener nombres de las hojas
  const sheetNames = workbook.SheetNames;
  console.log('📋 Hojas encontradas:', sheetNames);
  
  // Leer la primera hoja
  const firstSheet = workbook.Sheets[sheetNames[0]];
  
  // Convertir a JSON para analizar estructura
  const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
  
  console.log('📊 Estructura encontrada:');
  console.log('- Total filas:', data.length);
  
  if (data.length > 0) {
    console.log('- Columnas (primera fila):', data[0]);
    console.log('- Total columnas:', data[0].length);
  }
  
  if (data.length > 1) {
    console.log('- Muestra de datos (segunda fila):', data[1]);
  }
  
  if (data.length > 2) {
    console.log('- Muestra de datos (tercera fila):', data[2]);
  }
  
  // Verificar si hay datos por meses
  console.log('\n🗓️ Analizando fechas...');
  let fechasEncontradas = [];
  
  for (let i = 1; i < Math.min(data.length, 10); i++) {
    if (data[i] && data[i].length > 0) {
      // Buscar columna de fecha (puede estar en diferentes posiciones)
      for (let j = 0; j < data[i].length; j++) {
        const valor = data[i][j];
        if (valor && typeof valor === 'string' && valor.includes('/')) {
          fechasEncontradas.push(valor);
          break;
        }
      }
    }
  }
  
  console.log('- Fechas encontradas (muestra):', fechasEncontradas.slice(0, 5));
  
} catch (error) {
  console.error('❌ Error leyendo Excel:', error.message);
}
