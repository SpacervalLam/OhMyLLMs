#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#ifndef PublishDirectory
  #define PublishDirectory "..\artifacts\desktop\OhMyLLMs"
#endif
#ifndef ReleaseDirectory
  #define ReleaseDirectory "..\artifacts\releases\1.0.0"
#endif

[Setup]
AppId={{2D54C99E-888D-48A3-A1B9-E06C9E72F958}
AppName=Oh My LLMs
AppVersion={#AppVersion}
AppVerName=Oh My LLMs {#AppVersion}
AppPublisher=SpacervalLam
AppPublisherURL=https://github.com/SpacervalLam/OhMyLLMs
DefaultDirName={localappdata}\Programs\OhMyLLMs
DefaultGroupName=Oh My LLMs
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.19041
UninstallDisplayIcon={app}\OhMyLLMs.exe
SetupIconFile=app.ico
LicenseFile=..\LICENSE.md
OutputDir={#ReleaseDirectory}
OutputBaseFilename=OhMyLLMs-{#AppVersion}-Setup-x64
Compression=lzma2/normal
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
CloseApplications=yes
RestartApplications=no
VersionInfoVersion={#AppVersion}.0
VersionInfoProductName=Oh My LLMs
VersionInfoProductVersion={#AppVersion}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked

[Files]
Source: "{#PublishDirectory}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#WebViewInstaller}"; Flags: dontcopy

[Icons]
Name: "{userprograms}\Oh My LLMs"; Filename: "{app}\OhMyLLMs.exe"; WorkingDir: "{app}"
Name: "{userdesktop}\Oh My LLMs"; Filename: "{app}\OhMyLLMs.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\OhMyLLMs.exe"; Description: "Launch Oh My LLMs"; Flags: nowait postinstall skipifsilent

[Code]
function HasWebView2: Boolean;
var
  Version: String;
  Key: String;
begin
  Key := 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  Result := (RegQueryStringValue(HKLM32, Key, 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0'));
  if not Result then
    Result := (RegQueryStringValue(HKCU, Key, 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0'));
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  if HasWebView2 then exit;
  ExtractTemporaryFile('MicrosoftEdgeWebView2RuntimeInstallerX64.exe');
  if not Exec(ExpandConstant('{tmp}\MicrosoftEdgeWebView2RuntimeInstallerX64.exe'), '/silent /install', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Result := 'Unable to start the bundled Microsoft WebView2 Runtime installer.';
    exit;
  end;
  if ResultCode = 3010 then NeedsRestart := True;
  if not HasWebView2 then
    Result := 'Microsoft WebView2 Runtime installation failed (code ' + IntToStr(ResultCode) + ').';
end;
