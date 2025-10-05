        // Variables globales
        let dashboardData = null;
        let activePeriod = 'september-2025';
        let comparisonEnabled = true; // Simplificado: solo on/off
        let customDateRange = null;

        // Función para formatear números como moneda MXN
        const formatCurrency = (amount) => {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 2
          }).format(amount);
        };

        // Función para formatear números grandes
        const formatNumber = (num) => {
          return new Intl.NumberFormat('es-MX').format(num);
        };

        // Función para manejar cambio de período
        function changePeriod() {
          const selector = document.getElementById('period-selector');
          const selectedPeriod = selector.value;
          
          if (selectedPeriod === 'custom') {
            showCustomDatePanel();
          } else {
            hideCustomDatePanel();
            activePeriod = selectedPeriod;
            
            // Actualizar texto de comparación
            if (comparisonEnabled) {
              updateComparisonPeriodText();
            }
            
            loadDashboard();
          }
        }
        
        // Función para activar/desactivar comparación
        function toggleComparison() {
          const checkbox = document.getElementById('enable-comparison');
          const infoPanel = document.getElementById('comparison-period-info');
          
          comparisonEnabled = checkbox.checked;
          
          if (comparisonEnabled) {
            infoPanel.classList.remove('hidden');
            updateComparisonPeriodText();
          } else {
            infoPanel.classList.add('hidden');
          }
          
          console.log('Comparación:', comparisonEnabled ? 'activada' : 'desactivada');
          
          // Recargar dashboard
          loadDashboard();
        }
        
        // Función para actualizar el texto del período de comparación
        function updateComparisonPeriodText() {
          const textElement = document.getElementById('comparison-period-text');
          if (!textElement) return;
          
          let comparisonText = '';
          
          // Determinar qué período se está comparando basado en el período principal
          switch (activePeriod) {
            case 'today':
              comparisonText = 'vs Ayer';
              break;
            case 'yesterday':
              comparisonText = 'vs Anteayer';
              break;
            case 'last-7-days':
              comparisonText = 'vs 7 días anteriores';
              break;
            case 'last-30-days':
              comparisonText = 'vs 30 días anteriores';
              break;
            case 'this-month':
              comparisonText = 'vs Mes anterior';
              break;
            case 'last-month':
              comparisonText = 'vs 2 meses atrás';
              break;
            case 'october-2025':
              comparisonText = 'vs Septiembre 2025';
              break;
            case 'august-2025':
              comparisonText = 'vs Julio 2025';
              break;
            case 'september-2025':
              comparisonText = 'vs Agosto 2025';
              break;

            case 'custom':
              comparisonText = 'vs Período anterior equivalente';
              break;
            default:
              comparisonText = 'vs Período anterior equivalente';
          }
          
          textElement.textContent = comparisonText;
        }

        // Mostrar panel de fechas personalizadas
        function showCustomDatePanel() {
          const panel = document.getElementById('custom-date-panel');
          panel.classList.remove('hidden');
          
          // Establecer fechas por defecto (agosto 2025)
          document.getElementById('start-date').value = '2025-08-01';
          document.getElementById('end-date').value = '2025-09-30';
        }

        // Ocultar panel de fechas personalizadas
        function hideCustomDatePanel() {
          const panel = document.getElementById('custom-date-panel');
          panel.classList.add('hidden');
          customDateRange = null;
        }

        // Aplicar fechas personalizadas
        function applyCustomDates() {
          const startDate = document.getElementById('start-date').value;
          const endDate = document.getElementById('end-date').value;
          
          if (!startDate || !endDate) {
            alert('Por favor selecciona ambas fechas');
            return;
          }
          
          if (new Date(startDate) > new Date(endDate)) {
            alert('La fecha de inicio debe ser anterior a la fecha final');
            return;
          }
          
          customDateRange = { start: startDate, end: endDate };
          activePeriod = 'custom';
          hideCustomDatePanel();
          
          // Actualizar texto de comparación
          if (comparisonEnabled) {
            updateComparisonPeriodText();
          }
          
          loadDashboard();
        }

        // Cancelar fechas personalizadas
        function cancelCustomDates() {
          hideCustomDatePanel();
          
          // Resetear selector a valor anterior
          const selector = document.getElementById('period-selector');
          selector.value = activePeriod;
        }

        // Función para actualizar filtros de estado de órdenes
        function updateOrderStatusFilter() {
          // Recargar dashboard con nuevos filtros
          loadDashboard();
        }

        // Presets de filtros
        function applyWooCommercePreset() {
          // Activar solo completed, processing y delivered
          document.getElementById('status-completed').checked = true;
          document.getElementById('status-delivered').checked = true;
          document.getElementById('status-processing').checked = true;
          document.getElementById('status-on-hold').checked = false;
          document.getElementById('status-pending').checked = false;
          updateOrderStatusFilter();
        }

        function applyConservativePreset() {
          // Solo completed
          document.getElementById('status-completed').checked = true;
          document.getElementById('status-delivered').checked = false;
          document.getElementById('status-processing').checked = false;
          document.getElementById('status-on-hold').checked = false;
          document.getElementById('status-pending').checked = false;
          updateOrderStatusFilter();
        }

        function applyAllStatusPreset() {
          // Todos los estados
          document.getElementById('status-completed').checked = true;
          document.getElementById('status-delivered').checked = true;
          document.getElementById('status-processing').checked = true;
          document.getElementById('status-on-hold').checked = true;
          document.getElementById('status-pending').checked = true;
          updateOrderStatusFilter();
        }

        // Obtener estados activos
        function getActiveStatuses() {
          const statuses = [];
          if (document.getElementById('status-completed').checked) statuses.push('completed');
          if (document.getElementById('status-delivered').checked) statuses.push('delivered');
          if (document.getElementById('status-processing').checked) statuses.push('processing');
          if (document.getElementById('status-on-hold').checked) statuses.push('on-hold');
          if (document.getElementById('status-pending').checked) statuses.push('pending');
          return statuses;
        }

        // Función para verificar si token está expirado
        function isTokenExpired(token) {
          if (!token) return true;
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const currentTime = Math.floor(Date.now() / 1000);
            return payload.exp < currentTime;
          } catch (error) {
            return true;
          }
        }

        // Función para verificar autenticación antes de cargar dashboard
        function checkAuthBeforeLoad() {
          const token = localStorage.getItem('auth_token');
          
          // Si no hay token, redirigir inmediatamente
          if (!token) {
            console.log('No hay token, redirigiendo a login');
            localStorage.clear();
            window.location.href = '/login';
            return false;
          }
          
          // Verificar si el token está expirado
          if (isTokenExpired(token)) {
            console.log('Token expirado, redirigiendo a login');
            localStorage.clear();
            window.location.href = '/login';
            return false;
          }
          
          // Verificar formato válido del token (debe tener 3 partes separadas por puntos)
          const tokenParts = token.split('.');
          if (tokenParts.length !== 3) {
            console.log('Token con formato inválido, redirigiendo a login');
            localStorage.clear();
            window.location.href = '/login';
            return false;
          }
          
          return true;
        }

        // Función para obtener fechas de períodos históricos
        function getHistoricalPeriodDates(period) {
          const dates = {
            'historical-2025-h1': { start: '2025-01-01', end: '2025-06-30' },
            'historical-2024-full': { start: '2024-01-01', end: '2024-12-31' },
            'historical-2023-full': { start: '2023-01-01', end: '2023-12-31' },
            'historical-2022-full': { start: '2022-01-01', end: '2022-12-31' },
            'historical-2021-full': { start: '2021-01-01', end: '2021-12-31' },
            'historical-2020-full': { start: '2020-01-01', end: '2020-12-31' },
            'historical-all-time': { start: '2020-01-01', end: '2025-07-31' }
          };
          
          return dates[period] || { start: '2025-01-01', end: '2025-07-31' };
        }

        // Cargar dashboard
        async function loadDashboard() {
          // Verificar autenticación antes de proceder
          if (!checkAuthBeforeLoad()) {
            return;
          }
          
          try {
            document.getElementById('loading').classList.remove('hidden');
            document.getElementById('dashboard').classList.add('hidden');
            document.getElementById('error').classList.add('hidden');

            // Construir parámetros de query
            let queryParams = new URLSearchParams();
            
            // Período
            if (customDateRange) {
              queryParams.set('start_date', customDateRange.start);
              queryParams.set('end_date', customDateRange.end);
            } else {
              queryParams.set('period', activePeriod);
            }
            
            // Filtros de estado
            const activeStatuses = getActiveStatuses();
            queryParams.set('status_filters', activeStatuses.join(','));
            
            // Período de comparación (simplificado)
            if (comparisonEnabled) {
              queryParams.set('enableComparison', 'true');
              queryParams.set('comparison_period', 'auto'); // Siempre automático
            }

            console.log('Haciendo request a dashboard con params:', queryParams.toString());
            
            // Detectar si es un período histórico
            const isHistoricalPeriod = activePeriod && activePeriod.startsWith('historical-');
            let apiEndpoint = '/api/dashboard';
            
            if (isHistoricalPeriod) {
              // Configurar fechas para períodos históricos
              const historicalDates = getHistoricalPeriodDates(activePeriod);
              queryParams.set('start_date', historicalDates.start);
              queryParams.set('end_date', historicalDates.end);
              queryParams.set('source', 'historical');
              apiEndpoint = '/api/historical-data';
              
              console.log('📊 Usando datos históricos:', historicalDates);
            }
            
            // Usar axios que ya tiene configurado el Authorization header
            const response = await axios.get(`${apiEndpoint}?${queryParams.toString()}`);
            const result = response.data;

            console.log('Respuesta del API:', result);
            console.log('Success value:', result.success, typeof result.success);

            // Manejar diferentes estructuras de respuesta
            let processedData, debugInfo, statusBreakdown;
            
            if (isHistoricalPeriod) {
              // Respuesta de /api/historical-data: { statistics, orders, sources }
              if (!result || !result.statistics) {
                console.error('Historical API response failed:', result);
                throw new Error(result?.error || result?.message || 'Error de API datos históricos - respuesta inválida');
              }
              
              // Adaptar estructura de datos históricos a formato dashboard
              processedData = {
                // Estadísticas principales
                totalRevenue: result.statistics.totalRevenue || 0,
                totalOrders: result.statistics.totalOrders || 0,
                averageOrderValue: result.statistics.averageOrderValue || 0,
                
                // Órdenes para tabla
                orders: result.orders || [],
                
                // Información de fuente de datos
                dataSource: {
                  name: 'Datos Históricos',
                  period: activePeriod,
                  sources: result.sources || { historical: 0, woocommerce: 0, total: 0 }
                }
              };
              
              debugInfo = {
                periodInfo: {
                  displayName: 'Histórico - ' + activePeriod.replace('historical-', '').toUpperCase(),
                  dateRange: queryParams.get('start_date') + ' a ' + queryParams.get('end_date'),
                  source: 'historical',
                  orderCount: result.statistics.totalOrders || 0
                },
                statusBreakdownAll: {
                  completed: result.orders?.filter(o => o.status === 'completed')?.length || 0,
                  processing: result.orders?.filter(o => o.status === 'processing')?.length || 0,
                  pending: result.orders?.filter(o => o.status === 'pending')?.length || 0,
                  'on-hold': result.orders?.filter(o => o.status === 'on-hold')?.length || 0,
                  delivered: result.orders?.filter(o => o.status === 'delivered')?.length || 0
                }
              };
              
              console.log('📊 Procesando datos históricos:', processedData);
              
            } else {
              // Respuesta normal de /api/dashboard: { success, data, debug }
              if (!result || result.success !== true) {
                console.error('API response failed:', result);
                throw new Error(result?.error || result?.message || 'Error de API - respuesta inválida');
              }
              
              processedData = result.data;
              debugInfo = result.debug;
            }

            dashboardData = processedData;
            updateDashboardUI();
            updatePeriodDisplay(debugInfo?.periodInfo);
            updateStatusCounters(debugInfo?.statusBreakdownAll || {});
            updateComparisonInfo(processedData?.comparative?.periodInfo);
            
            // Habilitar chat después de cargar datos
            enableChat();

          } catch (error) {
            console.error('Error loading dashboard:', error);
            console.error('Error stack:', error.stack);
            console.error('Error response:', error.response);
            
            // Determinar tipo de error y mostrar mensaje apropiado
            let errorTitle = 'Error Inesperado';
            let errorMessage = 'Ocurrió un error inesperado: ' + error.message;
            
            // Verificar si es error de autenticación (token expirado/inválido)
            const isTokenError = (
              (error.response && error.response.status === 401) ||
              (error.message && error.message.includes('Token')) ||
              (error.response && error.response.data && error.response.data.error && 
               (error.response.data.error.includes('Token') || 
                error.response.data.error.includes('token') ||
                error.response.data.error.includes('inválido') ||
                error.response.data.error.includes('expirado')))
            );
            
            if (isTokenError) {
              errorTitle = 'Sesión Expirada';
              errorMessage = 'Tu sesión ha expirado. Redirigiendo al login...';
              // Limpiar completamente el localStorage
              localStorage.removeItem('auth_token');
              localStorage.removeItem('user_info');
              localStorage.clear(); // Limpieza adicional por seguridad
              console.log('Token inválido detectado - Limpiando localStorage y redirigiendo');
              setTimeout(() => {
                window.location.href = '/login';
              }, 2000);
            } else if (error.response && error.response.status >= 500) {
              errorTitle = 'Error del Servidor';
              errorMessage = 'Error interno del servidor. Por favor, intenta más tarde.';
            } else if (error.message.includes('Network Error')) {
              errorTitle = 'Error de Conectividad';
              errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
            } else if (error.response && error.response.data && error.response.data.error) {
              // Si el error menciona token o autenticación
              if (error.response.data.error.includes('Token') || error.response.data.error.includes('token')) {
                errorTitle = 'Problema de Autenticación';
                errorMessage = 'Error de autenticación. Redirigiendo al login...';
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_info');
                setTimeout(() => {
                  window.location.href = '/login';
                }, 2000);
              } else {
                errorTitle = 'Error de API';
                errorMessage = error.response.data.error;
              }
            }
            
            // Mostrar error con detalles específicos
            document.getElementById('error-title').textContent = errorTitle;
            document.getElementById('error-message').textContent = errorMessage;
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('error').classList.remove('hidden');
            document.getElementById('dashboard').classList.add('hidden');
          }
        }

        // Función auxiliar para formatear cambios porcentuales
        function formatPercentageChange(change, showIcon = true) {
          if (change === null || change === undefined || isNaN(change)) {
            return showIcon ? '<span class="text-gray-400 text-xs"><i class="fas fa-minus"></i></span>' : '--';
          }
          
          const isPositive = change >= 0;
          const bgClass = isPositive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200';
          const iconClass = isPositive ? 'fas fa-arrow-up' : 'fas fa-arrow-down';
          const prefix = isPositive ? '+' : '';
          
          if (showIcon) {
            return `<span class="${bgClass} text-xs font-semibold px-2 py-1 rounded-full border inline-flex items-center space-x-1"><i class="${iconClass} text-xs"></i><span>${prefix}${Math.abs(change).toFixed(1)}%</span></span>`;
          } else {
            return `<span class="${bgClass} px-2 py-1 rounded text-xs font-medium">${prefix}${change.toFixed(1)}%</span>`;
          }
        }

        // Función para cargar datos de Google Analytics 4
        async function loadAnalytics() {
          try {
            console.log('🔍 Cargando datos de Google Analytics 4...');
            
            // Verificar que los elementos existan
            const loadingElement = document.getElementById('analytics-loading');
            const contentElement = document.getElementById('analytics-content');
            const errorElement = document.getElementById('analytics-error');
            
            if (!loadingElement || !contentElement || !errorElement) {
              console.error('❌ Elementos GA4 no encontrados en el DOM');
              console.error('Loading element:', loadingElement);
              console.error('Content element:', contentElement);
              console.error('Error element:', errorElement);
              return;
            }
            
            // Mostrar loading state
            loadingElement.classList.remove('hidden');
            contentElement.classList.add('hidden');
            errorElement.classList.add('hidden');
            
            // Hacer request a GA4 API (7 días por defecto)
            const response = await axios.get('/api/analytics?days=7');
            const result = response.data;
            
            if (!result.success) {
              throw new Error(result.error || 'Error cargando datos GA4');
            }
