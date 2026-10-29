param([switch]$WithoutVendor)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
if (!(Test-Path -LiteralPath (Join-Path $projectRoot 'public/build/manifest.json'))) { throw 'Ejecuta npm run build antes de empaquetar.' }
if (!$WithoutVendor -and !(Test-Path -LiteralPath (Join-Path $projectRoot 'vendor/autoload.php'))) { throw 'Falta vendor. Ejecuta composer install o usa -WithoutVendor.' }
$outputDirectory = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$outputPath = Join-Path $outputDirectory ('dragonsvc-smarterasp-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.zip')
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::Open($outputPath, [IO.Compression.ZipArchiveMode]::Create)
try {
    $directories = @('app','config','resources','routes','public')
    if (!$WithoutVendor) { $directories += 'vendor' }
    foreach ($directory in $directories) {
        foreach ($file in Get-ChildItem -LiteralPath (Join-Path $projectRoot $directory) -File -Force -Recurse) {
            $relative = [IO.Path]::GetRelativePath($projectRoot, $file.FullName).Replace('\','/')
            if ($relative.StartsWith('public/storage/') -or $relative -eq 'public/hot') { continue }
            if (($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "No se empaquetan enlaces: $relative" }
            if ($file.Name -eq '.env' -or $file.Name -eq 'auth.json' -or $file.Name -match '\.(sqlite|log|key|pem)$') { continue }
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, ('dragonsvc/' + $relative), [IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    }
    foreach ($relative in @('artisan','composer.json','composer.lock','.env.production.example','SMARTERASP_DEPLOY.md','bootstrap/app.php','bootstrap/providers.php')) {
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $projectRoot $relative), ('dragonsvc/' + $relative)) | Out-Null
    }
    foreach ($directory in @('bootstrap/cache','storage/app/private','storage/app/public','storage/framework/cache/data','storage/framework/sessions','storage/framework/views','storage/logs')) {
        $archive.CreateEntry('dragonsvc/' + $directory + '/') | Out-Null
    }
} finally { $archive.Dispose() }
Write-Output $outputPath
