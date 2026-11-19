; Instalador do Duel Racer feito direto no makensis (o wine deste container não roda: sem o passo do
; electron-builder que gera o desinstalador no wine). Instala por usuário, sem pedir administrador.
Unicode true
SetCompressor /SOLID lzma
!include "MUI2.nsh"
!define APP "Duel Racer"
Name "${APP} ${VER}"
OutFile "${OUT}"
InstallDir "$LOCALAPPDATA\Programs\${APP}"
InstallDirRegKey HKCU "Software\DuelRacer" "InstallDir"
RequestExecutionLevel user
VIProductVersion "${VER}.0"
VIAddVersionKey "ProductName" "${APP}"
VIAddVersionKey "FileDescription" "Instalador do ${APP}"
VIAddVersionKey "CompanyName" "Victor Bandeira"
VIAddVersionKey "LegalCopyright" "Copyright © 2026 Victor Bandeira"
VIAddVersionKey "FileVersion" "${VER}"
VIAddVersionKey "ProductVersion" "${VER}"
!define MUI_ICON "${ICO}"
!define MUI_UNICON "${ICO}"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP}.exe"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"
Section
  nsExec::Exec 'taskkill /f /im "${APP}.exe"'
  SetOutPath "$INSTDIR"
  RMDir /r "$INSTDIR\resources"
  File /r "${SRC}\*.*"
  WriteUninstaller "$INSTDIR\Desinstalar ${APP}.exe"
  CreateShortcut "$DESKTOP\${APP}.lnk" "$INSTDIR\${APP}.exe"
  CreateShortcut "$SMPROGRAMS\${APP}.lnk" "$INSTDIR\${APP}.exe"
  WriteRegStr HKCU "Software\DuelRacer" "InstallDir" "$INSTDIR"
  !define UK "Software\Microsoft\Windows\CurrentVersion\Uninstall\DuelRacer"
  WriteRegStr HKCU "${UK}" "DisplayName" "${APP}"
  WriteRegStr HKCU "${UK}" "DisplayVersion" "${VER}"
  WriteRegStr HKCU "${UK}" "Publisher" "Victor Bandeira"
  WriteRegStr HKCU "${UK}" "DisplayIcon" "$INSTDIR\${APP}.exe"
  WriteRegStr HKCU "${UK}" "UninstallString" '"$INSTDIR\Desinstalar ${APP}.exe"'
  WriteRegDWORD HKCU "${UK}" "NoModify" 1
  WriteRegDWORD HKCU "${UK}" "NoRepair" 1
SectionEnd
Section "Uninstall"
  nsExec::Exec 'taskkill /f /im "${APP}.exe"'
  Delete "$DESKTOP\${APP}.lnk"
  Delete "$SMPROGRAMS\${APP}.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UK}"
  DeleteRegKey HKCU "Software\DuelRacer"
SectionEnd
