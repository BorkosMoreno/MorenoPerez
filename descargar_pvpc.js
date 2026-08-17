/**
 * Script de extracción de PVPC (ESIOS)
 * 
 * Propósito: Descargar los precios de la electricidad de un rango de fechas 
 * y almacenarlos en un fichero JSON local para su posterior análisis.
 * 
 * Entradas: 
 * - TOKEN: Constante con el token de acceso de ESIOS.
 * - start_date: Fecha de inicio en formato YYYY-MM-DD.
 * - end_date: Fecha de fin en formato YYYY-MM-DD.
 * 
 * Salidas: 
 * - Fichero 'pvpc_datos.json' en el directorio de ejecución.
 * 
 * Dependencias: Ninguna externa. Usa 'fs' y 'fetch' nativos de Node.js (v18+).
 * 
 * Limitaciones: 
 * - No gestiona paginación (la API de ESIOS no la requiere para rangos cortos).
 * - No implementa reintentos automáticos ante fallos de red (HTTP 5xx).
 */

const fs = require('fs');

// CONFIGURACIÓN (Sustituye con tus datos reales)
const TOKEN = 'AQUI_TU_TOKEN_DE_ESIOS'; 
const START_DATE = '2023-10-24T00:00:00'; // Ejemplo: Día con cambio de hora
const END_DATE = '2023-10-24T23:59:59';

async function obtenerPVPC() {
    const url = `https://api.esios.ree.es/indicators/1001?start_date=${START_DATE}&end_date=${END_DATE}`;
    
    try {
        // Petición HTTP GET a la API
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json; application/vnd.esios-api-v2+json',
                'Host': 'api.esios.ree.es',
                'Authorization': `Token token="${TOKEN}"`
            }
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        
        // Extracción y transformación de los datos relevantes
        const preciosLimpios = data.indicator.values.map(item => {
            return {
                // La API devuelve EUR/MWh, lo convertimos a EUR/kWh dividiendo entre 1000
                precio_kwh: item.value / 1000, 
                // Guardamos la fecha exacta con su zona horaria (crítico para cambios de hora)
                fecha_utc: item.datetime, 
                // Identificador del periodo tarifario (Punta, Llano, Valle)
                periodo: item.indicator_name 
            };
        });

        // Guardado en disco (Fichero JSON)
        fs.writeFileSync('pvpc_datos.json', JSON.stringify(preciosLimpios, null, 2), 'utf-8');
        console.log(`Éxito: ${preciosLimpios.length} registros guardados en pvpc_datos.json`);

    } catch (error) {
        console.error('Fallo en la extracción:', error.message);
    }
}

obtenerPVPC();