import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'firebase_options.dart';
import 'providers/app_state.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/tomd_projects_screen.dart';
import 'screens/time_attendance_screen.dart';
import 'screens/salary_screen.dart';
import 'screens/hse_screen.dart';
import 'screens/warehouse_request_screen.dart';
import 'screens/profile_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  runApp(
    ChangeNotifierProvider(
      create: (_) => AppState(),
      child: const MunkhZaisanApp(),
    ),
  );
}

class MunkhZaisanApp extends StatelessWidget {
  const MunkhZaisanApp({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();

    final router = GoRouter(
      initialLocation: '/login',
      redirect: (context, state) {
        if (appState.loading) return null;
        final loggedIn = appState.user != null;
        final hasData = appState.userData != null;
        final onLogin = state.matchedLocation == '/login';

        if (!loggedIn) return onLogin ? null : '/login';
        if (!hasData) return '/login'; // no employee record
        if (onLogin) return '/dashboard';
        return null;
      },
      routes: [
        GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
        GoRoute(path: '/dashboard', builder: (_, __) => const DashboardScreen()),
        GoRoute(path: '/tomd-projects', builder: (_, __) => const TomdProjectsScreen()),
        GoRoute(path: '/time-attendance', builder: (_, __) => const TimeAttendanceScreen()),
        GoRoute(path: '/salary', builder: (_, __) => const SalaryScreen()),
        GoRoute(path: '/hse', builder: (_, __) => const HseScreen()),
        GoRoute(path: '/warehouse-request', builder: (_, __) => const WarehouseRequestScreen()),
        GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
      ],
    );

    return MaterialApp.router(
      title: 'Мөнх-Зайсан',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1E3A5F)),
        useMaterial3: true,
        fontFamily: 'Roboto',
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1E3A5F),
          foregroundColor: Colors.white,
          elevation: 0,
        ),
      ),
      routerConfig: router,
    );
  }
}
