#!/usr/bin/env python3
"""
Procesador de datos Shopify - Convierte Excel a formato compatible con dashboard
Agrupa line items por orden y mapea a estructura WooCommerce
"""

import pandas as pd
import json
from datetime import datetime
from collections import defaultdict

def process_shopify_data(start_date=None, end_date=None):
    """
    Procesa datos de Shopify y los convierte al formato esperado por el dashboard
    """
    try:
        print("🔄 Procesando datos Shopify...")
        
        # Leer Excel
        df = pd.read_excel('data_shopify.xls', engine='xlrd')
        print(f"📊 Datos cargados: {len(df)} filas")
        
        # Filtrar por fechas si se especifican
        if start_date or end_date:
            df['Created at'] = pd.to_datetime(df['Created at'], errors='coerce', utc=True)
            if start_date:
                start_dt = pd.to_datetime(start_date, utc=True)
                df = df[df['Created at'] >= start_dt]
            if end_date:
                end_dt = pd.to_datetime(end_date, utc=True)
                df = df[df['Created at'] <= end_dt]
            print(f"📅 Filtrado por fecha: {len(df)} filas")
        
        # Agrupar por orden (Name)
        orders = {}
        
        for _, row in df.iterrows():
            order_id = row.get('Name')
            if pd.isna(order_id):
                continue
                
            # Si es la primera vez que vemos esta orden, crear registro base
            if order_id not in orders:
                orders[order_id] = {
                    'id': order_id,
                    'customer_email': row.get('Email'),
                    'financial_status': row.get('Financial Status'),
                    'fulfillment_status': row.get('Fulfillment Status'),
                    'paid_at': row.get('Paid at'),
                    'created_at': row.get('Created at'),
                    'fulfilled_at': row.get('Fulfilled at'),
                    'currency': row.get('Currency'),
                    'subtotal': row.get('Subtotal', 0),
                    'shipping': row.get('Shipping', 0),
                    'taxes': row.get('Taxes', 0),
                    'total': row.get('Total', 0),
                    'discount_amount': row.get('Discount Amount', 0),
                    'discount_code': row.get('Discount Code'),
                    'shipping_method': row.get('Shipping Method'),
                    'payment_method': row.get('Payment Method'),
                    'payment_reference': row.get('Payment Reference'),
                    'billing_name': row.get('Billing Name'),
                    'shipping_name': row.get('Shipping Name'),
                    'billing_city': row.get('Billing City'),
                    'shipping_city': row.get('Shipping City'),
                    'billing_country': row.get('Billing Country'),
                    'shipping_country': row.get('Shipping Country'),
                    'vendor': row.get('Vendor'),
                    'source': 'shopify',
                    'line_items': []
                }
            
            # Agregar line item si existe
            if not pd.isna(row.get('Lineitem name')):
                line_item = {
                    'name': row.get('Lineitem name'),
                    'quantity': row.get('Lineitem quantity', 1),
                    'price': row.get('Lineitem price', 0),
                    'sku': row.get('Lineitem sku'),
                    'fulfillment_status': row.get('Lineitem fulfillment status'),
                    'discount': row.get('Lineitem discount', 0)
                }
                orders[order_id]['line_items'].append(line_item)
        
        print(f"🛍️  Órdenes únicas procesadas: {len(orders)}")
        
        # Convertir a lista y mapear estados
        processed_orders = []
        for order_data in orders.values():
            # Mapear estados Shopify a WooCommerce
            wc_status = map_shopify_status(
                order_data.get('financial_status'), 
                order_data.get('fulfillment_status')
            )
            
            # Construir línea de productos para display
            line_items_title = ', '.join([
                f"{item['name']} (x{item['quantity']})" 
                for item in order_data['line_items']
            ])
            
            # Función auxiliar para manejar strings seguros
            def safe_string(value):
                if pd.isna(value) or value is None:
                    return ''
                return str(value)
            
            # Función auxiliar para dividir nombres
            def split_name(name):
                safe_name = safe_string(name)
                if not safe_name:
                    return '', ''
                parts = safe_name.split(' ')
                return parts[0], ' '.join(parts[1:]) if len(parts) > 1 else ''
            
            # Función auxiliar para valores numéricos seguros
            def safe_float(value):
                if pd.isna(value) or value is None:
                    return 0.0
                try:
                    return float(value)
                except (ValueError, TypeError):
                    return 0.0

            billing_first, billing_last = split_name(order_data.get('billing_name'))
            shipping_first, shipping_last = split_name(order_data.get('shipping_name'))

            # Mapear a formato WooCommerce
            mapped_order = {
                'id': order_data['id'],
                'status': wc_status,
                'total': safe_float(order_data.get('total')),
                'subtotal': safe_float(order_data.get('subtotal')),
                'shipping_total': safe_float(order_data.get('shipping')),
                'tax_total': safe_float(order_data.get('taxes')),
                'discount_total': safe_float(order_data.get('discount_amount')),
                'customer_email': safe_string(order_data.get('customer_email')),
                'billing_first_name': billing_first,
                'billing_last_name': billing_last,
                'shipping_first_name': shipping_first,
                'shipping_last_name': shipping_last,
                'date_created': safe_string(order_data.get('created_at')),
                'date_paid': safe_string(order_data.get('paid_at')),
                'payment_method': map_payment_method(order_data.get('payment_method')),
                'payment_method_title': safe_string(order_data.get('payment_method')),
                'shipping_city': safe_string(order_data.get('shipping_city')),
                'shipping_country': safe_string(order_data.get('shipping_country')),
                'billing_city': safe_string(order_data.get('billing_city')),
                'billing_country': safe_string(order_data.get('billing_country')),
                'currency': safe_string(order_data.get('currency')) or 'MXN',
                'line_items_title': line_items_title,
                'line_items_count': len(order_data['line_items']),
                'source': 'shopify'
            }
            
            processed_orders.append(mapped_order)
        
        # Calcular estadísticas
        total_orders = len(processed_orders)
        total_revenue = sum(safe_float(order.get('total')) for order in processed_orders)
        avg_order_value = total_revenue / total_orders if total_orders > 0 else 0
        
        completed_orders = len([o for o in processed_orders if o['status'] == 'completed'])
        
        statistics = {
            'totalOrders': total_orders,
            'totalRevenue': total_revenue,
            'averageOrderValue': avg_order_value,
            'completedOrders': completed_orders
        }
        
        sources = {
            'shopify': total_orders,
            'woocommerce': 0,
            'total': total_orders
        }
        
        result = {
            'statistics': statistics,
            'orders': processed_orders,
            'sources': sources
        }
        
        print(f"✅ Procesamiento completado:")
        print(f"   Órdenes: {total_orders}")
        print(f"   Revenue: ${total_revenue:,.2f}")
        print(f"   AOV: ${avg_order_value:.2f}")
        
        return result
        
    except Exception as e:
        print(f"❌ Error procesando datos: {e}")
        import traceback
        traceback.print_exc()
        return None

def map_shopify_status(financial_status, fulfillment_status):
    """
    Mapea estados de Shopify a estados de WooCommerce
    """
    # Mapeo basado en análisis real:
    # Financial Status: paid, refunded, partially_refunded, pending
    # Fulfillment Status: fulfilled, unfulfilled, partial
    
    if financial_status == 'refunded':
        return 'refunded'
    elif financial_status == 'partially_refunded':
        return 'partially-refunded'
    elif financial_status == 'pending':
        return 'pending'
    elif financial_status == 'paid':
        if fulfillment_status == 'fulfilled':
            return 'completed'  # Pagado y enviado = completed
        elif fulfillment_status == 'unfulfilled':
            return 'processing'  # Pagado pero no enviado = processing
        elif fulfillment_status == 'partial':
            return 'processing'  # Parcialmente enviado = processing
        else:
            return 'processing'  # Default para pagado
    else:
        return 'pending'  # Default

def map_payment_method(shopify_method):
    """
    Mapea métodos de pago de Shopify a WooCommerce
    """
    if not shopify_method:
        return 'unknown'
    
    method_lower = shopify_method.lower()
    
    if 'stripe' in method_lower:
        return 'stripe'
    elif 'paypal' in method_lower:
        return 'paypal'
    elif 'card' in method_lower:
        return 'stripe'  # Asumir que cards son Stripe
    else:
        return 'other'

if __name__ == "__main__":
    import sys
    
    # Leer parámetros de línea de comandos
    start_date = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else None
    end_date = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else None
    
    # Procesar datos con filtros opcionales
    result = process_shopify_data(start_date, end_date)
    if result:
        # Guardar resultado para testing
        with open('shopify_processed.json', 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, default=str)
        print("📁 Resultado guardado en: shopify_processed.json")