#!/usr/bin/env python3
"""
Analizador de estructura de datos Shopify Excel
Analiza el archivo data_shopify.xls para entender la estructura real
"""

import pandas as pd
import json
from datetime import datetime

def analyze_shopify_excel():
    try:
        print("🔍 Analizando archivo data_shopify.xls...")
        
        # Leer Excel - probamos diferentes formas
        try:
            df = pd.read_excel('data_shopify.xls', engine='xlrd')
        except Exception as e1:
            print(f"⚠️  Error con xlrd: {e1}")
            try:
                df = pd.read_excel('data_shopify.xls', engine='openpyxl')
            except Exception as e2:
                print(f"⚠️  Error con openpyxl: {e2}")
                # Intentar como CSV
                df = pd.read_csv('data_shopify.xls', sep='\t')
        
        print(f"📊 Archivo cargado exitosamente!")
        print(f"   Filas: {len(df)}")
        print(f"   Columnas: {len(df.columns)}")
        
        print("\n🏗️  ESTRUCTURA DE COLUMNAS:")
        print("="*50)
        for i, col in enumerate(df.columns):
            print(f"{i+1:2d}. {col}")
        
        print("\n📋 PRIMERAS 3 FILAS (MUESTRA):")
        print("="*50)
        print(df.head(3).to_string())
        
        print("\n📊 INFORMACIÓN DE TIPOS DE DATOS:")
        print("="*50)
        print(df.dtypes)
        
        print("\n🔢 ESTADÍSTICAS BÁSICAS:")
        print("="*50)
        print(df.describe())
        
        # Analizar columnas que parecen fechas
        print("\n📅 ANÁLISIS DE FECHAS:")
        print("="*50)
        date_cols = [col for col in df.columns if any(word in col.lower() for word in ['date', 'created', 'updated', 'time'])]
        for col in date_cols:
            print(f"{col}:")
            print(f"  Muestra: {df[col].head(3).tolist()}")
            print(f"  Valores únicos: {df[col].nunique()}")
            print()
        
        # Analizar columnas que parecen estados
        print("\n📊 ANÁLISIS DE ESTADOS/ESTATUS:")
        print("="*50)
        status_cols = [col for col in df.columns if any(word in col.lower() for word in ['status', 'state', 'fulfillment', 'financial'])]
        for col in status_cols:
            print(f"{col}:")
            print(f"  Valores únicos: {df[col].value_counts().to_dict()}")
            print()
        
        # Analizar columnas numéricas (precios, totales)
        print("\n💰 ANÁLISIS DE VALORES MONETARIOS:")
        print("="*50)
        money_cols = [col for col in df.columns if any(word in col.lower() for word in ['price', 'total', 'amount', 'cost', 'tax', 'discount', 'subtotal'])]
        for col in money_cols:
            if df[col].dtype in ['int64', 'float64'] or pd.api.types.is_numeric_dtype(df[col]):
                print(f"{col}:")
                print(f"  Min: {df[col].min()}")
                print(f"  Max: {df[col].max()}")
                print(f"  Promedio: {df[col].mean():.2f}")
                print(f"  Muestra: {df[col].head(3).tolist()}")
                print()
        
        # Guardar muestra en JSON para análisis
        sample_data = df.head(5).to_dict('records')
        with open('shopify_sample.json', 'w', encoding='utf-8') as f:
            json.dump(sample_data, f, indent=2, default=str)
        
        print(f"✅ Análisis completado!")
        print(f"📁 Muestra guardada en: shopify_sample.json")
        
        return True
        
    except Exception as e:
        print(f"❌ Error analizando archivo: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    analyze_shopify_excel()