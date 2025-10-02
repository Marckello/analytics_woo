#!/usr/bin/env python3
import pandas as pd
import json

# Leer el CSV convertido
df = pd.read_csv('envia_report_analysis.csv')

# Análisis de order_numbers únicos y costos
print('📊 ANÁLISIS COMPLETO DE DATOS ENVIA.COM:')
print(f'Total registros: {len(df)}')
print(f'Órdenes únicas: {df["order_number"].nunique()}')
print()

# Costos por orden
order_costs = df.groupby('order_number')['total'].agg(['sum', 'count', 'mean']).round(2)
order_costs.columns = ['total_cost', 'shipments', 'avg_cost']
order_costs = order_costs.reset_index()

print('🎯 TOP 10 ÓRDENES POR COSTO TOTAL:')
print(order_costs.sort_values('total_cost', ascending=False).head(10).to_string(index=False))
print()

# Estadísticas generales
print('📈 ESTADÍSTICAS GENERALES:')
total_cost = order_costs['total_cost'].sum()
avg_per_order = order_costs['total_cost'].mean()
avg_per_shipment = df['total'].mean()

print(f'Costo total real de envíos: ${total_cost:.2f} MXN')
print(f'Costo promedio por orden: ${avg_per_order:.2f} MXN') 
print(f'Costo promedio por envío: ${avg_per_shipment:.2f} MXN')
print()

# Carriers
print('🚚 CARRIERS UTILIZADOS:')
carrier_stats = df['name'].value_counts()
print(carrier_stats.to_string())
print()

# Estados de envío
print('📦 ESTADOS DE ENVÍOS:')
status_stats = df['status'].value_counts()
print(status_stats.to_string())
print()

# Lista de órdenes para comparar con WooCommerce
unique_orders = sorted([int(x) for x in df['order_number'].unique() if not pd.isna(x)])
print('🔍 ÓRDENES ENCONTRADAS EN ENVIA.COM:')
print(f'IDs: {unique_orders[:20]}{"..." if len(unique_orders) > 20 else ""}')
print(f'Total: {len(unique_orders)} órdenes únicas')
print()

# Crear mapeo de costos por orden para usar en el dashboard
order_mapping = {}
for _, row in order_costs.iterrows():
    order_id = int(row['order_number']) if not pd.isna(row['order_number']) else None
    if order_id:
        order_mapping[order_id] = {
            'total_cost': float(row['total_cost']),
            'shipments_count': int(row['shipments']),
            'avg_cost': float(row['avg_cost'])
        }

# Guardar mapeo para usar en la integración
with open('envia_order_mapping.json', 'w') as f:
    json.dump(order_mapping, f, indent=2)

print('💾 RESUMEN PARA INTEGRACIÓN:')
print(f'Total a mostrar en dashboard: ${total_cost:.2f} MXN')
print(f'Órdenes con envío encontradas: {len(unique_orders)}')
print('✅ Mapeo guardado en envia_order_mapping.json')