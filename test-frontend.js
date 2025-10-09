const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Capturar todos los logs de consola
  page.on('console', msg => {
    console.log('🖥️ CONSOLE:', msg.type().toUpperCase(), '-', msg.text());
  });
  
  page.on('pageerror', error => {
    console.log('❌ ERROR:', error.message);
  });
  
  try {
    // 1. Ir al dashboard (debería redirigir al login)
    console.log('1️⃣ Navegando al dashboard...');
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);
    
    console.log('📍 URL actual:', page.url());
    console.log('📄 Título:', await page.title());
    
    // 2. Hacer login
    console.log('2️⃣ Haciendo login...');
    await page.fill('#username', 'marco@serrano.marketing');
    await page.fill('#password', 'DSerrano602450*');
    
    // Verificar el ojo de la contraseña
    console.log('👁️ Probando toggle de contraseña...');
    const passwordType1 = await page.getAttribute('#password', 'type');
    console.log('Tipo inicial de password:', passwordType1);
    
    await page.click('#togglePassword');
    await page.waitForTimeout(500);
    
    const passwordType2 = await page.getAttribute('#password', 'type');
    console.log('Tipo después de click:', passwordType2);
    
    // Submit login
    console.log('🔐 Enviando formulario de login...');
    await page.click('button[type="submit"]');
    
    // Esperar redirección al dashboard
    await page.waitForTimeout(3000);
    
    console.log('📍 URL después de login:', page.url());
    console.log('📄 Título después de login:', await page.title());
    
    // 3. Verificar si aparece el botón de usuarios
    console.log('3️⃣ Buscando botón de gestión de usuarios...');
    
    // Esperar a que el JavaScript inicialice
    await page.waitForTimeout(2000);
    
    // Verificar botón desktop
    const adminBtnDesktop = page.locator('#admin-users-btn');
    const isVisibleDesktop = await adminBtnDesktop.isVisible();
    console.log('👥 Botón desktop visible:', isVisibleDesktop);
    
    // Verificar botón móvil  
    const adminBtnMobile = page.locator('#admin-users-btn-mobile');
    const isVisibleMobile = await adminBtnMobile.isVisible();
    console.log('📱 Botón móvil visible:', isVisibleMobile);
    
    // Verificar localStorage
    const userInfo = await page.evaluate(() => {
      return {
        token: localStorage.getItem('auth_token'),
        userInfo: localStorage.getItem('user_info')
      };
    });
    
    console.log('💾 LocalStorage:');
    console.log('  Token presente:', !!userInfo.token);
    console.log('  User info:', userInfo.userInfo);
    
    // Si el botón está visible, hacer click
    if (isVisibleDesktop || isVisibleMobile) {
      console.log('4️⃣ Haciendo click en botón de usuarios...');
      
      if (isVisibleDesktop) {
        await adminBtnDesktop.click();
      } else {
        await adminBtnMobile.click();
      }
      
      await page.waitForTimeout(1000);
      
      // Verificar que se abre el modal
      const modal = page.locator('#user-management-modal');
      const isModalVisible = await modal.isVisible();
      console.log('📋 Modal de usuarios visible:', isModalVisible);
      
      if (isModalVisible) {
        console.log('✅ ¡ÉXITO! El sistema de gestión de usuarios funciona correctamente.');
      }
    } else {
      console.log('❌ PROBLEMA: Los botones de gestión de usuarios NO son visibles');
      
      // Debug: verificar clases de los botones
      const desktopClasses = await adminBtnDesktop.getAttribute('class');
      const mobileClasses = await adminBtnMobile.getAttribute('class');
      
      console.log('🔍 Clases botón desktop:', desktopClasses);
      console.log('🔍 Clases botón móvil:', mobileClasses);
    }
    
  } catch (error) {
    console.log('💥 Error:', error.message);
  } finally {
    await browser.close();
  }
})();
