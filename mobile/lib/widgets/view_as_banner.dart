import 'package:flutter/material.dart';
import '../providers/app_state.dart';

class ViewAsBanner extends StatelessWidget {
  final AppState appState;

  const ViewAsBanner({super.key, required this.appState});

  @override
  Widget build(BuildContext context) {
    if (!appState.isViewingAs) return const SizedBox.shrink();
    final name = appState.effectiveFullName;
    final position = appState.viewAsData?['position'] ?? '';
    return Material(
      color: const Color(0xFFF59E0B),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Row(
            children: [
              const Icon(Icons.visibility, size: 16, color: Colors.white),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  '👁 $name${position.isNotEmpty ? ' · $position' : ''} -аар харж байна',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              GestureDetector(
                onTap: appState.clearViewAs,
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 4),
                  child: Icon(Icons.close, size: 16, color: Colors.white),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
