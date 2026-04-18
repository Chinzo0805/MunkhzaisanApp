import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();

    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FB),
      appBar: AppBar(
        title: const Text('Мөнх-Зайсан'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_outline),
            tooltip: 'Миний мэдээлэл',
            onPressed: () => context.push('/profile'),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Гарах',
            onPressed: () async {
              await appState.signOut();
            },
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Welcome card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1E3A5F), Color(0xFF274F82)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Сайн уу, ${appState.firstName}!',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      appState.position,
                      style: const TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Action grid
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.1,
                children: [
                  _ActionCard(
                    icon: Icons.access_time,
                    label: 'Ажиллах цагийн хүсэлт',
                    color: const Color(0xFF6366F1),
                    onTap: () => context.push('/time-attendance'),
                  ),
                  _ActionCard(
                    icon: Icons.timer_outlined,
                    label: 'TOMD ажлууд',
                    color: const Color(0xFF1E3A5F),
                    onTap: () => context.push('/tomd-projects'),
                  ),
                  _ActionCard(
                    icon: Icons.payments_outlined,
                    label: 'Цалингийн мэдээлэл',
                    color: const Color(0xFF059669),
                    onTap: () => context.push('/salary'),
                  ),
                  _ActionCard(
                    icon: Icons.health_and_safety_outlined,
                    label: 'HSE Зааварчилгаа',
                    color: const Color(0xFFD97706),
                    onTap: () => context.push('/hse'),
                  ),
                  _ActionCard(
                    icon: Icons.inventory_2_outlined,
                    label: 'Агуулахын хүсэлт',
                    color: const Color(0xFF7C3AED),
                    onTap: () => context.push('/warehouse-request'),
                  ),
                  _ActionCard(
                    icon: Icons.person_outlined,
                    label: 'Миний мэдээлэл',
                    color: const Color(0xFF0891B2),
                    onTap: () => context.push('/profile'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ActionCard({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      elevation: 1,
      shadowColor: Colors.black12,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 28),
              ),
              const SizedBox(height: 10),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF1E293B),
                ),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
