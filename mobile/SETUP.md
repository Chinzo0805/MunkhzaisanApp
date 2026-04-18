# MunkhZaisan Mobile App - Setup Guide

## Prerequisites
- Flutter SDK downloaded to `C:\Users\chinz\Downloads\flutter_sdk.zip`
- Git installed
- Android Studio or VS Code with Flutter extension

## Step 1: Extract and Configure Flutter SDK

```powershell
# Extract Flutter SDK (if not already done)
Write-Host "Extracting Flutter SDK..."
Expand-Archive "$env:USERPROFILE\Downloads\flutter_sdk.zip" -DestinationPath "C:\src" -Force

# Add Flutter to PATH for this session
$env:Path += ";C:\src\flutter\bin"

# Verify Flutter is working
flutter --version
flutter doctor
```

## Step 2: Create the Flutter Project Scaffold

```powershell
# Navigate to repo root
cd "C:\Repo\MunkhZaisan - Chinzo0805"

# Create Flutter project (generates Android/iOS native files)
# IMPORTANT: This will overwrite the 'lib' folder - we'll restore our files after
flutter create --org com.munkhzaisan --project-name munkhzaisan_mobile mobile

# Our source files are already in mobile/lib/ and mobile/pubspec.yaml
# The flutter create command generates the native folders (android/, ios/)
# but keeps our existing lib/ and pubspec.yaml since we created them first.
# If it overwrites them, restore from git.
```

## Step 3: Install Dependencies

```powershell
cd "C:\Repo\MunkhZaisan - Chinzo0805\mobile"

# Get all Flutter packages
flutter pub get
```

## Step 4: Configure Firebase

### Option A: Using FlutterFire CLI (Recommended)
```powershell
# Install FlutterFire CLI
dart pub global activate flutterfire_cli

# Add dart pub global to PATH
$env:Path += ";$env:USERPROFILE\AppData\Local\Pub\Cache\bin"

# Configure Firebase for the project
# This generates google-services.json and GoogleService-Info.plist
flutterfire configure --project=munkh-zaisan
```

### Option B: Manual Configuration
1. Go to [Firebase Console](https://console.firebase.google.com/project/munkh-zaisan)
2. Add Android app with package name: `com.munkhzaisan.munkhzaisan_mobile`
3. Download `google-services.json` → put in `mobile/android/app/`
4. Add iOS app with bundle ID: `com.munkhzaisan.munkhzaisanMobile`
5. Download `GoogleService-Info.plist` → put in `mobile/ios/Runner/`
6. Update `mobile/lib/firebase_options.dart` with the real values from FlutterFire

## Step 5: Enable Google Sign-In

### Android
In `mobile/android/app/build.gradle`, ensure `minSdkVersion` is **21+**.

In Firebase Console → Authentication → Sign-in providers → Enable **Google**.

Add your SHA-1 fingerprint to Firebase Android app:
```powershell
# Get debug SHA-1
cd mobile
.\gradlew signingReport
```

### iOS
In Firebase Console, download `GoogleService-Info.plist` and add `REVERSED_CLIENT_ID` as a URL scheme in Xcode.

## Step 6: Run the App

```powershell
cd "C:\Repo\MunkhZaisan - Chinzo0805\mobile"

# Check connected devices
flutter devices

# Run on Android (with emulator/device connected)
flutter run

# Build APK for distribution
flutter build apk --release

# Build for iOS (requires macOS + Xcode)
flutter build ios --release
```

## Project Structure

```
mobile/
├── lib/
│   ├── main.dart                    # App entry, routing
│   ├── firebase_options.dart        # Firebase config
│   ├── config/
│   │   └── constants.dart           # Firestore collections, colors
│   ├── providers/
│   │   └── app_state.dart           # Auth state + user data
│   ├── services/
│   │   ├── auth_service.dart        # Google Sign-In
│   │   └── api_service.dart         # Cloud Functions calls
│   ├── screens/
│   │   ├── login_screen.dart        # Google sign-in page
│   │   ├── dashboard_screen.dart    # Home with action grid
│   │   ├── tomd_projects_screen.dart
│   │   ├── time_attendance_screen.dart
│   │   ├── salary_screen.dart
│   │   ├── hse_screen.dart
│   │   └── warehouse_request_screen.dart
│   │   └── profile_screen.dart
│   └── widgets/
│       └── status_badge.dart        # Reusable status chip
├── pubspec.yaml                     # Dependencies
└── README.md
```

## Known Issues / TODOs

1. `firebase_options.dart` has placeholder Android/iOS app IDs — fix with `flutterfire configure`
2. iOS requires macOS + Xcode for builds
3. Test on real device for Google Sign-In (emulator may have issues)
4. Add proper error handling for network failures
5. Add push notifications (FCM) in future

## Firebase Project Info

- **Project**: munkh-zaisan
- **Region**: asia-east2
- **Functions base URL**: `https://asia-east2-munkh-zaisan.cloudfunctions.net`
- **Web app**: https://munkh-zaisan.web.app
