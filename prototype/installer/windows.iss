[Setup]
AppId=Castiel.Workbench
AppName=Castiel
AppVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\Castiel
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\..\release
OutputBaseFilename=Castiel-Setup-{#AppVersion}-win-x64
UninstallDisplayIcon={app}\Castiel.exe
Compression=lzma2/fast
SolidCompression=yes
WizardStyle=modern

[Files]
Source: "..\..\release\Castiel-win32-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userprograms}\Castiel"; Filename: "{app}\Castiel.exe"

[Run]
Filename: "{app}\Castiel.exe"; Description: "Launch Castiel"; Flags: nowait postinstall skipifsilent
