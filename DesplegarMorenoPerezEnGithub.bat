



@echo off
:: Configurar consola en UTF-8 para evitar problemas con tildes y eñes
chcp 65001 > nul

:: 1. Navegar al directorio del proyecto (con /d por si cambia de unidad de disco)
cd /d "D:\__md\_Datos\CodigoFuente y Plantillas\GitHub\MorenoPerez"

echo Directorio actual: %CD%
echo.

:: 2. Obtener el comentario (del primer parámetro %1 o pidiéndolo al usuario)
set "comment=%~1"

if "%comment%"=="" (
    set /p comment="Introduce el comentario para el commit: "
)

:: 3. Obtener fecha y hora formateada (limpiando los milisegundos de la hora)
set "hora=%time:~0,8%"
set "msg_final=%comment% (%date% a las %hora%)"

echo.
echo Mensaje que se usará: "%msg_final%"
echo.

:: 4. Ejecutar comandos Git con pausas
echo === [1/3] Ejecutando: git add . ===
git add .
echo Paso 1 completado.
pause
echo.

echo === [2/3] Ejecutando: git commit ===
git commit -m "%msg_final%"
echo Paso 2 completado.
pause
echo.

echo === [3/3] Ejecutando: git push ===
git push
echo Paso 3 completado.
pause

echo.
echo === Proceso finalizado con éxito ===

echo https://github.com/BorkosMoreno/MorenoPerez/actions

