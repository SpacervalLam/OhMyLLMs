param([Parameter(Mandatory=$true)][string]$ToolsDirectory)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
# PowerShell 7 parents may export their module path to Windows PowerShell 5.1.
# Load the matching built-in security module rather than inheriting that choice.
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -Force
New-Item -ItemType Directory -Force -Path $ToolsDirectory | Out-Null

function Get-VerifiedDownload([string]$Url,[string]$File,[string]$Publisher){
    if(-not (Test-Path -LiteralPath $File)){
        Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile ($File+'.download')
        $taskSignature=Get-AuthenticodeSignature -LiteralPath ($File+'.download')
        if($taskSignature.Status -ne 'Valid' -or $taskSignature.SignerCertificate.Subject -notmatch $Publisher){throw "Download signature validation failed: $File"}
        Move-Item -LiteralPath ($File+'.download') -Destination $File
    }
    $taskSignature=Get-AuthenticodeSignature -LiteralPath $File
    if($taskSignature.Status -ne 'Valid' -or $taskSignature.SignerCertificate.Subject -notmatch $Publisher){throw "Cached signature validation failed: $File"}
}

$taskCompiler=Join-Path $ToolsDirectory 'InnoSetup\ISCC.exe'
if(-not (Test-Path -LiteralPath $taskCompiler)){
    $taskInno=Join-Path $ToolsDirectory 'innosetup-6.7.3.exe'
    Get-VerifiedDownload 'https://github.com/jrsoftware/issrc/releases/download/is-6_7_3/innosetup-6.7.3.exe' $taskInno 'Pyrsys B.V.'
    $taskInstallDir=Join-Path $ToolsDirectory 'InnoSetup'
    $taskProcess=Start-Process -FilePath $taskInno -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/SP-','/CURRENTUSER','/NOICONS',('/DIR="'+$taskInstallDir+'"')) -WindowStyle Hidden -Wait -PassThru
    if($taskProcess.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $taskCompiler)){throw 'Inno Setup compiler installation failed.'}
}
$taskWebView=Join-Path $ToolsDirectory 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe'
Get-VerifiedDownload 'https://go.microsoft.com/fwlink/p/?LinkId=2124701' $taskWebView 'Microsoft Corporation'
$taskHashStream=[IO.File]::OpenRead($taskWebView)
$taskHasher=[Security.Cryptography.SHA256]::Create()
try { $taskHash=[BitConverter]::ToString($taskHasher.ComputeHash($taskHashStream)).Replace('-','').ToLowerInvariant() }
finally { $taskHashStream.Dispose(); $taskHasher.Dispose() }
$taskMetadata=@{
    compiler=$taskCompiler
    webview2=$taskWebView
    webview2Version=(Get-Item -LiteralPath $taskWebView).VersionInfo.ProductVersion
    webview2Sha256=$taskHash
}
$taskMetadata | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $ToolsDirectory 'paths.json') -Encoding utf8
Write-Output ('Installer tools ready. WebView2 '+$taskMetadata.webview2Version)
