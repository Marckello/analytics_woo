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

        // Mostrar indicador de fuente de datos para históricos
        function updateDataSourceIndicator(dataSource) {
          // Agregar indicador en la parte superior del dashboard
          const dashboardHeader = document.querySelector('#dashboard h1');
          if (dashboardHeader && !document.getElementById('data-source-indicator')) {
            const indicator = document.createElement('div');
            indicator.id = 'data-source-indicator';
            indicator.className = 'mt-2 mb-4';
            indicator.innerHTML = 
              '<div class="bg-purple-50 border border-purple-200 rounded-lg p-3">' +
                '<div class="flex items-center justify-between">' +
                  '<div class="flex items-center space-x-2">' +
                    '<i class="fas fa-shopping-bag text-purple-600"></i>' +
                    '<span class="text-purple-800 font-medium">Datos Históricos Excel</span>' +
                  '</div>' +
                  '<div class="text-sm text-purple-600">' +
                    '<i class="fas fa-database mr-1"></i>' +
                    'Históricos: ' + dataSource.sources.historical + ' • WooCommerce: ' + dataSource.sources.woocommerce + ' • Total: ' + dataSource.sources.total +
                  '</div>' +
                '</div>' +
              '</div>';
            dashboardHeader.after(indicator);
          }
        }

        // Ocultar secciones no disponibles para datos históricos
        function hideUnavailableSections() {
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
          showHistoricalLimitationsMessage();
        }

        // Mostrar todas las secciones para WooCommerce
        function showAllSections() {
          const sectionsToShow = [
            'payment-methods-section',
            'order-states-section',
            'customer-types-section', 
            'top-products-section',
            'coupon-analysis-section',
            'shipping-costs-section'
          ];
          
          sectionsToShow.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
              section.style.display = '';
            }
          });
          
          // Remover indicador de históricos si existe
          const indicator = document.getElementById('data-source-indicator');
          if (indicator) indicator.remove();
          
          // Remover mensaje de limitaciones
          const limitationsMsg = document.getElementById('historical-limitations-message');
          if (limitationsMsg) limitationsMsg.remove();
        }

        // Mostrar mensaje sobre limitaciones de datos históricos
        function showHistoricalLimitationsMessage() {
          if (document.getElementById('historical-limitations-message')) return;
          
          const dashboardContent = document.getElementById('dashboard');
          const message = document.createElement('div');
          message.id = 'historical-limitations-message';
          message.className = 'mb-6';
          message.innerHTML = `
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div class="flex items-start space-x-3">
                <i class="fas fa-info-circle text-blue-600 mt-1"></i>
                <div>
                  <h4 class="text-blue-800 font-medium mb-2">Datos Históricos Excel</h4>
                  <p class="text-blue-700 text-sm mb-2">
                    Estás viendo datos históricos importados desde Excel. Las siguientes secciones están disponibles:
                  </p>
                  <ul class="text-blue-700 text-sm space-y-1">
                    <li>✅ Estadísticas principales (ingresos, órdenes, ticket promedio)</li>
                    <li>✅ Lista de órdenes con detalles básicos</li>
                  </ul>
                  <p class="text-blue-700 text-sm mt-2">
                    <strong>Nota:</strong> Los análisis detallados de métodos de pago, productos y cupones están disponibles solo para períodos posteriores a agosto 2025 con datos de WooCommerce.
                  </p>
                </div>
              </div>
            </div>
          `;
          
          // Insertar después del indicador de fuente de datos
          const indicator = document.getElementById('data-source-indicator');
          if (indicator) {
            indicator.after(message);
          } else {
            dashboardContent.prepend(message);
          }
        }

        // Actualizar lista de órdenes históricas
        function updateHistoricalOrdersList() {
          if (!dashboardData.orders) return;
          
          // Tomar las primeras 10 órdenes para mostrar
          const ordersToShow = dashboardData.orders.slice(0, 10);
          
          const ordersHTML = ordersToShow.map((order, index) => {
            const statusClass = order.status === 'completed' ? 'bg-green-100 text-green-800' : 
              order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
              order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800';
            
            return `
            <div class="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                  ` + (index + 1) + `
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-800">` + (order.customer_email || 'Cliente') + `</p>
                  <p class="text-xs text-gray-500">Orden #` + order.id + `</p>
                  <p class="text-xs text-purple-600 font-medium">📊 Histórico</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm font-bold text-purple-700">` + formatCurrency(order.total) + `</p>
                <p class="text-xs text-gray-500">` + new Date(order.date_created).toLocaleDateString('es-MX') + `</p>
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ` + statusClass + `">` + order.status + `</span>
              </div>
            </div>
          `;
          }).join('');
          
          // Actualizar la sección de top orders con datos históricos
          const topOrdersContainer = document.getElementById('top-orders');
          if (topOrdersContainer) {
            topOrdersContainer.innerHTML = ordersHTML;
          }
          
          // Actualizar el título de la sección para reflejar históricos
          const topOrdersTitle = document.querySelector('#top-products-section h3');
          if (topOrdersTitle && topOrdersTitle.textContent.includes('Órdenes')) {
            topOrdersTitle.innerHTML = `
              <i class="fas fa-shopping-bag mr-2 text-purple-600"></i>
              Órdenes Históricas - Últimas 10
            `;
          }
        }

        // Actualizar display del período activo
        function updatePeriodDisplay(periodInfo) {
          if (!periodInfo) return;
          
          const display = document.getElementById('active-period-display');
          
          // Si es un período histórico, mostrar información especial
          if (periodInfo.source === 'historical') {
            display.innerHTML = 
              '<div class="flex items-center space-x-2">' +
                '<span class="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-semibold">' +
                  '<i class="fas fa-chart-bar mr-1"></i>HISTÓRICO' +
                '</span>' +
                '<span class="font-medium">' + periodInfo.displayName + '</span>' +
                '<span class="text-gray-500 text-sm">(' + periodInfo.dateRange + ')</span>' +
              '</div>';
          } else {
            // Display normal para WooCommerce
            display.textContent = periodInfo.label || periodInfo.displayName || 'Período Actual';
          }
        }

        // Actualizar labels de período para productos y órdenes
        function updateProductsAndOrdersLabels() {
          // Obtener el período actual desde el selector
          const periodSelector = document.getElementById('period-selector');
          const selectedPeriod = periodSelector.value;
          
          let periodLabel = '';
          
          // Mapear los valores del selector a labels amigables
          switch(selectedPeriod) {
            case 'october-2025':
              periodLabel = 'Octubre 2025';
              break;

            case 'august-2025':
              periodLabel = 'Agosto 2025';
              break;
            case 'september-2025':
              periodLabel = 'Septiembre 2025';
              break;
            case 'previous-month':
              periodLabel = 'Mes Anterior';
              break;
            case 'current-month':
              periodLabel = 'Mes Actual';
              break;
            case 'last-7-days':
              periodLabel = 'Últimos 7 días';
              break;
            case 'last-30-days':
              periodLabel = 'Últimos 30 días';
              break;
            case 'custom':
              if (customDateRange) {
                const startDate = new Date(customDateRange.start).toLocaleDateString('es-MX');
                const endDate = new Date(customDateRange.end).toLocaleDateString('es-MX');
                periodLabel = startDate + ' - ' + endDate;
              } else {
                periodLabel = 'Período Personalizado';
              }
              break;
            default:
              periodLabel = 'Período Actual';
          }
          
          // Actualizar los labels
          document.getElementById('products-period-label').textContent = 'Más vendidos (' + periodLabel + ')';
          document.getElementById('orders-period-label').textContent = 'Mayor valor (' + periodLabel + ')';
        }

        // Actualizar contadores de estados
        function updateStatusCounters(statusBreakdown) {
          document.getElementById('count-completed').textContent = statusBreakdown.completed || 0;
          document.getElementById('count-delivered').textContent = statusBreakdown.delivered || 0;
          document.getElementById('count-processing').textContent = statusBreakdown.processing || 0;
          document.getElementById('count-on-hold').textContent = statusBreakdown['on-hold'] || 0;
          document.getElementById('count-pending').textContent = statusBreakdown.pending || 0;
          
          // Actualizar display de estados activos
          const activeStatuses = getActiveStatuses();
          const statusNames = {
            'completed': 'Completadas',
            'delivered': 'Entregadas', 
            'processing': 'En Proceso',
            'on-hold': 'En Espera',
            'pending': 'Pendientes'
          };
          
          const activeStatusDisplay = activeStatuses.map(s => statusNames[s]).join(', ');
          document.getElementById('active-statuses-display').textContent = activeStatusDisplay;
        }

        // Actualizar sección de cupones
        // FUNCIÓN UNIFICADA: Actualizar sección de cupones (tradicionales + envío gratis)
        function updateUnifiedCouponsSection() {
          if (!dashboardData || (!dashboardData.coupons && !dashboardData.freeShippingCoupons)) {
            document.getElementById('coupons-loading').classList.add('hidden');
            document.getElementById('coupons-empty').classList.remove('hidden');
            document.getElementById('coupons-grid').classList.add('hidden');
            document.getElementById('coupons-summary').classList.add('hidden');
            return;
          }
          
          const couponsData = dashboardData.coupons || { couponsUsed: [], totalAmount: 0, totalOrders: 0 };
          const freeShippingData = dashboardData.freeShippingCoupons || { couponsBreakdown: [], totalRealCost: 0, totalOrders: 0 };
          const comparative = dashboardData.comparative;
          
          // Ocultar loading
          document.getElementById('coupons-loading').classList.add('hidden');
          
          // Si no hay cupones de ningún tipo
          if (couponsData.couponsUsed.length === 0 && freeShippingData.couponsBreakdown.length === 0) {
            document.getElementById('coupons-empty').classList.remove('hidden');
            document.getElementById('coupons-grid').classList.add('hidden');
            document.getElementById('coupons-summary').classList.add('hidden');
            // Resetear valores por defecto
            document.getElementById('total-coupons-amount').innerHTML = '$0 MXN';
            document.getElementById('total-coupons-orders').textContent = '0';
            document.getElementById('total-coupons-percentage').textContent = '0% del total de ventas';
            return;
          }
          
          // Mostrar cupones
          document.getElementById('coupons-empty').classList.add('hidden');
          document.getElementById('coupons-grid').classList.remove('hidden');
          document.getElementById('coupons-summary').classList.remove('hidden');
          
          // Filtrar cupones tradicionales (excluir códigos de envío gratis)
          // NOTA: 'guiapropia' ahora aparece como cupón tradicional (cliente paga su propio envío)
          const freeShippingCodes = ['enviodist', 'envío gratis', 'envio gratis', 'free_shipping'];
          const traditionalCoupons = couponsData.couponsUsed.filter(coupon => 
            !freeShippingCodes.includes(coupon.code.toLowerCase())
          );
          
          // Generar HTML para cupones tradicionales
          const traditionalCouponsHTML = traditionalCoupons.map((coupon, index) => {
            const bgColors = [
              'from-orange-50 to-red-50 border-orange-100',
              'from-amber-50 to-yellow-50 border-amber-100',
              'from-rose-50 to-pink-50 border-rose-100',
              'from-violet-50 to-purple-50 border-violet-100',
              'from-cyan-50 to-blue-50 border-cyan-100'
            ];
            const iconColors = [
              'bg-orange-500',
              'bg-amber-500', 
              'bg-rose-500',
              'bg-violet-500',
              'bg-cyan-500'
            ];
            const textColors = [
              'text-orange-600 bg-orange-100',
              'text-amber-600 bg-amber-100',
              'text-rose-600 bg-rose-100', 
              'text-violet-600 bg-violet-100',
              'text-cyan-600 bg-cyan-100'
            ];
            
            const colorIndex = index % bgColors.length;
            
            return `
              <div class="bg-gradient-to-r ${bgColors[colorIndex]} rounded-xl p-4 border">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center space-x-2">
                    <div class="p-2 rounded-lg ${iconColors[colorIndex]}">
                      <i class="fas fa-tag text-sm text-white"></i>
                    </div>
                    <div>
                      <p class="text-xs font-medium text-gray-600">Cupón Descuento</p>
                      <p class="text-sm font-bold text-gray-900 break-all">${coupon.code}</p>
                    </div>
                  </div>
                  <span class="text-xs font-bold ${textColors[colorIndex]} px-2 py-1 rounded-full">${coupon.percentage}%</span>
                </div>
                <div class="space-y-1">
                  <div class="flex items-center justify-between">
                    <p class="text-xs text-gray-500">Total descontado:</p>
                    <p class="text-sm font-bold text-gray-900">${formatCurrency(coupon.totalDiscount)}</p>
                  </div>
                  <div class="flex items-center justify-between">
                    <p class="text-xs text-gray-500">Órdenes:</p>
                    <p class="text-sm font-medium text-gray-700">${coupon.ordersCount}</p>
                  </div>
                  <div class="flex items-center justify-between">
                    <p class="text-xs text-gray-500">Promedio/orden:</p>
                    <p class="text-sm font-medium text-gray-700">${formatCurrency(coupon.avgDiscountPerOrder)}</p>
                  </div>
                </div>
              </div>
            `;
          }).join('');
          
          // Generar HTML para cupones de envío gratis
          const freeShippingCouponsHTML = freeShippingData.couponsBreakdown.map((coupon, index) => {
            const bgColors = [
              'from-red-50 to-pink-50 border-red-100',
              'from-purple-50 to-indigo-50 border-purple-100',
              'from-blue-50 to-cyan-50 border-blue-100',
              'from-green-50 to-emerald-50 border-green-100'
            ];
            const iconColors = [
              'bg-red-500',
              'bg-purple-500', 
              'bg-blue-500',
              'bg-green-500'
            ];
            
            const colorIndex = index % bgColors.length;
            
            return `
              <div class="bg-gradient-to-r ${bgColors[colorIndex]} rounded-xl p-4 border">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center space-x-2">
                    <div class="p-2 rounded-lg ${iconColors[colorIndex]}">
                      <i class="fas fa-shipping-fast text-sm text-white"></i>
                    </div>
                    <div>
                      <p class="text-xs font-medium text-gray-600">Envío Gratis</p>
                      <p class="text-sm font-bold text-gray-900 break-all">${coupon.code}</p>
                    </div>
                  </div>
                  <span class="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">COSTO REAL</span>
                </div>
                <div class="space-y-1">
                  <div class="flex items-center justify-between">
                    <p class="text-xs text-gray-500">Costo absorbido:</p>
                    <p class="text-sm font-bold text-red-600">${formatCurrency(coupon.totalRealCost)}</p>
                  </div>
                  <div class="flex items-center justify-between">
                    <p class="text-xs text-gray-500">Órdenes:</p>
                    <p class="text-sm font-medium text-gray-700">${coupon.ordersCount}</p>
                  </div>
                  <div class="flex items-center justify-between">
                    <p class="text-xs text-gray-500">Promedio/orden:</p>
                    <p class="text-sm font-medium text-gray-700">${formatCurrency(coupon.avgCostPerOrder)}</p>
                  </div>
                </div>
              </div>
            `;
          }).join('');
          
          // Combinar ambos tipos de cupones
          document.getElementById('coupons-grid').innerHTML = traditionalCouponsHTML + freeShippingCouponsHTML;
          
          // Calcular totales combinados
          const totalDiscountAmount = couponsData.totalAmount || 0;
          const totalFreeShippingCost = freeShippingData.totalRealCost || 0;
          const totalCombinedImpact = totalDiscountAmount + totalFreeShippingCost;
          const totalCombinedOrders = (couponsData.totalOrders || 0) + (freeShippingData.totalOrders || 0);
          
          // Calcular porcentaje del total de ventas
          const totalSales = dashboardData.totalSales30Days || dashboardData.revenue || 0;
          const percentageOfSales = totalSales > 0 ? ((totalCombinedImpact / totalSales) * 100).toFixed(1) : '0';
          
          // Actualizar resumen con datos combinados
          document.getElementById('total-coupons-amount').innerHTML = `
            <div>
              <div class="text-xl font-bold text-gray-900">${formatCurrency(totalCombinedImpact)} MXN</div>
              <div class="text-xs text-gray-500 mt-1">
                <span class="text-orange-600">Descuentos: ${formatCurrency(totalDiscountAmount)}</span> • 
                <span class="text-red-600">Envío gratis: ${formatCurrency(totalFreeShippingCost)}</span>
              </div>
              <div class="text-xs font-medium text-blue-600 mt-1">
                ${percentageOfSales}% del total de ventas
              </div>
            </div>
          `;
          document.getElementById('total-coupons-orders').textContent = formatNumber(totalCombinedOrders);
          
          // Usar la variable totalSales ya declarada arriba
          const percentageOfSales2 = totalSales > 0 ? ((totalCombinedImpact / totalSales) * 100).toFixed(1) : '0';
          document.getElementById('total-coupons-percentage').textContent = percentageOfSales2 + '% del total de ventas';
          
          // Mostrar indicador comparativo si disponible
          if (comparative && comparative.coupons) {
            document.getElementById('total-coupons-change').innerHTML = formatPercentageChange(comparative.coupons.amountChange);
          } else {
            document.getElementById('total-coupons-change').innerHTML = '';
          }
        }

        // FUNCIÓN ACTUALIZADA: Actualizar sección de costos de envío reales
        function updateShippingCostsSection() {
          if (!dashboardData || !dashboardData.shippingCosts) {
            // Si no hay datos, mostrar valores por defecto solo en elementos que existen
            const totalRealElement = document.getElementById('shipping-total-real');
            if (totalRealElement) totalRealElement.textContent = '$0 MXN';
            
            const ordersFoundElement = document.getElementById('shipping-orders-found');
            if (ordersFoundElement) ordersFoundElement.textContent = '0 envíos encontrados';
            
            const avgRealElement = document.getElementById('shipping-avg-real');
            if (avgRealElement) avgRealElement.textContent = 'Promedio: $0';

            const topCostElement = document.getElementById('shipping-top-cost');
            if (topCostElement) topCostElement.textContent = '$0';
            
            const topOrderElement = document.getElementById('shipping-top-order');
            if (topOrderElement) topOrderElement.textContent = 'Orden: -';
            
            const topCarrierElement = document.getElementById('shipping-top-carrier');
            if (topCarrierElement) topCarrierElement.textContent = '-';
            
            return;
          }
          
          const shippingData = dashboardData.shippingCosts;
          
          // Costo Real Total - solo actualizar si los elementos existen
          const totalRealElement = document.getElementById('shipping-total-real');
          if (totalRealElement) totalRealElement.textContent = formatCurrency(shippingData.totalRealCost);
          
          const ordersFoundElement = document.getElementById('shipping-orders-found');
          if (ordersFoundElement) ordersFoundElement.textContent = shippingData.found + ' envíos encontrados';
          
          const avgRealElement = document.getElementById('shipping-avg-real');
          if (avgRealElement) avgRealElement.textContent = 'Promedio: ' + formatCurrency(shippingData.avgRealCost);

          // Top Envío - solo actualizar si los elementos existen
          if (shippingData.topShipments && shippingData.topShipments.length > 0) {
            const topShipment = shippingData.topShipments[0];
            
            const topCostElement = document.getElementById('shipping-top-cost');
            if (topCostElement) topCostElement.textContent = formatCurrency(topShipment.realCost);
            
            const topOrderElement = document.getElementById('shipping-top-order');
            if (topOrderElement) topOrderElement.textContent = 'Orden: #' + topShipment.orderId;
            
            const topCarrierElement = document.getElementById('shipping-top-carrier');
            if (topCarrierElement) topCarrierElement.textContent = topShipment.carrier;
          }
        }

        // FUNCIÓN SIMPLIFICADA: Actualizar sección de insights de envío (solo top orders)
        function updateShippingInsightsSection() {
          if (!dashboardData || !dashboardData.freeShippingCoupons) {
            // Si no hay datos, mostrar mensaje por defecto solo en top orders
            const topOrdersElement = document.getElementById('top-free-shipping-orders');
            if (topOrdersElement) {
              topOrdersElement.innerHTML = '<p class="text-gray-500 text-sm">No hay datos de envíos gratis en este período</p>';
            }
            return;
          }
          
          const freeShippingData = dashboardData.freeShippingCoupons || {};
          
          // Top Órdenes Costosas
          if (freeShippingData.topFreeShippingOrders && freeShippingData.topFreeShippingOrders.length > 0) {
            const topOrdersHTML = freeShippingData.topFreeShippingOrders.map((order, index) => {
              return `
                <div class="flex items-center justify-between p-3 bg-white rounded-lg border border-red-100">
                  <div class="flex items-center space-x-3">
                    <div class="flex-shrink-0">
                      <span class="inline-flex items-center justify-center w-8 h-8 bg-red-100 text-red-600 rounded-full text-sm font-bold">
                        ${index + 1}
                      </span>
                    </div>
                    <div>
                      <p class="text-sm font-medium text-gray-900">Orden #${order.orderId}</p>
                      <p class="text-xs text-gray-500">${order.customerEmail}</p>
                      <p class="text-xs text-red-600">${order.couponCodes.join(', ')}</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-bold text-red-600">${formatCurrency(order.realCost)}</p>
                    <p class="text-xs text-gray-500">Orden: ${formatCurrency(order.orderTotal)}</p>
                  </div>
                </div>
              `;
            }).join('');
            
            document.getElementById('top-free-shipping-orders').innerHTML = topOrdersHTML;
          } else {
            document.getElementById('top-free-shipping-orders').innerHTML = '<p class="text-gray-500 text-sm">No hay órdenes de envío gratis en este período</p>';
          }
        }

        // Función para reintentar conexión
        function retryConnection() {
          document.getElementById('error').classList.add('hidden');
          loadDashboard();
        }

        // Funciones de chat
        function enableChat() {
          document.getElementById('chat-input').disabled = false;
          document.getElementById('chat-send').disabled = false;
        }

        function setChatMessage(message) {
          document.getElementById('chat-input').value = message;
        }

        function handleChatKeyPress(event) {
          if (event.key === 'Enter') {
            sendChatMessage();
          }
        }

        async function sendChatMessage() {
          const input = document.getElementById('chat-input');
          const message = input.value.trim();
          
          if (!message) return;
          
          const messagesContainer = document.getElementById('chat-messages');
          
          // Mostrar mensaje del usuario
          const userMessage = document.createElement('div');
          userMessage.className = 'flex justify-end';
          userMessage.innerHTML = `
            <div class="bg-purple-500 text-white px-4 py-2 rounded-lg max-w-xs">
              <p class="text-sm">${message}</p>
            </div>
          `;
          messagesContainer.appendChild(userMessage);
          
          // Limpiar input
          input.value = '';
          
          // Mostrar indicador de escritura
          const typingIndicator = document.createElement('div');
          typingIndicator.className = 'flex justify-start';
          typingIndicator.innerHTML = `
            <div class="bg-gray-200 px-4 py-2 rounded-lg">
              <p class="text-sm text-gray-600">
                <i class="fas fa-circle animate-pulse"></i>
                <i class="fas fa-circle animate-pulse" style="animation-delay: 0.2s;"></i>
                <i class="fas fa-circle animate-pulse" style="animation-delay: 0.4s;"></i>
                Analizando...
              </p>
            </div>
          `;
          messagesContainer.appendChild(typingIndicator);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
          
          try {
            // Usar axios que ya tiene configurado el Authorization header
            const response = await axios.post('/api/chat', { message });
            const result = response.data;
            
            // Remover indicador de escritura
            messagesContainer.removeChild(typingIndicator);
            
            if (result.success) {
              // Mostrar respuesta de la IA
              const aiMessage = document.createElement('div');
              aiMessage.className = 'flex justify-start';
              aiMessage.innerHTML = `
                <div class="bg-white border border-gray-200 px-4 py-3 rounded-lg max-w-md shadow-sm">
                  <div class="flex items-center space-x-2 mb-2">
                    <i class="fas fa-robot text-purple-500"></i>
                    <span class="text-xs text-gray-500 font-medium">Analista IA</span>
                    <span class="text-xs text-gray-400">• ${result.data.executionTime}ms</span>
                  </div>
                  <div class="text-sm text-gray-800 whitespace-pre-wrap">${result.data.response}</div>
                </div>
              `;
              messagesContainer.appendChild(aiMessage);
            } else {
              // Mostrar error
              const errorMessage = document.createElement('div');
              errorMessage.className = 'flex justify-start';
              errorMessage.innerHTML = `
                <div class="bg-red-50 border border-red-200 px-4 py-2 rounded-lg max-w-xs">
                  <p class="text-sm text-red-600">Error: ${result.error}</p>
                </div>
              `;
              messagesContainer.appendChild(errorMessage);
            }
            
          } catch (error) {
            // Remover indicador de escritura
            messagesContainer.removeChild(typingIndicator);
            
            // Mostrar error de conexión
            const errorMessage = document.createElement('div');
            errorMessage.className = 'flex justify-start';
            errorMessage.innerHTML = `
              <div class="bg-red-50 border border-red-200 px-4 py-2 rounded-lg max-w-xs">
                <p class="text-sm text-red-600">Error de conexión. Intenta de nuevo.</p>
              </div>
            `;
            messagesContainer.appendChild(errorMessage);
          }
          
          // Scroll al final
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Función para verificar autenticación
        function checkAuthentication() {
          const token = localStorage.getItem('auth_token');
          if (!token) {
            window.location.href = '/login';
            return false;
          }
          
          // Configurar axios para usar el token automáticamente
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          return true;
        }

        // Verificar token con el servidor
        async function verifyTokenWithServer() {
          const token = localStorage.getItem('auth_token');
          if (!token) {
            window.location.href = '/login';
            return false;
          }

          try {
            const response = await axios.post('/api/verify-token', {}, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.data.success) {
              return true;
            } else {
              localStorage.removeItem('auth_token');
              localStorage.removeItem('user_info');
              window.location.href = '/login';
              return false;
            }
          } catch (error) {
            console.error('Error verificando token:', error);
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_info');
            window.location.href = '/login';
            return false;
          }
        }

        // Inicializar información del usuario
        function initializeUserInfo() {
          const userInfo = localStorage.getItem('user_info');
          if (userInfo) {
            try {
              const user = JSON.parse(userInfo);
              
              // Actualizar nombre del usuario en ambos headers (desktop y móvil)
              const userNameElement = document.getElementById('user-name');
              const userNameMobileElement = document.getElementById('user-name-mobile');
              
              if (userNameElement) {
                userNameElement.textContent = user.name || 'Usuario';
              }
              if (userNameMobileElement) {
                userNameMobileElement.textContent = user.name || 'Usuario';
              }
              
              // Mostrar botón de gestión de usuarios solo para administradores (desktop y móvil)
              const adminBtn = document.getElementById('admin-users-btn');
              const adminBtnMobile = document.getElementById('admin-users-btn-mobile');
              
              if (user.role === 'admin') {
                if (adminBtn) adminBtn.classList.remove('hidden');
                if (adminBtnMobile) adminBtnMobile.classList.remove('hidden');
                console.log('Botones de administración mostrados para:', user.name);
              }
              
              console.log('Usuario inicializado:', user.name, 'Role:', user.role);
            } catch (error) {
              console.error('Error parsing user info:', error);
            }
          }
        }

        // Inicializar dashboard al cargar la página
        window.addEventListener('DOMContentLoaded', async () => {
          console.log('Dashboard iniciando...');
          
          // Verificar si hay token
          const token = localStorage.getItem('auth_token');
          if (!token) {
            console.log('No hay token, redirigiendo al login');
            window.location.href = '/login';
            return;
          }

          // CRÍTICO: Verificar si el token está expirado antes de usarlo
          if (isTokenExpired(token)) {
            console.log('Token expirado detectado, limpiando y redirigiendo...');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_info');
            // Mostrar mensaje por 2 segundos antes de redirigir
            document.body.innerHTML = '<div style="text-align:center; margin-top:50px; font-family:Arial;"><h2>🔄 Token expirado</h2><p>Redirigiendo al login...</p></div>';
            setTimeout(() => {
              window.location.href = '/login';
            }, 2000);
            return;
          }

          console.log('Token válido encontrado:', token.substring(0, 50) + '...');
          
          // Configurar axios con el token
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Configurar interceptor de respuesta para manejar errores de token automáticamente
          axios.interceptors.response.use(
            response => response,
            error => {
              console.error('Axios interceptor - Error detectado:', error);
              
              // Verificar si es error de token
              const isTokenError = (
                (error.response && error.response.status === 401) ||
                (error.response && error.response.data && error.response.data.error && 
                 (error.response.data.error.includes('Token') || 
                  error.response.data.error.includes('token') ||
                  error.response.data.error.includes('inválido') ||
                  error.response.data.error.includes('expirado')))
              );
              
              if (isTokenError) {
                console.log('Interceptor - Token inválido detectado, limpiando y redirigiendo');
                localStorage.clear();
                delete axios.defaults.headers.common['Authorization'];
                window.location.href = '/login';
                return Promise.reject(new Error('Token inválido - Redirigiendo al login'));
              }
              
              return Promise.reject(error);
            }
          );
          
          // Inicializar información del usuario
          initializeUserInfo();
          
          // Inicializar checkbox de comparación y texto
          const comparisonCheckbox = document.getElementById('enable-comparison');
          if (comparisonCheckbox) {
            comparisonCheckbox.checked = comparisonEnabled;
            updateComparisonPeriodText();
          }
          
          // Verificar token con el servidor antes de cargar dashboard
          const isValidToken = await verifyTokenWithServer();
          if (!isValidToken) {
            return; // verifyTokenWithServer ya maneja la redirección
          }
          
          // Intentar cargar dashboard directamente
          console.log('Token válido, cargando dashboard...');
          await loadDashboard();
          
          // Cargar datos de Google Analytics 4
          console.log('Cargando datos de Google Analytics 4...');
          await loadAnalytics();
          
          // Cargar datos de Google Ads
          console.log('Cargando datos de Google Ads...');
          await loadGoogleAds();
        });
        
        // === GESTIÓN DE USUARIOS ===
        
        let currentUsers = [];
        
        // Abrir modal de gestión de usuarios
        function openUserManagement() {
          document.getElementById('user-management-modal').classList.remove('hidden');
          loadUsers();
        }
        
        // Cerrar modal
        function closeUserManagement() {
          document.getElementById('user-management-modal').classList.add('hidden');
        }
        
        // Cargar lista de usuarios
        async function loadUsers() {
          try {
            const response = await axios.get('/api/users');
            currentUsers = response.data.users;
            renderUsersList();
          } catch (error) {
            console.error('Error cargando usuarios:', error);
            showUserMessage('Error cargando usuarios', 'error');
          }
        }
        
        // Renderizar lista de usuarios
        function renderUsersList() {
          const usersList = document.getElementById('users-list');
          usersList.innerHTML = '';
          
          currentUsers.forEach(user => {
            const userRow = document.createElement('div');
            userRow.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200';
            
            const statusBadge = user.isActive ? 
              '<span class="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">Activo</span>' :
              '<span class="text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded-full">Inactivo</span>';
              
            const roleBadge = user.role === 'admin' ?
              '<span class="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded-full">Admin</span>' :
              '<span class="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full">Usuario</span>';
            
            userRow.innerHTML = `
              <div class="flex-1">
                <div class="flex items-center space-x-3">
                  <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-full flex items-center justify-center">
                    <span class="text-white font-bold text-sm">${user.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p class="font-semibold text-gray-800">${user.name}</p>
                    <p class="text-sm text-gray-600">${user.email}</p>
                    <p class="text-xs text-gray-500">Creado: ${new Date(user.createdAt).toLocaleDateString('es-MX')}</p>
                  </div>
                </div>
              </div>
              <div class="flex items-center space-x-2">
                ${roleBadge}
                ${statusBadge}
                ${user.role !== 'admin' ? `<button onclick="deleteUser(${user.id})" class="text-red-600 hover:text-red-800 p-2"><i class="fas fa-trash text-sm"></i></button>` : ''}
              </div>
            `;
            
            usersList.appendChild(userRow);
          });
          
          // Actualizar contador
          document.getElementById('users-count').textContent = `${currentUsers.length}/5 usuarios`;
        }
        
        // Agregar nuevo usuario
        async function addUser() {
          const name = document.getElementById('new-user-name').value.trim();
          const email = document.getElementById('new-user-email').value.trim();
          const password = document.getElementById('new-user-password').value;
          
          if (!name || !email || !password) {
            showUserMessage('Todos los campos son obligatorios', 'error');
            return;
          }
          
          if (password.length < 6) {
            showUserMessage('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
          }
          
          try {
            const response = await axios.post('/api/users', {
              name: name,
              email: email,
              password: password,
              role: 'user'
            });
            
            if (response.data.success) {
              showUserMessage('Usuario agregado correctamente', 'success');
              // Limpiar formulario
              document.getElementById('new-user-name').value = '';
              document.getElementById('new-user-email').value = '';
              document.getElementById('new-user-password').value = '';
              // Recargar lista
              loadUsers();
            } else {
              showUserMessage(response.data.message || 'Error agregando usuario', 'error');
            }
          } catch (error) {
            console.error('Error:', error);
            showUserMessage('Error de conexión', 'error');
          }
        }
        
        // Eliminar usuario
        async function deleteUser(userId) {
          if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
            return;
          }
          
          try {
            const response = await axios.delete(`/api/users/${userId}`);
            
            if (response.data.success) {
              showUserMessage('Usuario eliminado correctamente', 'success');
              loadUsers();
            } else {
              showUserMessage(response.data.message || 'Error eliminando usuario', 'error');
            }
          } catch (error) {
            console.error('Error:', error);
            showUserMessage('Error de conexión', 'error');
          }
        }
        
        // Función de logout
        async function logout() {
          try {
            console.log('Iniciando logout...');
            
            // Limpiar datos locales inmediatamente
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_info');
            
            // Opcional: llamar al endpoint de logout
            try {
              await axios.post('/api/logout');
              console.log('Logout API exitoso');
            } catch (error) {
              console.log('Error en logout API (no crítico):', error);
            }
            
            // Limpiar headers de axios
            delete axios.defaults.headers.common['Authorization'];
            
            console.log('Redirigiendo al login...');
            // Redirigir al login
            window.location.href = '/login';
            
          } catch (error) {
            console.error('Error durante logout:', error);
            // Forzar logout aunque haya error
            localStorage.clear();
            window.location.replace('/login');
          }
        }
        
        // Función alternativa de logout (por si falla la principal)
        function forceLogout() {
          localStorage.clear();
          sessionStorage.clear();
          window.location.replace('/login');
        }
        
        // Mostrar mensajes en el modal de usuarios
        function showUserMessage(message, type) {
          const messageDiv = document.getElementById('user-message');
          messageDiv.textContent = message;
          messageDiv.className = `p-3 rounded-lg text-sm font-medium ${type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`;
          messageDiv.classList.remove('hidden');
          
          setTimeout(() => {
            messageDiv.classList.add('hidden');
          }, 5000);
        }
