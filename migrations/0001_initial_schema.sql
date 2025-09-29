-- Cache de productos WooCommerce
CREATE TABLE IF NOT EXISTS products_cache (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL,
  categories TEXT, -- JSON string
  stock_quantity INTEGER,
  total_sales INTEGER DEFAULT 0,
  status TEXT DEFAULT 'publish',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cache de órdenes WooCommerce  
CREATE TABLE IF NOT EXISTS orders_cache (
  id INTEGER PRIMARY KEY,
  total REAL NOT NULL,
  status TEXT,
  customer_id INTEGER,
  customer_email TEXT,
  customer_name TEXT,
  line_items TEXT, -- JSON string con productos
  date_created DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cache de clientes WooCommerce
CREATE TABLE IF NOT EXISTS customers_cache (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  total_spent REAL DEFAULT 0,
  orders_count INTEGER DEFAULT 0,
  date_created DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Log de consultas de IA para analytics
CREATE TABLE IF NOT EXISTS ai_queries_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  response TEXT,
  execution_time INTEGER, -- milisegundos
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_products_sales ON products_cache(total_sales DESC);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders_cache(date_created DESC);
CREATE INDEX IF NOT EXISTS idx_orders_total ON orders_cache(total DESC);
CREATE INDEX IF NOT EXISTS idx_customers_spent ON customers_cache(total_spent DESC);
CREATE INDEX IF NOT EXISTS idx_customers_orders ON customers_cache(orders_count DESC);
CREATE INDEX IF NOT EXISTS idx_ai_queries_date ON ai_queries_log(created_at DESC);