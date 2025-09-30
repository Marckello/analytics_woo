#!/usr/bin/env node

// Simple build script for EasyPanel
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting EasyPanel build...');

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Copy server file to dist as _worker.js (EasyPanel expects this)
const serverFile = path.join(__dirname, 'server-node.js');
const workerFile = path.join(distDir, '_worker.js');

if (fs.existsSync(serverFile)) {
    fs.copyFileSync(serverFile, workerFile);
    console.log('✅ Copied server-node.js to dist/_worker.js');
}

// Copy static files if they exist
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
    const staticFiles = fs.readdirSync(publicDir);
    staticFiles.forEach(file => {
        const srcFile = path.join(publicDir, file);
        const destFile = path.join(distDir, file);
        if (fs.statSync(srcFile).isFile()) {
            fs.copyFileSync(srcFile, destFile);
            console.log(`✅ Copied ${file} to dist/`);
        }
    });
}

// Create simple routes.json for EasyPanel
const routesConfig = {
    "version": 1,
    "include": ["/*"],
    "exclude": []
};

fs.writeFileSync(
    path.join(distDir, '_routes.json'), 
    JSON.stringify(routesConfig, null, 2)
);

console.log('✅ Build completed successfully!');
console.log('📁 Files in dist:', fs.readdirSync(distDir));