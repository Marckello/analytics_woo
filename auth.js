// auth.js - Sistema de autenticación completo para Adaptoheal Analytics Dashboard
require('dotenv').config();

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');

// Configuración de autenticación
const JWT_SECRET = process.env.JWT_SECRET || 'adaptoheal_secure_jwt_secret_2025';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const MAX_USERS = parseInt(process.env.MAX_USERS) || 5;
const USERS_FILE = path.join(__dirname, 'users.json');

// Inicializar archivo de usuarios si no existe
const initializeUsersFile = async () => {
  try {
    await fs.access(USERS_FILE);
  } catch (error) {
    // El archivo no existe, crear con usuario admin por defecto
    const defaultAdmin = {
      id: 1,
      email: 'marco@serrano.marketing',
      name: 'Marco Serrano',
      password: await bcrypt.hash('Adaptoheal2025!', 12),
      role: 'admin',
      createdAt: new Date().toISOString(),
      lastLogin: null,
      isActive: true
    };

    const testUser = {
      id: 2,
      email: 'test@adaptoheal.com',
      name: 'Usuario Test',
      password: await bcrypt.hash('Test123!', 12),
      role: 'user',
      createdAt: new Date().toISOString(),
      lastLogin: null,
      isActive: true
    };

    const initialData = {
      users: [defaultAdmin, testUser],
      maxUsers: MAX_USERS,
      createdAt: new Date().toISOString()
    };

    await fs.writeFile(USERS_FILE, JSON.stringify(initialData, null, 2));
    console.log('✅ Archivo de usuarios inicializado con admin: marco@serrano.marketing / Adaptoheal2025!');
  }
};

// Leer usuarios del archivo
const readUsers = async () => {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error leyendo usuarios:', error);
    return { users: [], maxUsers: MAX_USERS };
  }
};

// Escribir usuarios al archivo
const writeUsers = async (data) => {
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error escribiendo usuarios:', error);
    throw error;
  }
};

// Buscar usuario por email
const findUserByEmail = async (email) => {
  const data = await readUsers();
  return data.users.find(user => user.email === email && user.isActive);
};

// Buscar usuario por ID
const findUserById = async (id) => {
  const data = await readUsers();
  return data.users.find(user => user.id === id && user.isActive);
};

// Autenticar usuario
const authenticateUser = async (email, password) => {
  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return { success: false, message: 'Usuario no encontrado' };
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return { success: false, message: 'Contraseña incorrecta' };
    }

    // Actualizar último login
    const data = await readUsers();
    const userIndex = data.users.findIndex(u => u.id === user.id);
    if (userIndex !== -1) {
      data.users[userIndex].lastLogin = new Date().toISOString();
      await writeUsers(data);
    }

    // Generar token JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        name: user.name 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        lastLogin: user.lastLogin
      }
    };
  } catch (error) {
    console.error('Error en autenticación:', error);
    return { success: false, message: 'Error interno del servidor' };
  }
};

// Verificar token JWT
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Error verificando token:', error);
    return null;
  }
};

// Middleware de autenticación para APIs (retorna JSON)
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.writeHead(401, { 'Content-Type': 'application/json' }) &&
             res.end(JSON.stringify({ error: 'Token de acceso requerido' }));
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.writeHead(401, { 'Content-Type': 'application/json' }) &&
             res.end(JSON.stringify({ error: 'Token inválido o expirado' }));
    }

    // Verificar que el usuario aún existe y está activo
    const user = await findUserById(decoded.userId);
    if (!user) {
      return res.writeHead(401, { 'Content-Type': 'application/json' }) &&
             res.end(JSON.stringify({ error: 'Usuario no encontrado o inactivo' }));
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Error interno del servidor' }));
  }
};

// Middleware de autenticación para páginas HTML (maneja autenticación del lado cliente)
const webAuthMiddleware = async (req, res, next) => {
  try {
    // Para páginas HTML, siempre permitir el acceso y dejar que JavaScript maneje la autenticación
    // El dashboard se cargará y el JavaScript verificará el token
    next();
  } catch (error) {
    console.error('Error en middleware de autenticación web:', error);
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<h1>Error del servidor</h1>');
  }
};

// Agregar nuevo usuario (solo admin)
const addUser = async (userData, adminUser) => {
  try {
    if (adminUser.role !== 'admin') {
      return { success: false, message: 'Solo administradores pueden agregar usuarios' };
    }

    const data = await readUsers();
    
    // Verificar límite máximo de usuarios
    if (data.users.filter(u => u.isActive).length >= MAX_USERS) {
      return { success: false, message: `Máximo ${MAX_USERS} usuarios permitidos` };
    }

    // Verificar si el email ya existe
    const existingUser = data.users.find(u => u.email === userData.email);
    if (existingUser) {
      return { success: false, message: 'El email ya está registrado' };
    }

    // Crear nuevo usuario
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    const newUser = {
      id: Math.max(...data.users.map(u => u.id), 0) + 1,
      email: userData.email,
      name: userData.name,
      password: hashedPassword,
      role: userData.role || 'user',
      createdAt: new Date().toISOString(),
      lastLogin: null,
      isActive: true
    };

    data.users.push(newUser);
    await writeUsers(data);

    return {
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        createdAt: newUser.createdAt
      }
    };
  } catch (error) {
    console.error('Error agregando usuario:', error);
    return { success: false, message: 'Error interno del servidor' };
  }
};

// Eliminar usuario (solo admin)
const deleteUser = async (userId, adminUser) => {
  try {
    if (adminUser.role !== 'admin') {
      return { success: false, message: 'Solo administradores pueden eliminar usuarios' };
    }

    if (userId === adminUser.id) {
      return { success: false, message: 'No puedes eliminar tu propia cuenta' };
    }

    const data = await readUsers();
    const userIndex = data.users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return { success: false, message: 'Usuario no encontrado' };
    }

    // Marcar como inactivo en lugar de eliminar completamente
    data.users[userIndex].isActive = false;
    data.users[userIndex].deletedAt = new Date().toISOString();
    
    await writeUsers(data);
    return { success: true, message: 'Usuario eliminado correctamente' };
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    return { success: false, message: 'Error interno del servidor' };
  }
};

// Listar usuarios (solo admin)
const listUsers = async (adminUser) => {
  try {
    if (adminUser.role !== 'admin') {
      return { success: false, message: 'Solo administradores pueden ver la lista de usuarios' };
    }

    const data = await readUsers();
    const users = data.users
      .filter(u => u.isActive)
      .map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin
      }));

    return {
      success: true,
      users,
      totalUsers: users.length,
      maxUsers: MAX_USERS
    };
  } catch (error) {
    console.error('Error listando usuarios:', error);
    return { success: false, message: 'Error interno del servidor' };
  }
};

// Inicializar sistema de autenticación
const initializeAuth = async () => {
  await initializeUsersFile();
  console.log('🔒 Sistema de autenticación inicializado');
  console.log('👤 Usuarios por defecto:');
  console.log('   📧 Admin: marco@serrano.marketing / Adaptoheal2025!');
  console.log('   📧 Test: test@adaptoheal.com / Test123!');
  console.log(`🔢 Máximo usuarios permitidos: ${MAX_USERS}`);
};

module.exports = {
  authenticateUser,
  verifyToken,
  authMiddleware,
  webAuthMiddleware,
  addUser,
  deleteUser,
  listUsers,
  findUserByEmail,
  findUserById,
  initializeAuth
};