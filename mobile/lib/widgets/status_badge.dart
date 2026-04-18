import 'package:flutter/material.dart';

/// A colored badge chip for project/request statuses.
class StatusBadge extends StatelessWidget {
  final String status;
  const StatusBadge({super.key, required this.status});

  Color _bg() {
    switch (status) {
      case 'Төлөвлөсөн': return const Color(0xFFEFF6FF);
      case 'Ажиллаж байгаа': return const Color(0xFFF0FDF4);
      case 'Хаагдсан': return const Color(0xFFF1F5F9);
      case 'Баталгааждсан': return const Color(0xFFF0FDF4);
      case 'Дуусгавар болсон': return const Color(0xFFFEF3C7);
      case 'Цуцлагдсан': return const Color(0xFFFEF2F2);
      default: return const Color(0xFFF8FAFC);
    }
  }

  Color _text() {
    switch (status) {
      case 'Төлөвлөсөн': return const Color(0xFF1D4ED8);
      case 'Ажиллаж байгаа': return const Color(0xFF16A34A);
      case 'Хаагдсан': return const Color(0xFF475569);
      case 'Баталгааждсан': return const Color(0xFF15803D);
      case 'Дуусгавар болсон': return const Color(0xFFD97706);
      case 'Цуцлагдсан': return const Color(0xFFDC2626);
      default: return const Color(0xFF64748B);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: _bg(),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        status,
        style: TextStyle(
          color: _text(),
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
