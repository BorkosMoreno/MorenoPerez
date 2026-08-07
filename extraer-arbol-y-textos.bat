@echo off
setlocal DisableDelayedExpansion

REM ==================================================================
REM LISTAS EDITABLES
REM Separador: punto y coma (;)
REM Las extensiones se escriben sin punto.
REM ==================================================================

REM Directorios a excluir, con todos sus ficheros y descendientes.
REM La coincidencia se hace por componentes de ruta.
REM Ejemplo: \node_modules excluye cualquier directorio node_modules.
set "DIR_EXCLUIR=\kk;\.git;\.github;\node_modules;\Documentacion"

REM Extensiones cuyo contenido no se incluira.
REM Si una extension esta en ambas listas, EXCLUIR tiene prioridad.
set "EXT_EXCLUIR=editorconfig;svg;ps1;jpg;jpeg;png;gif;bmp;ico;exe;dll;zip;7z;rar;pdf;docx;xlsx;pptx;gitkeep"

REM Extensiones consideradas explicitamente incluidas.
REM Las extensiones no presentes en ninguna lista tambien se intentaran
REM incluir si el fichero parece contener texto.
set "EXT_INCLUIR=txt;json;njk;md;bat;cmd;html;htm;css;js;ts;xml;csv;yaml;yml;ini;cfg;log;sql;gitignore"

REM ==================================================================
REM DIRECTORIO OBJETIVO
REM ==================================================================

set "OBJETIVO=%~1"

if not defined OBJETIVO (
    echo Directorio a examinar.
    set /p "OBJETIVO=Pulse ENTER para usar el directorio actual [%CD%]: "
)

if not defined OBJETIVO set "OBJETIVO=%CD%"

for %%I in ("%OBJETIVO%") do set "OBJETIVO=%%~fI"

if not exist "%OBJETIVO%" (
    echo [ERROR] El directorio no existe:
    echo %OBJETIVO%
    exit /b 1
)

REM ==================================================================
REM EXTRACCION DEL BLOQUE POWERSHELL INTERNO
REM ==================================================================

set "SELF_BAT=%~f0"
set "PS_TEMP=%TEMP%\extraer-info-%RANDOM%-%RANDOM%.ps1"

powershell.exe -NoProfile -Command "$lines=Get-Content -LiteralPath $env:SELF_BAT;$marker=[array]::IndexOf([string[]]$lines,'#<PS_PAYLOAD>');if($marker -lt 0){throw 'No se encontro el bloque PowerShell'};$payload=[string[]]$lines[($marker+1)..($lines.Count-1)];$enc=[System.Text.UTF8Encoding]::new($false);[System.IO.File]::WriteAllLines($env:PS_TEMP,$payload,$enc)"

if errorlevel 1 (
    echo [ERROR] No se pudo preparar el script interno.
    del /q "%PS_TEMP%" >nul 2>&1
    exit /b 1
)

echo.
echo Procesando:
echo %OBJETIVO%
echo.

REM ExecutionPolicy Bypass solo se aplica a este proceso, no modifica
REM la politica permanente del sistema.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS_TEMP%" "%OBJETIVO%" "%CD%"

set "RC=%ERRORLEVEL%"

del /q "%PS_TEMP%" >nul 2>&1

endlocal & exit /b %RC%


#<PS_PAYLOAD>
param(
    [Parameter(Mandatory = $true)]
    [string]$RootArgument,

    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Convert-DirectoryRules {
    param([string]$Text)

    $result = @()

    if ($null -eq $Text) {
        return $result
    }

    foreach ($raw in ($Text -split ';')) {
        $rule = $raw.Trim().Replace('/', '\').Trim('\')

        if (-not [string]::IsNullOrWhiteSpace($rule)) {
            $result += $rule
        }
    }

    return $result
}

function Convert-ExtensionList {
    param([string]$Text)

    $result = @()

    if ($null -eq $Text) {
        return $result
    }

    foreach ($raw in ($Text -split ';')) {
        $extension = $raw.Trim().TrimStart('.')

        if (-not [string]::IsNullOrWhiteSpace($extension)) {
            $result += $extension.ToLowerInvariant()
        }
    }

    return $result
}

function Test-ExtensionInList {
    param(
        [string]$Extension,
        [string[]]$List
    )

    if ([string]::IsNullOrWhiteSpace($Extension)) {
        return $false
    }

    foreach ($item in $List) {
        if ([string]::Equals(
            $Extension,
            $item,
            [System.StringComparison]::OrdinalIgnoreCase
        )) {
            return $true
        }
    }

    return $false
}

function Get-RelativePath {
    param([string]$Path)

    if ([string]::Equals(
        $Path,
        $script:Root,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        return ''
    }

    $prefix = $script:Root

    if (-not $prefix.EndsWith('\')) {
        $prefix += '\'
    }

    if ($Path.StartsWith(
        $prefix,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        return $Path.Substring($prefix.Length)
    }

    return $Path
}

function Get-DisplayPath {
    param([string]$Path)

    $relative = Get-RelativePath $Path

    if ([string]::IsNullOrWhiteSpace($relative)) {
        return $script:RootLabel
    }

    return ($script:RootLabel + '\' + $relative)
}

function Test-ExcludedDirectory {
    param([System.IO.DirectoryInfo]$Directory)

    $relative = Get-RelativePath $Directory.FullName

    foreach ($rule in $script:DirectoryRules) {
        if ([string]::Equals(
            $relative,
            $rule,
            [System.StringComparison]::OrdinalIgnoreCase
        )) {
            return $true
        }

        $pattern = '(^|\\)' + [System.Text.RegularExpressions.Regex]::Escape($rule) + '(\\|$)'

        if ([System.Text.RegularExpressions.Regex]::IsMatch(
            $relative,
            $pattern,
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
        )) {
            return $true
        }
    }

    return $false
}

function Test-IsCurrentOutputFile {
    param([string]$Path)

    foreach ($outputPath in $script:OutputPaths) {
        if ([string]::Equals(
            $Path,
            $outputPath,
            [System.StringComparison]::OrdinalIgnoreCase
        )) {
            return $true
        }
    }

    return $false
}

function Test-ReparsePoint {
    param([System.IO.FileSystemInfo]$Item)

    return (
        ($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
    )
}

function Get-FileExtension {
    param([System.IO.FileInfo]$File)

    $extension = $File.Extension

    if ([string]::IsNullOrWhiteSpace($extension)) {
        return ''
    }

    $extension = $extension.TrimStart('.')

    if ([string]::IsNullOrWhiteSpace($extension)) {
        return ''
    }

    return $extension.ToLowerInvariant()
}

function Write-TreeAndCollect {
    param(
        [System.IO.DirectoryInfo]$Directory,
        [string]$Prefix
    )

    [void]$script:AllDirectories.Add($Directory)

    try {
        $entries = @(
            Get-ChildItem -LiteralPath $Directory.FullName -Force -ErrorAction Stop |
            Sort-Object -Property Name
        )
    }
    catch {
        $script:SchemaWriter.WriteLine(
            $Prefix + '[AVISO: no se pudo leer este directorio]'
        )
        return
    }

    $visibleEntries = @()

    foreach ($entry in $entries) {
        if ($entry.PSIsContainer) {
            if (Test-ExcludedDirectory $entry) {
                continue
            }
        }
        elseif (Test-IsCurrentOutputFile $entry.FullName) {
            continue
        }

        $visibleEntries += $entry
    }

    for ($index = 0; $index -lt $visibleEntries.Count; $index++) {
        $entry = $visibleEntries[$index]

        if ($index -eq ($visibleEntries.Count - 1)) {
            $branch = '\-- '
            $nextPrefix = $Prefix + '    '
        }
        else {
            $branch = '|-- '
            $nextPrefix = $Prefix + '|   '
        }

        $script:SchemaWriter.WriteLine(
            $Prefix + $branch + $entry.Name
        )

        if ($entry.PSIsContainer) {
            if (Test-ReparsePoint $entry) {
                [void]$script:AllDirectories.Add($entry)
            }
            else {
                Write-TreeAndCollect $entry $nextPrefix
            }
        }
        else {
            [void]$script:AllFiles.Add($entry)
        }
    }
}

function Get-FileSample {
    param([System.IO.FileInfo]$File)

    $stream = $null

    try {
        $stream = [System.IO.File]::Open(
            $File.FullName,
            [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::Read,
            [System.IO.FileShare]::ReadWrite
        )

        $count = [int][System.Math]::Min(
            [int64]65536,
            $stream.Length
        )

        [byte[]]$buffer = New-Object byte[] $count

        if ($count -eq 0) {
            return $buffer
        }

        $read = $stream.Read($buffer, 0, $count)

        if ($read -eq $count) {
            return $buffer
        }

        [byte[]]$shortBuffer = New-Object byte[] $read
        [System.Array]::Copy($buffer, $shortBuffer, $read)

        return $shortBuffer
    }
    finally {
        if ($null -ne $stream) {
            $stream.Dispose()
        }
    }
}

function Get-TextEncoding {
    param([byte[]]$Bytes)

    $utf8 = [System.Text.UTF8Encoding]::new($false, $true)

    if (($null -eq $Bytes) -or ($Bytes.Length -eq 0)) {
        return $utf8
    }

    if (
        ($Bytes.Length -ge 4) -and
        ($Bytes[0] -eq 0xFF) -and
        ($Bytes[1] -eq 0xFE) -and
        ($Bytes[2] -eq 0x00) -and
        ($Bytes[3] -eq 0x00)
    ) {
        return [System.Text.UTF32Encoding]::new($false, $true, $true)
    }

    if (
        ($Bytes.Length -ge 4) -and
        ($Bytes[0] -eq 0x00) -and
        ($Bytes[1] -eq 0x00) -and
        ($Bytes[2] -eq 0xFE) -and
        ($Bytes[3] -eq 0xFF)
    ) {
        return [System.Text.UTF32Encoding]::new($true, $true, $true)
    }

    if (
        ($Bytes.Length -ge 3) -and
        ($Bytes[0] -eq 0xEF) -and
        ($Bytes[1] -eq 0xBB) -and
        ($Bytes[2] -eq 0xBF)
    ) {
        return $utf8
    }

    if (
        ($Bytes.Length -ge 2) -and
        ($Bytes[0] -eq 0xFF) -and
        ($Bytes[1] -eq 0xFE)
    ) {
        return [System.Text.UnicodeEncoding]::new($false, $true, $true)
    }

    if (
        ($Bytes.Length -ge 2) -and
        ($Bytes[0] -eq 0xFE) -and
        ($Bytes[1] -eq 0xFF)
    ) {
        return [System.Text.UnicodeEncoding]::new($true, $true, $true)
    }

    $pairCount = [int]($Bytes.Length / 2)

    if ($pairCount -ge 8) {
        $evenZeros = 0
        $oddZeros = 0

        for ($index = 0; $index -lt ($pairCount * 2); $index += 2) {
            if ($Bytes[$index] -eq 0) {
                $evenZeros++
            }

            if ($Bytes[$index + 1] -eq 0) {
                $oddZeros++
            }
        }

        $evenRatio = $evenZeros / $pairCount
        $oddRatio = $oddZeros / $pairCount

        if (($oddRatio -gt 0.35) -and ($evenRatio -lt 0.10)) {
            return [System.Text.UnicodeEncoding]::new($false, $false, $true)
        }

        if (($evenRatio -gt 0.35) -and ($oddRatio -lt 0.10)) {
            return [System.Text.UnicodeEncoding]::new($true, $false, $true)
        }
    }

    try {
        [void]$utf8.GetCharCount($Bytes)
        return $utf8
    }
    catch {
        # No es UTF-8 valido. Se intentara Windows-1252.
    }

    if ($Bytes -contains [byte]0) {
        return $null
    }

    return [System.Text.Encoding]::GetEncoding(
        1252,
        [System.Text.EncoderExceptionFallback]::new(),
        [System.Text.DecoderExceptionFallback]::new()
    )
}

function Test-TextFile {
    param([System.IO.FileInfo]$File)

    try {
        [byte[]]$sample = @(Get-FileSample $File)
        $encoding = Get-TextEncoding $sample

        if ($null -eq $encoding) {
            return $null
        }

        $reader = $null

        try {
            $reader = [System.IO.StreamReader]::new(
                $File.FullName,
                $encoding,
                $true,
                65536
            )

            [char[]]$buffer = New-Object char[] 65536

            [int64]$totalCharacters = 0
            [int64]$badCharacters = 0

            while (($read = $reader.Read($buffer, 0, $buffer.Length)) -gt 0) {
                for ($index = 0; $index -lt $read; $index++) {
                    $code = [int]$buffer[$index]
                    $totalCharacters++

                    if ($code -eq 0) {
                        return $null
                    }

                    if (
                        (
                            ($code -lt 32) -and
                            ($code -ne 9) -and
                            ($code -ne 10) -and
                            ($code -ne 13)
                        ) -or
                        (($code -ge 127) -and ($code -le 159)) -or
                        ($code -eq 0xFFFD)
                    ) {
                        $badCharacters++
                    }
                }
            }

            $allowedBadCharacters = [System.Math]::Max(
                3,
                [System.Math]::Floor($totalCharacters / 100.0)
            )

            if ($badCharacters -gt $allowedBadCharacters) {
                return $null
            }

            return [PSCustomObject]@{
                Encoding = $encoding
                Empty    = ($totalCharacters -eq 0)
            }
        }
        finally {
            if ($null -ne $reader) {
                $reader.Dispose()
            }
        }
    }
    catch {
        return $null
    }
}

function Copy-TextFileToWriter {
    param(
        [System.IO.FileInfo]$File,
        [System.Text.Encoding]$Encoding,
        [System.IO.StreamWriter]$Writer
    )

    $reader = $null

    try {
        $reader = [System.IO.StreamReader]::new(
            $File.FullName,
            $Encoding,
            $true,
            65536
        )

        [char[]]$buffer = New-Object char[] 65536

        $readAny = $false
        $lastWasLineFeed = $false

        while (($read = $reader.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $Writer.Write($buffer, 0, $read)

            $readAny = $true
            $lastWasLineFeed = ([int]$buffer[$read - 1] -eq 10)
        }

        if ((-not $readAny) -or (-not $lastWasLineFeed)) {
            $Writer.WriteLine()
        }
    }
    finally {
        if ($null -ne $reader) {
            $reader.Dispose()
        }
    }
}

$RootItem = Get-Item -LiteralPath $RootArgument -Force

if (-not $RootItem.PSIsContainer) {
    throw 'El parametro indicado no es un directorio.'
}

$Root = $RootItem.FullName

if (($Root.Length -gt 3) -and $Root.EndsWith('\')) {
    $Root = $Root.TrimEnd('\')
}

$OutputDirectoryItem = Get-Item -LiteralPath $OutputDirectory -Force

if (-not $OutputDirectoryItem.PSIsContainer) {
    throw 'El directorio de salida no es valido.'
}

$OutputDirectory = $OutputDirectoryItem.FullName

$RootLabel = Split-Path -Path $Root -Leaf

if ([string]::IsNullOrWhiteSpace($RootLabel)) {
    $RootLabel = $Root
}

$Timestamp = Get-Date -Format 'yyyy-MM-dd----HH-mm'

$SchemaPath = Join-Path $OutputDirectory ("esquema-" + $Timestamp + ".txt")
$ContentPath = Join-Path $OutputDirectory ("contenido-" + $Timestamp + ".txt")
$ExtensionsPath = Join-Path $OutputDirectory ("extensiones-no-contempladas-" + $Timestamp + ".txt")

$OutputPaths = @(
    $SchemaPath,
    $ContentPath,
    $ExtensionsPath
)

$DirectoryRules = @(Convert-DirectoryRules $env:DIR_EXCLUIR)
$ExcludedExtensions = @(Convert-ExtensionList $env:EXT_EXCLUIR)
$IncludedExtensions = @(Convert-ExtensionList $env:EXT_INCLUIR)

$AllDirectories = [System.Collections.ArrayList]::new()
$AllFiles = [System.Collections.ArrayList]::new()
$UnknownExtensions = @{}

$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

$SchemaWriter = $null
$ContentWriter = $null
$ExtensionWriter = $null

try {
    $SchemaWriter = [System.IO.StreamWriter]::new(
        $SchemaPath,
        $false,
        $Utf8NoBom
    )

    $ContentWriter = [System.IO.StreamWriter]::new(
        $ContentPath,
        $false,
        $Utf8NoBom
    )

    $ExtensionWriter = [System.IO.StreamWriter]::new(
        $ExtensionsPath,
        $false,
        $Utf8NoBom
    )

    $SchemaWriter.WriteLine("DIRECTORIO EXAMINADO: $Root")
    $SchemaWriter.WriteLine("FECHA DE EJECUCION  : $Timestamp")
    $SchemaWriter.WriteLine('')
    $SchemaWriter.WriteLine('================================================================')
    $SchemaWriter.WriteLine('ARBOL DEL DIRECTORIO')
    $SchemaWriter.WriteLine('================================================================')
    $SchemaWriter.WriteLine($Root)

    Write-TreeAndCollect $RootItem ''

    $SchemaWriter.WriteLine('')
    $SchemaWriter.WriteLine('================================================================')
    $SchemaWriter.WriteLine('LISTADO DETALLADO')
    $SchemaWriter.WriteLine('================================================================')
    $SchemaWriter.WriteLine('NOTA: los directorios no tienen un tamano propio fiable en Windows.')
    $SchemaWriter.WriteLine('Por ello se muestra Tamano: N/D para directorios.')
    $SchemaWriter.WriteLine('')

    $SchemaWriter.WriteLine('--- DIRECTORIOS ---')

    foreach ($directory in @($AllDirectories | Sort-Object -Property FullName)) {
        try {
            $created = $directory.CreationTime.ToString('yyyy-MM-dd HH:mm:ss')
        }
        catch {
            $created = 'N/D'
        }

        $SchemaWriter.WriteLine(
            ('DIRECTORIO | {0} | Creacion: {1} | Tamano: N/D' -f
                $directory.FullName,
                $created
            )
        )
    }

    $SchemaWriter.WriteLine('')
    $SchemaWriter.WriteLine('--- FICHEROS ---')

    foreach ($file in @($AllFiles | Sort-Object -Property FullName)) {
        try {
            $created = $file.CreationTime.ToString('yyyy-MM-dd HH:mm:ss')
            $size = $file.Length
        }
        catch {
            $created = 'N/D'
            $size = 'N/D'
        }

        $SchemaWriter.WriteLine(
            ('FICHERO    | {0} | Creacion: {1} | Tamano: {2} bytes' -f
                $file.FullName,
                $created,
                $size
            )
        )
    }

    foreach ($file in $AllFiles) {
        $extension = Get-FileExtension $file

        if (
            (-not (Test-ExtensionInList $extension $ExcludedExtensions)) -and
            (-not (Test-ExtensionInList $extension $IncludedExtensions))
        ) {
            if ([string]::IsNullOrWhiteSpace($extension)) {
                $UnknownExtensions['[sin-extension]'] = $true
            }
            else {
                $UnknownExtensions[$extension] = $true
            }
        }
    }

    $ExtensionWriter.WriteLine("DIRECTORIO EXAMINADO: $Root")
    $ExtensionWriter.WriteLine("FECHA DE EJECUCION  : $Timestamp")
    $ExtensionWriter.WriteLine('')
    $ExtensionWriter.WriteLine(
        'Extensiones presentes que no estan en EXT_EXCLUIR ni en EXT_INCLUIR.'
    )
    $ExtensionWriter.WriteLine('----------------------------------------------------------------')

    if ($UnknownExtensions.Count -eq 0) {
        $ExtensionWriter.WriteLine('(ninguna)')
    }
    else {
        foreach ($extension in @($UnknownExtensions.Keys | Sort-Object)) {
            $ExtensionWriter.WriteLine($extension)
        }
    }

    $ContentWriter.WriteLine("CONTENIDO CONCATENADO DE: $Root")
    $ContentWriter.WriteLine("FECHA DE EJECUCION      : $Timestamp")
    $ContentWriter.WriteLine('')

    $ContentFiles = 0

    foreach ($file in @($AllFiles | Sort-Object -Property FullName)) {
        if (Test-ReparsePoint $file) {
            continue
        }

        $extension = Get-FileExtension $file

        if (Test-ExtensionInList $extension $ExcludedExtensions) {
            continue
        }

        $textInfo = Test-TextFile $file

        if ($null -eq $textInfo) {
            continue
        }

        $location = Get-DisplayPath $file.DirectoryName
        $route = Get-DisplayPath $file.FullName

        $ContentWriter.WriteLine('################################################################')
        $ContentWriter.WriteLine(("## FICHERO  : {0}" -f $file.Name))
        $ContentWriter.WriteLine(("## UBICACION: {0}" -f $location))
        $ContentWriter.WriteLine(("## RUTA     : {0}" -f $route))
        $ContentWriter.WriteLine('################################################################')
        $ContentWriter.WriteLine('')

        try {
            Copy-TextFileToWriter $file $textInfo.Encoding $ContentWriter
            $ContentFiles++
        }
        catch {
            $ContentWriter.WriteLine(
                '[AVISO: no se pudo leer completamente este fichero]'
            )
        }

        $ContentWriter.WriteLine(
            ("################## FIN: {0}  ##################" -f $file.Name)
        )
        $ContentWriter.WriteLine('')
    }

    Write-Output ''
    Write-Output 'Proceso terminado.'
    Write-Output ("Ficheros de texto incluidos: {0}" -f $ContentFiles)
    Write-Output ("Esquema: {0}" -f $SchemaPath)
    Write-Output ("Contenido: {0}" -f $ContentPath)
    Write-Output ("Extensiones no contempladas: {0}" -f $ExtensionsPath)
}
finally {
    if ($null -ne $ExtensionWriter) {
        $ExtensionWriter.Dispose()
    }

    if ($null -ne $ContentWriter) {
        $ContentWriter.Dispose()
    }

    if ($null -ne $SchemaWriter) {
        $SchemaWriter.Dispose()
    }
}