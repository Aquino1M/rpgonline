node scripts/prepare_pack2.js

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = 'e:\PROJETOS SAAS\VSCODE PROJETOS\GAMES\ShadowAscension_Web3D\PACK2\Cactoro by Quaternius - IGn9lhdama.zip'
$extractDir = 'e:\PROJETOS SAAS\VSCODE PROJETOS\GAMES\ShadowAscension_Web3D\public\assets\models\mobs'
$archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
foreach ($entry in $archive.Entries) {
    if ($entry.Name -eq 'Cactoro.fbx') {
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $extractDir 'cactoro.fbx'), $true)
        Write-Output 'Extracted cactoro.fbx'
    }
}
$archive.Dispose()
Write-Output 'PACK2 processing complete'
