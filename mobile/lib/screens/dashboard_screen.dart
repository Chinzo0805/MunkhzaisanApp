import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../providers/app_state.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
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

              // Supervisor: View-as section
              if (appState.isSupervisor) ...[
                const SizedBox(height: 24),
                _SupervisorViewAsCard(appState: appState),
              ],
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

// ---------------------------------------------------------------------------
// Supervisor: View-as card
// ---------------------------------------------------------------------------

class _SupervisorViewAsCard extends StatefulWidget {
  final AppState appState;
  const _SupervisorViewAsCard({required this.appState});

  @override
  State<_SupervisorViewAsCard> createState() => _SupervisorViewAsCardState();
}

class _SupervisorViewAsCardState extends State<_SupervisorViewAsCard> {
  @override
  Widget build(BuildContext context) {
    final appState = widget.appState;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: appState.isViewingAs
              ? const Color(0xFFF59E0B)
              : const Color(0xFFE2E8F0),
          width: appState.isViewingAs ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.supervisor_account,
                  color: Color(0xFF1E3A5F), size: 18),
              const SizedBox(width: 8),
              const Text(
                'Ажилтанаар харах',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF1E3A5F),
                ),
              ),
              const Spacer(),
              if (appState.isViewingAs)
                TextButton.icon(
                  onPressed: appState.clearViewAs,
                  icon: const Icon(Icons.close, size: 14),
                  label: const Text('Болих', style: TextStyle(fontSize: 12)),
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFFEF4444),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (appState.isViewingAs)
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.visibility,
                      size: 16, color: Color(0xFFD97706)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          appState.effectiveFullName,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            color: Color(0xFF92400E),
                          ),
                        ),
                        if ((appState.viewAsData?['position'] ?? '').isNotEmpty)
                          Text(
                            appState.viewAsData!['position'],
                            style: const TextStyle(
                                fontSize: 11, color: Color(0xFFB45309)),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _openEmployeePicker(context, appState),
              icon: const Icon(Icons.person_search, size: 16),
              label: Text(
                appState.isViewingAs ? 'Өөр ажилтан сонгох' : 'Ажилтан сонгох',
                style: const TextStyle(fontSize: 13),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF1E3A5F),
                side: const BorderSide(color: Color(0xFF1E3A5F)),
                padding: const EdgeInsets.symmetric(vertical: 10),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openEmployeePicker(BuildContext context, AppState appState) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _EmployeePickerSheet(appState: appState),
    );
  }
}

// ---------------------------------------------------------------------------
// Employee picker bottom sheet
// ---------------------------------------------------------------------------

class _EmployeePickerSheet extends StatefulWidget {
  final AppState appState;
  const _EmployeePickerSheet({required this.appState});

  @override
  State<_EmployeePickerSheet> createState() => _EmployeePickerSheetState();
}

class _EmployeePickerSheetState extends State<_EmployeePickerSheet> {
  final _db = FirebaseFirestore.instance;
  final _searchCtrl = TextEditingController();

  List<Map<String, dynamic>> _allEmployees = [];
  List<Map<String, dynamic>> _filtered = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadEmployees();
    _searchCtrl.addListener(_filter);
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadEmployees() async {
    try {
      final snap = await _db
          .collection('employees')
          .where('State', isEqualTo: 'Ажиллаж байгаа')
          .get();
      final list = snap.docs
          .map((d) => {'docId': d.id, ...d.data()})
          .toList();
      list.sort((a, b) =>
          '${a['FirstName']}'.compareTo('${b['FirstName']}'));
      if (mounted) {
        setState(() {
          _allEmployees = list;
          _filtered = list;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _filter() {
    final q = _searchCtrl.text.toLowerCase();
    setState(() {
      _filtered = _allEmployees.where((e) {
        final name = '${e['LastName'] ?? ''} ${e['FirstName'] ?? ''}'.toLowerCase();
        final pos = '${e['Position'] ?? ''}'.toLowerCase();
        final dept = '${e['Department'] ?? ''}'.toLowerCase();
        final id = '${e['Id'] ?? ''}'.toLowerCase();
        return name.contains(q) || pos.contains(q) || dept.contains(q) || id.contains(q);
      }).toList();
    });
  }

  void _select(Map<String, dynamic> emp) {
    final viewData = {
      'employeeId': '${emp['Id'] ?? ''}',
      'firstName': '${emp['FirstName'] ?? ''}',
      'lastName': '${emp['LastName'] ?? ''}',
      'position': '${emp['Position'] ?? ''}',
      'department': '${emp['Department'] ?? ''}',
    };
    widget.appState.setViewAs(viewData);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      builder: (_, scrollCtrl) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.only(top: 10, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  const Icon(Icons.person_search,
                      color: Color(0xFF1E3A5F), size: 20),
                  const SizedBox(width: 8),
                  const Text(
                    'Ажилтан сонгох',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _searchCtrl,
                autofocus: true,
                decoration: InputDecoration(
                  hintText: 'Нэр, албан тушаал, ID...',
                  prefixIcon: const Icon(Icons.search, size: 20),
                  suffixIcon: _searchCtrl.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, size: 18),
                          onPressed: () => _searchCtrl.clear(),
                        )
                      : null,
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10)),
                  isDense: true,
                ),
              ),
            ),
            const SizedBox(height: 8),
            if (_loading)
              const Expanded(
                  child: Center(child: CircularProgressIndicator()))
            else if (_filtered.isEmpty)
              const Expanded(
                child: Center(
                  child: Text('Ажилтан олдсонгүй',
                      style: TextStyle(color: Colors.grey)),
                ),
              )
            else
              Expanded(
                child: ListView.builder(
                  controller: scrollCtrl,
                  itemCount: _filtered.length,
                  itemBuilder: (_, i) {
                    final emp = _filtered[i];
                    final name =
                        '${emp['LastName'] ?? ''} ${emp['FirstName'] ?? ''}'
                            .trim();
                    final pos = '${emp['Position'] ?? ''}';
                    final dept = '${emp['Department'] ?? ''}';
                    final empIdStr = '${emp['Id'] ?? ''}';
                    final isSelected =
                        widget.appState.viewAsData?['employeeId'] ==
                            empIdStr;
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: isSelected
                            ? const Color(0xFFF59E0B)
                            : const Color(0xFF1E3A5F).withOpacity(0.1),
                        child: Text(
                          (emp['FirstName'] as String? ?? '').isNotEmpty
                              ? (emp['FirstName'] as String)[0].toUpperCase()
                              : '?',
                          style: TextStyle(
                            color: isSelected
                                ? Colors.white
                                : const Color(0xFF1E3A5F),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      title: Text(
                        name,
                        style: TextStyle(
                          fontWeight: isSelected
                              ? FontWeight.w700
                              : FontWeight.w500,
                          fontSize: 14,
                        ),
                      ),
                      subtitle: Text(
                        [pos, dept].where((s) => s.isNotEmpty).join(' · '),
                        style: const TextStyle(fontSize: 12),
                      ),
                      trailing: isSelected
                          ? const Icon(Icons.check_circle,
                              color: Color(0xFFF59E0B))
                          : null,
                      onTap: () => _select(emp),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
