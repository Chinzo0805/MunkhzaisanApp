# MunkhZaisan Mobile - One-time Setup Script
# Run this after Flutter SDK is downloaded

Write-Host "=== MunkhZaisan Mobile Setup ===" -ForegroundColor Cyan

# --- Step 1: Extract Flutter SDK ---
$zipPath = "$env:USERPROFILE\Downloads\flutter_sdk.zip"
$installPath = "C:\src"

if (Test-Path $zipPath) {
    Write-Host "Extracting Flutter SDK..." -ForegroundColor Yellow
    if (-not (Test-Path "$installPath\flutter")) {
        Expand-Archive -Path $zipPath -DestinationPath $installPath -Force
        Write-Host "Extracted to $installPath\flutter" -ForegroundColor Green
    } else {
        Write-Host "Flutter already extracted at $installPath\flutter" -ForegroundColor Green
    }
} else {
    Write-Host "ERROR: Flutter SDK zip not found at $zipPath" -ForegroundColor Red
    Write-Host "Download it from: https://docs.flutter.dev/get-started/install/windows" -ForegroundColor Yellow
    exit 1
}

# --- Step 2: Add Flutter to PATH ---
$flutterBin = "$installPath\flutter\bin"
if ($env:Path -notlike "*$flutterBin*") {
    $env:Path += ";$flutterBin"
    Write-Host "Added Flutter to PATH for this session" -ForegroundColor Green
    Write-Host "To make permanent, add $flutterBin to your system PATH" -ForegroundColor Yellow
}

# Verify
try {
    $flutterVersion = & flutter --version 2>&1 | Select-Object -First 1
    Write-Host "Flutter: $flutterVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Flutter not working. Check extraction." -ForegroundColor Red
    exit 1
}

# --- Step 3: Navigate to repo ---
$repoRoot = "C:\Repo\MunkhZaisan - Chinzo0805"
Set-Location $repoRoot

# --- Step 4: Create Flutter project scaffold (generates android/ and ios/) ---
# Only creates if android/ doesn't exist yet
if (-not (Test-Path "mobile\android")) {
    Write-Host "Creating Flutter project scaffold..." -ForegroundColor Yellow
    
    # Temporarily back up our custom files
    $tempDir = "$env:TEMP\munkhzaisan_backup_$(Get-Date -Format 'yyyyMMddHHmmss')"
    New-Item -ItemType Directory -Path $tempDir | Out-Null
    Copy-Item "mobile\lib" -Destination "$tempDir\lib" -Recurse
    Copy-Item "mobile\pubspec.yaml" -Destination "$tempDir\pubspec.yaml"
    Write-Host "Backed up lib/ and pubspec.yaml to $tempDir" -ForegroundColor Yellow

    # Create project
    flutter create --org com.munkhzaisan --project-name munkhzaisan_mobile mobile

    # Restore our custom files
    Write-Host "Restoring custom source files..." -ForegroundColor Yellow
    Remove-Item "mobile\lib" -Recurse -Force
    Copy-Item "$tempDir\lib" -Destination "mobile\lib" -Recurse
    Copy-Item "$tempDir\pubspec.yaml" -Destination "mobile\pubspec.yaml" -Force
    Write-Host "Restored lib/ and pubspec.yaml" -ForegroundColor Green
} else {
    Write-Host "Android project already exists, skipping flutter create" -ForegroundColor Green
}

# --- Step 5: Get dependencies ---
Write-Host "Getting Flutter dependencies..." -ForegroundColor Yellow
Set-Location "mobile"
flutter pub get

if ($LASTEXITCODE -eq 0) {
    Write-Host "Dependencies installed successfully!" -ForegroundColor Green
} else {
    Write-Host "ERROR: flutter pub get failed" -ForegroundColor Red
    exit 1
}

# --- Step 6: FlutterFire CLI ---
Write-Host ""
Write-Host "=== Firebase Setup ===" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Install FlutterFire CLI:" -ForegroundColor White
Write-Host "   dart pub global activate flutterfire_cli" -ForegroundColor Gray
$dartBin = (Get-Command dart -ErrorAction SilentlyContinue)?.Source | Split-Path
if ($dartBin) {
    Write-Host "   Add to PATH: $env:USERPROFILE\AppData\Local\Pub\Cache\bin" -ForegroundColor Gray
}
Write-Host "2. Run:" -ForegroundColor White
Write-Host "   flutterfire configure --project=munkh-zaisan" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Enable Google Sign-In in Firebase Console > Authentication" -ForegroundColor White
Write-Host "4. Add SHA-1 fingerprint for Android to Firebase Console" -ForegroundColor White
Write-Host ""
Write-Host "=== Run the App ===" -ForegroundColor Cyan
Write-Host "flutter devices     # list connected devices" -ForegroundColor Gray
Write-Host "flutter run         # run on device/emulator" -ForegroundColor Gray
Write-Host "flutter build apk   # build release APK" -ForegroundColor Gray
Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
