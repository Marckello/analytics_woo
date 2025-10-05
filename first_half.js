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
            
            const ga4Data = result.data;
            console.log('📊 Datos GA4 recibidos:', ga4Data);
            
            // Actualizar usuarios
            document.getElementById('ga4-total-users').textContent = ga4Data.users.totalUsers.toLocaleString();
            document.getElementById('ga4-new-users').textContent = ga4Data.users.newUsers.toLocaleString();
            document.getElementById('ga4-returning-users').textContent = ga4Data.users.returningUsers.toLocaleString();
            
            // Calcular porcentajes
            const totalUsers = ga4Data.users.totalUsers;
            const newPercentage = totalUsers > 0 ? ((ga4Data.users.newUsers / totalUsers) * 100).toFixed(1) : 0;
            const returningPercentage = totalUsers > 0 ? ((ga4Data.users.returningUsers / totalUsers) * 100).toFixed(1) : 0;
            
            document.getElementById('ga4-new-users-percentage').textContent = `${newPercentage}% del total`;
            document.getElementById('ga4-returning-percentage').textContent = `${returningPercentage}% del total`;
            
            // Mostrar páginas más visitadas
            const topPagesContainer = document.getElementById('ga4-top-pages');
            topPagesContainer.innerHTML = '';
            
            ga4Data.pages.slice(0, 5).forEach((page, index) => {
              const pageElement = document.createElement('div');
              pageElement.className = 'flex items-center justify-between p-2 bg-white rounded border';
              pageElement.innerHTML = `
                <div class="flex items-center space-x-2">
                  <span class="w-6 h-6 bg-orange-100 text-orange-600 text-xs font-bold rounded-full flex items-center justify-center">${index + 1}</span>
                  <div>
                    <p class="text-sm font-medium text-gray-800 truncate" style="max-width: 200px;" title="${page.title}">${page.title}</p>
                    <p class="text-xs text-gray-500 truncate" style="max-width: 200px;" title="${page.path}">${page.path}</p>
                  </div>
                </div>
                <span class="text-sm font-semibold text-gray-600">${page.pageViews.toLocaleString()}</span>
              `;
              topPagesContainer.appendChild(pageElement);
            });
            
            // Mostrar países
            const countriesContainer = document.getElementById('ga4-countries');
            countriesContainer.innerHTML = '';
            
            ga4Data.demographics.countries.slice(0, 5).forEach((country, index) => {
              const countryElement = document.createElement('div');
              countryElement.className = 'flex items-center justify-between p-2 bg-white rounded border';
              countryElement.innerHTML = `
                <div class="flex items-center space-x-2">
                  <span class="w-6 h-6 bg-blue-100 text-blue-600 text-xs font-bold rounded-full flex items-center justify-center">${index + 1}</span>
                  <span class="text-sm font-medium text-gray-800">${country.name}</span>
                </div>
                <span class="text-sm font-semibold text-gray-600">${country.users.toLocaleString()}</span>
              `;
              countriesContainer.appendChild(countryElement);
            });
            
            // Mostrar fuentes de tráfico
            const trafficContainer = document.getElementById('ga4-traffic-sources');
            trafficContainer.innerHTML = '';
            
            ga4Data.traffic.slice(0, 4).forEach(source => {
              const sourceElement = document.createElement('div');
              sourceElement.className = 'bg-white rounded-lg p-3 border text-center';
              sourceElement.innerHTML = `
                <p class="text-xs font-medium text-gray-600 uppercase">${source.channel}</p>
                <p class="text-lg font-bold text-gray-900">${source.sessions.toLocaleString()}</p>
                <p class="text-xs text-gray-500">${source.users.toLocaleString()} usuarios</p>
              `;
              trafficContainer.appendChild(sourceElement);
            });
            
            // Mostrar contenido y ocultar loading
            document.getElementById('analytics-loading').classList.add('hidden');
            document.getElementById('analytics-content').classList.remove('hidden');
            
            console.log('✅ Datos GA4 cargados correctamente');
            
          } catch (error) {
            console.error('❌ Error cargando Google Analytics:', error.message);
            
            // Mostrar error state
            document.getElementById('analytics-loading').classList.add('hidden');
            document.getElementById('analytics-content').classList.add('hidden');
            document.getElementById('analytics-error').classList.remove('hidden');
            document.getElementById('analytics-error-message').textContent = error.message;
          }
        }

        // Función para cargar datos de Google Ads
        async function loadGoogleAds() {
          try {
            console.log('🎯 Cargando datos de Google Ads...');
            
            // Verificar que los elementos existan
            const loadingElement = document.getElementById('ads-loading');
            const contentElement = document.getElementById('ads-content');
            const errorElement = document.getElementById('ads-error');
            
            if (!loadingElement || !contentElement || !errorElement) {
              console.error('❌ Elementos Google Ads no encontrados en el DOM');
              return;
            }
            
            // Mostrar loading state
            loadingElement.classList.remove('hidden');
            contentElement.classList.add('hidden');
            errorElement.classList.add('hidden');
            
            // Hacer request a Google Ads API (7 días por defecto)
            const response = await axios.get('/api/ads?days=7');
            const result = response.data;
            
            if (!result.success) {
              throw new Error(result.error || 'Error cargando datos Google Ads');
            }
            
            const adsData = result.data;
            console.log('🎯 Datos Google Ads recibidos:', adsData);
            
            // Actualizar métricas principales
            document.getElementById('ads-total-spend').textContent = '$' + parseFloat(adsData.summary.totalSpend || 0).toLocaleString('es-MX', {minimumFractionDigits: 2});
            document.getElementById('ads-total-clicks').textContent = (adsData.summary.totalClicks || 0).toLocaleString();
            document.getElementById('ads-total-impressions').textContent = (adsData.summary.totalImpressions || 0).toLocaleString();
            document.getElementById('ads-total-conversions').textContent = (adsData.summary.totalConversions || 0).toLocaleString();
            
            // Actualizar métricas adicionales
            document.getElementById('ads-average-ctr').textContent = (adsData.summary.averageCTR || 0) + '%';
            document.getElementById('ads-cost-per-click').textContent = '$' + parseFloat(adsData.summary.costPerClick || 0).toLocaleString('es-MX', {minimumFractionDigits: 2});
            document.getElementById('ads-cost-per-conversion').textContent = '$' + parseFloat(adsData.summary.costPerConversion || 0).toLocaleString('es-MX', {minimumFractionDigits: 2});
            
            // Mostrar top campañas
            const campaignsContainer = document.getElementById('ads-top-campaigns');
            campaignsContainer.innerHTML = '';
            
            if (adsData.campaigns && adsData.campaigns.campaigns && adsData.campaigns.campaigns.length > 0) {
              adsData.campaigns.campaigns.slice(0, 5).forEach((campaign, index) => {
                const campaignElement = document.createElement('div');
                campaignElement.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
                campaignElement.innerHTML = `
                  <div class="flex-1">
                    <p class="font-medium text-gray-900 text-sm truncate">${campaign.name}</p>
                    <div class="flex items-center space-x-3 mt-1">
                      <span class="text-xs text-gray-500">${campaign.clicks.toLocaleString()} clics</span>
                      <span class="text-xs text-gray-500">${campaign.impressions.toLocaleString()} impres.</span>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="font-bold text-gray-900">$${parseFloat(campaign.cost).toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
                    <p class="text-xs text-gray-500">${campaign.ctr}% CTR</p>
                  </div>
                `;
                campaignsContainer.appendChild(campaignElement);
              });
            } else {
              campaignsContainer.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">No hay datos de campañas disponibles</p>';
            }
            
            // Mostrar top keywords
            const keywordsContainer = document.getElementById('ads-top-keywords');
            keywordsContainer.innerHTML = '';
            
            if (adsData.keywords && adsData.keywords.keywords && adsData.keywords.keywords.length > 0) {
              adsData.keywords.keywords.slice(0, 5).forEach((keyword, index) => {
                const keywordElement = document.createElement('div');
                keywordElement.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
                keywordElement.innerHTML = `
                  <div class="flex-1">
                    <p class="font-medium text-gray-900 text-sm truncate">${keyword.keyword}</p>
                    <div class="flex items-center space-x-2 mt-1">
                      <span class="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded">${keyword.matchType}</span>
                      <span class="text-xs text-gray-500">${keyword.clicks} clics</span>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="font-bold text-gray-900">$${parseFloat(keyword.cost).toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
                    <p class="text-xs text-gray-500">${keyword.conversions} conv.</p>
                  </div>
                `;
                keywordsContainer.appendChild(keywordElement);
              });
            } else {
              keywordsContainer.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">No hay datos de keywords disponibles</p>';
            }
            
            // Mostrar contenido y ocultar loading
            document.getElementById('ads-loading').classList.add('hidden');
            document.getElementById('ads-content').classList.remove('hidden');
            
            console.log('✅ Datos Google Ads cargados correctamente');
            
          } catch (error) {
            console.error('❌ Error cargando Google Ads:', error.message);
            
            // Mostrar error state
            document.getElementById('ads-loading').classList.add('hidden');
            document.getElementById('ads-content').classList.add('hidden');
            document.getElementById('ads-error').classList.remove('hidden');
            document.getElementById('ads-error-message').textContent = error.message;
          }
        }

        // Función para actualizar información de comparación
        function updateComparisonInfo(periodInfo) {
          const comparisonInfoDiv = document.getElementById('comparison-period-info');
          const comparisonLabel = document.getElementById('comparison-period-text');
          
          if (!periodInfo || !comparisonLabel) {
            // Si no hay información de comparación o elemento no existe, no hacer nada
            if (comparisonInfoDiv) {
              comparisonInfoDiv.classList.add('hidden');
            }
            return;
          }
          
          let labelText = '';
          const comparisonPeriod = periodInfo.comparisonPeriod || 'auto';
          
          // Crear labels amigables para cada tipo de comparación
          switch (comparisonPeriod) {
            case 'auto':
              labelText = 'vs período anterior equivalente';
              break;
            case 'october-2025':
              labelText = 'vs Octubre 2025';
              break;
            case 'august-2025':
              labelText = 'vs Agosto 2025';
              break;
            case 'september-2025':
              labelText = 'vs Septiembre 2025';
              break;
            case 'july-2025':
              labelText = 'vs Julio 2025';
              break;
            case 'june-2025':
              labelText = 'vs Junio 2025';
              break;
            case 'last-30-days':
              labelText = 'vs Últimos 30 días';
              break;
            case 'last-60-days':
              labelText = 'vs Últimos 60 días';
              break;
            case 'previous-month':
              labelText = 'vs Mes anterior';
              break;
            case 'previous-quarter':
              labelText = 'vs Trimestre anterior';
              break;
            case 'same-month-last-year':
              labelText = 'vs Mismo mes año anterior';
              break;
            default:
              labelText = 'vs período personalizado';
          }
          
          comparisonLabel.textContent = labelText;
          if (comparisonInfoDiv) {
            comparisonInfoDiv.classList.remove('hidden');
          }
        }
        
        // Actualizar UI del dashboard
        function updateDashboardUI() {
          if (!dashboardData) return;

          // Detectar si son datos históricos (estructura diferente)
          const isHistoricalData = dashboardData.dataSource && dashboardData.dataSource.name === 'Datos Históricos';
          
          if (isHistoricalData) {
            // KPIs principales para datos históricos
            document.getElementById('total-sales').textContent = formatCurrency(dashboardData.totalRevenue || 0);
            document.getElementById('avg-ticket').textContent = formatCurrency(dashboardData.averageOrderValue || 0);
            document.getElementById('orders-count').textContent = formatNumber(dashboardData.totalOrders || 0);
            
            // Mostrar indicador de fuente de datos
            updateDataSourceIndicator(dashboardData.dataSource);
            
            // Para datos históricos, mostrar órdenes básicas y ocultar otras secciones
            updateHistoricalOrdersList();
            hideUnavailableSections();
            
          } else {
            // KPIs principales para datos WooCommerce (estructura original)
            document.getElementById('total-sales').textContent = formatCurrency(dashboardData.totalSales30Days);
            document.getElementById('avg-ticket').textContent = formatCurrency(dashboardData.avgTicket30Days);
            document.getElementById('orders-count').textContent = formatNumber(dashboardData.ordersCount30Days);
            
            // Mostrar todas las secciones para WooCommerce
            showAllSections();
          }
            
            // Indicadores comparativos de KPIs principales
            const comparative = dashboardData.comparative;
            if (comparative) {
              document.getElementById('total-sales-change').innerHTML = formatPercentageChange(comparative.totalSales.change);
              document.getElementById('avg-ticket-change').innerHTML = formatPercentageChange(comparative.avgTicket.change);
              document.getElementById('orders-count-change').innerHTML = formatPercentageChange(comparative.ordersCount.change);
            } else {
              document.getElementById('total-sales-change').innerHTML = '';
              document.getElementById('avg-ticket-change').innerHTML = '';
              document.getElementById('orders-count-change').innerHTML = '';
            }

            // Métodos de pago
            const paymentMethods = dashboardData.paymentMethods;
          document.getElementById('stripe-sales').textContent = formatCurrency(paymentMethods.stripe.sales);
          document.getElementById('stripe-percentage').textContent = paymentMethods.stripe.percentage + '%';
          document.getElementById('stripe-orders').textContent = paymentMethods.stripe.orders + ' órdenes';

          document.getElementById('paypal-sales').textContent = formatCurrency(paymentMethods.paypal.sales);
          document.getElementById('paypal-percentage').textContent = paymentMethods.paypal.percentage + '%';
          document.getElementById('paypal-orders').textContent = paymentMethods.paypal.orders + ' órdenes';

          document.getElementById('transfer-sales').textContent = formatCurrency(paymentMethods.transfer.sales);
          document.getElementById('transfer-percentage').textContent = paymentMethods.transfer.percentage + '%';
          document.getElementById('transfer-orders').textContent = paymentMethods.transfer.orders + ' órdenes';
          
            // Indicadores comparativos para métodos de pago
            if (comparative && comparative.paymentMethods) {
            document.getElementById('stripe-sales-change').innerHTML = formatPercentageChange(comparative.paymentMethods.stripe.salesChange);
            document.getElementById('paypal-sales-change').innerHTML = formatPercentageChange(comparative.paymentMethods.paypal.salesChange);
            document.getElementById('transfer-sales-change').innerHTML = formatPercentageChange(comparative.paymentMethods.transfer.salesChange);
          } else {
            document.getElementById('stripe-sales-change').innerHTML = '';
            document.getElementById('paypal-sales-change').innerHTML = '';
            document.getElementById('transfer-sales-change').innerHTML = '';
          }

            // Estados de órdenes
            const orderStates = dashboardData.orderStates;
          document.getElementById('completed-sales').textContent = formatCurrency(orderStates.completed.sales);
          document.getElementById('completed-percentage').textContent = orderStates.completed.percentage + '%';
          document.getElementById('completed-orders').textContent = orderStates.completed.orders + ' órdenes';

          document.getElementById('delivered-sales').textContent = formatCurrency(orderStates.delivered.sales);
          document.getElementById('delivered-percentage').textContent = orderStates.delivered.percentage + '%';
          document.getElementById('delivered-orders').textContent = orderStates.delivered.orders + ' órdenes';

          document.getElementById('processing-sales').textContent = formatCurrency(orderStates.processing.sales);
          document.getElementById('processing-percentage').textContent = orderStates.processing.percentage + '%';
          document.getElementById('processing-orders').textContent = orderStates.processing.orders + ' órdenes';
          
            // Indicadores comparativos para estados de órdenes
            if (comparative && comparative.orderStates) {
            document.getElementById('completed-sales-change').innerHTML = formatPercentageChange(comparative.orderStates.completed.salesChange);
            document.getElementById('delivered-sales-change').innerHTML = formatPercentageChange(comparative.orderStates.delivered.salesChange);
            document.getElementById('processing-sales-change').innerHTML = formatPercentageChange(comparative.orderStates.processing.salesChange);
          } else {
            document.getElementById('completed-sales-change').innerHTML = '';
            document.getElementById('delivered-sales-change').innerHTML = '';
            document.getElementById('processing-sales-change').innerHTML = '';
          }

            // Tipos de cliente (Distribuidor vs Cliente)
            const customerTypes = dashboardData.customerTypes;
          
            // Distribuidores
          document.getElementById('distributors-sales').textContent = formatCurrency(customerTypes.distributors.sales);
          document.getElementById('distributors-percentage').textContent = customerTypes.distributors.percentage + '%';
          document.getElementById('distributors-orders').textContent = customerTypes.distributors.orders + ' órdenes';
          document.getElementById('distributors-customers').textContent = customerTypes.distributors.customers + ' clientes únicos';
          document.getElementById('distributors-avg-ticket').textContent = 'Ticket prom: ' + formatCurrency(customerTypes.distributors.avgTicket);
          document.getElementById('distributors-avg-customer').textContent = 'Por distribuidor: ' + formatCurrency(customerTypes.distributors.avgPerCustomer);

            // Clientes regulares
          document.getElementById('customers-sales').textContent = formatCurrency(customerTypes.customers.sales);
          document.getElementById('customers-percentage').textContent = customerTypes.customers.percentage + '%';
          document.getElementById('customers-orders').textContent = customerTypes.customers.orders + ' órdenes';
          document.getElementById('customers-customers').textContent = customerTypes.customers.customers + ' clientes únicos';
          document.getElementById('customers-avg-ticket').textContent = 'Ticket prom: ' + formatCurrency(customerTypes.customers.avgTicket);
          document.getElementById('customers-avg-customer').textContent = 'Por cliente: ' + formatCurrency(customerTypes.customers.avgPerCustomer);
          
            // Indicadores comparativos para tipos de cliente
            if (comparative && comparative.customerTypes) {
            document.getElementById('distributors-sales-change').innerHTML = formatPercentageChange(comparative.customerTypes.distributors.salesChange);
            document.getElementById('customers-sales-change').innerHTML = formatPercentageChange(comparative.customerTypes.customers.salesChange);
          } else {
            document.getElementById('distributors-sales-change').innerHTML = '';
            document.getElementById('customers-sales-change').innerHTML = '';
          }

            // Top products
            const topProductsHTML = dashboardData.topProducts.map((product, index) => `
            <div class="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-100">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                  ${index + 1}
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-800 truncate max-w-[200px]">${product.name}</p>
                  <p class="text-xs text-gray-500">${formatCurrency(product.avgPrice)} c/u</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm font-bold text-yellow-700">${product.quantity} unidades</p>
                <p class="text-xs text-gray-500">${formatCurrency(product.totalSales)} • ${product.percentage}%</p>
                <p class="text-xs text-gray-500">ID: ${product.id}</p>
              </div>
            </div>
            `).join('');
            document.getElementById('top-products').innerHTML = topProductsHTML;

            // Top orders
          const topOrdersHTML = dashboardData.topOrders.map((order, index) => `
            <div class="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-100">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                  ${index + 1}
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-800">${order.customer}</p>
                  <p class="text-xs text-gray-500">Orden #${order.id}</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm font-bold text-emerald-700">${formatCurrency(order.total)}</p>
                <p class="text-xs text-gray-500">${new Date(order.date).toLocaleDateString('es-MX')}</p>
              </div>
            </div>
            `).join('');
            document.getElementById('top-orders').innerHTML = topOrdersHTML;
            
            // Actualizar labels de período dinámicamente
            updateProductsAndOrdersLabels();
            
            // Actualizar sección unificada de cupones
            updateUnifiedCouponsSection();
            
            // NUEVO: Actualizar secciones de costos de envío e insights
            updateShippingCostsSection();
            updateShippingInsightsSection();
          }

          document.getElementById('loading').classList.add('hidden');
          document.getElementById('dashboard').classList.remove('hidden');
        }

        // Mostrar indicador de fuente de datos para históricos - TEMPORAL COMENTADO
        function updateDataSourceIndicator(dataSource) {
          console.log('📊 Datos históricos detectados:', dataSource.name);
          // Función temporalmente simplificada para evitar errores JS
        }

        // Ocultar secciones no disponibles para datos históricos - TEMPORAL COMENTADO  
        function hideUnavailableSections() {
          console.log('📊 Función hideUnavailableSections llamada');
          return; // Temporalmente deshabilitada
          /*
          const sectionsToHide = [
            'payment-methods-section',
            'order-states-section', 
            'customer-types-section',
            'top-products-section',
            'coupon-analysis-section',
            'shipping-costs-section'
          ];
          
          sectionsToHide.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
              section.style.display = 'none';
            }
          });
          
          // Mostrar mensaje informativo
}
