import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

import '../services/api_service.dart';
import '../config/constants.dart';
import '../widgets/status_badge.dart';

class TomdProjectsScreen extends StatefulWidget {
  const TomdProjectsScreen({super.key});

  @override
  State<TomdProjectsScreen> createState() => _TomdProjectsScreenState();
}

class _TomdProjectsScreenState extends State<TomdProjectsScreen> {
  final _db = FirebaseFirestore.instance;

  List<Map<String, dynamic>> _projects = [];
  bool _loading = true;
  String _searchText = '';
  String _selectedStatus = '';

  // Create modal
  bool _showCreate = false;
  bool _creating = false;
  final _locationController = TextEditingController();

  // Ref edit
  String? _editingDocId;
  final _refController = TextEditingController();
  bool _saving = false;

  // TA Detail
  Map<String, dynamic>? _taProject;
  List<Map<String, dynamic>> _taRecords = [];
  bool _taLoading = false;

  @override
  void initState() {
    super.initState();
    _loadProjects();
  }

  @override
  void dispose() {
    _locationController.dispose();
    _refController.dispose();
    super.dispose();
  }

  Future<void> _loadProjects() async {
    setState(() => _loading = true);
    try {
      final snap = await _db
          .collection(kProjectCollection)
          .where('projectType', isEqualTo: 'overtime')
          .get();
      setState(() {
        _projects = snap.docs
            .map((d) => {'docId': d.id, ...d.data()})
            .toList();
      });
    } catch (e) {
      debugPrint('Error loading projects: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filtered {
    var list = _projects;
    if (_selectedStatus.isNotEmpty) {
      list = list.where((p) => p['Status'] == _selectedStatus).toList();
    }
    if (_searchText.isNotEmpty) {
      final q = _searchText.toLowerCase();
      list = list.where((p) =>
          (p['siteLocation'] ?? '').toLowerCase().contains(q) ||
          (p['referenceIdfromCustomer'] ?? '').toLowerCase().contains(q) ||
          (p['customer'] ?? '').toLowerCase().contains(q) ||
          '${p['id'] ?? ''}'.contains(q)).toList();
    }
    list.sort((a, b) {
      final ai = int.tryParse('${a['id'] ?? 0}') ?? 0;
      final bi = int.tryParse('${b['id'] ?? 0}') ?? 0;
      return bi.compareTo(ai);
    });
    return list;
  }

  Map<String, int> get _statusCounts {
    final counts = <String, int>{};
    for (final p in _projects) {
      final s = p['Status'] as String? ?? '—';
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }

  Future<void> _openTA(Map<String, dynamic> proj) async {
    setState(() {
      _taProject = proj;
      _taRecords = [];
      _taLoading = true;
    });
    _showTAModal();
    try {
      final id = int.tryParse('${proj['id'] ?? 0}') ?? 0;
      final snap = await _db
          .collection(kTimeAttendanceCollection)
          .where('ProjectID', isEqualTo: id)
          .get();
      setState(() {
        _taRecords = snap.docs.map((d) => d.data()).toList()
          ..sort((a, b) => '${b['Day']}'.compareTo('${a['Day']}'));
        _taLoading = false;
      });
    } catch (e) {
      setState(() => _taLoading = false);
    }
  }

  void _showTAModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setMbs) {
          return DraggableScrollableSheet(
            initialChildSize: 0.85,
            maxChildSize: 0.95,
            minChildSize: 0.4,
            builder: (_, scrollCtrl) =>
                _buildTASheet(scrollCtrl, setMbs),
          );
        },
      ),
    );
  }

  Widget _buildTASheet(
      ScrollController ctrl, StateSetter setMbs) {
    final proj = _taProject;
    if (proj == null) return const SizedBox();

    final totalWorking = _taRecords.fold<double>(
        0, (s, r) => s + (double.tryParse('${r['WorkingHour'] ?? 0}') ?? 0));
    final totalOvertime = _taRecords.fold<double>(
        0, (s, r) => s + (double.tryParse('${r['overtimeHour'] ?? 0}') ?? 0));

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: Column(
        children: [
          // Handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 4),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2)),
            ),
          ),
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E3A5F).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text('#${proj['id']}',
                          style: const TextStyle(
                              color: Color(0xFF1E3A5F),
                              fontWeight: FontWeight.bold,
                              fontSize: 12)),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        proj['siteLocation'] ?? proj['ProjectName'] ?? '—',
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 15),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  children: [
                    StatusBadge(status: proj['Status'] ?? ''),
                    if (proj['customer'] != null)
                      Text('🏢 ${proj['customer']}',
                          style: const TextStyle(
                              fontSize: 12, color: Colors.grey)),
                    if ((proj['referenceIdfromCustomer'] ?? '').isNotEmpty)
                      Text('🔖 ${proj['referenceIdfromCustomer']}',
                          style: const TextStyle(
                              fontSize: 12, color: Colors.grey)),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // If loading
          if (_taLoading)
            const Expanded(
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_taRecords.isEmpty)
            const Expanded(
              child: Center(
                child: Text('Бүртгэл олдсонгүй',
                    style: TextStyle(color: Colors.grey)),
              ),
            )
          else
            Expanded(
              child: Column(
                children: [
                  // Summary
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 10),
                    color: const Color(0xFFF8FAFC),
                    child: Row(
                      children: [
                        _SumTile(
                            label: 'Бүртгэл',
                            value: '${_taRecords.length}'),
                        const SizedBox(width: 20),
                        _SumTile(label: 'Ажилласан', value: '${_fmtNum(totalWorking)}ц'),
                        const SizedBox(width: 20),
                        _SumTile(
                          label: 'Илүү цаг',
                          value: '${_fmtNum(totalOvertime)}ц',
                          highlight: true,
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  // List
                  Expanded(
                    child: ListView.separated(
                      controller: ctrl,
                      padding: const EdgeInsets.all(12),
                      itemCount: _taRecords.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) => _TaRecordCard(_taRecords[i]),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _saveRef(Map<String, dynamic> proj) async {
    setState(() => _saving = true);
    try {
      await ApiService.manageProject(
        'update',
        {'referenceIdfromCustomer': _refController.text.trim()},
        projectId: proj['docId'] as String,
      );
      final idx = _projects.indexWhere((p) => p['docId'] == proj['docId']);
      if (idx >= 0) {
        setState(() {
          _projects[idx] = {
            ..._projects[idx],
            'referenceIdfromCustomer': _refController.text.trim(),
          };
          _editingDocId = null;
        });
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✔ Лавлах дугаар хадгалагдлаа')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('❌ Алдаа: $e')),
        );
      }
    } finally {
      setState(() => _saving = false);
    }
  }

  Future<void> _submitCreate() async {
    final loc = _locationController.text.trim();
    if (loc.isEmpty) return;
    setState(() => _creating = true);

    try {
      // Get max ID
      final allSnap = await _db.collection(kProjectCollection).get();
      int maxId = 0;
      for (final d in allSnap.docs) {
        final id = int.tryParse('${d.data()['id'] ?? 0}') ?? 0;
        if (id > maxId) maxId = id;
      }

      final today = DateTime.now().toIso8601String().substring(0, 10);
      final newProj = {
        'Status': 'Ажиллаж байгаа',
        'projectType': 'overtime',
        'customer': 'Мобиком Корпораци ХХК',
        'type': 'Үүрэн холбоо',
        'subtype': 'Гэмтэл саатал',
        'id': maxId + 1,
        'siteLocation': loc,
        'StartDate': today,
        'WosHour': 0, 'PlannedHour': 0, 'RealHour': 0,
        'additionalHour': 0, 'additionalValue': 0,
        'referenceIdfromCustomer': '',
        'EngineerWorkHour': 0, 'NonEngineerWorkHour': 0,
        'IncomeHR': 0, 'IncomeCar': 0, 'IncomeMaterial': 0,
        'ExpenceHR': 0, 'ExpenceCar': 0, 'ExpenceMaterial': 0, 'ExpenceHSE': 0,
        'BaseAmount': 0, 'EngineerHand': 0, 'TeamBounty': 0,
        'NonEngineerBounty': 0, 'OvertimeBounty': 0, 'OvertimeHours': 0,
        'WorkingHours': 0, 'HourPerformance': 0,
        'ProfitHR': 0, 'ProfitCar': 0, 'ProfitMaterial': 0, 'TotalProfit': 0,
        'EmployeeLaborCost': 0, 'ExpenseHRFromTrx': 0,
        'AdditionalOwner': '', 'ResponsibleEmp': '',
        'Detail': '', 'Comment': '',
        'EndDate': '', 'InvoiceDate': '', 'IncomeDate': '',
        'isInvoiceSent': false, 'isEbarimtSent': false,
      };

      final result = await ApiService.manageProject('add', newProj);
      setState(() {
        _projects.insert(0, {
          ...newProj,
          'docId': result['projectId'] ?? '',
        });
        _showCreate = false;
        _locationController.clear();
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✔ Төсөл үүсгэгдлаа')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('❌ Алдаа: $e')),
        );
      }
    } finally {
      setState(() => _creating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FB),
      appBar: AppBar(
        title: const Text('⏱️ TOMD ажлууд'),
        actions: [
          TextButton.icon(
            onPressed: () => setState(() => _showCreate = !_showCreate),
            icon: const Icon(Icons.add, color: Colors.white),
            label: const Text('Шинэ', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
      body: Column(
        children: [
          // Create form (inline collapsible)
          if (_showCreate) _buildCreateForm(),

          // Search
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
            child: TextField(
              onChanged: (v) => setState(() => _searchText = v),
              decoration: InputDecoration(
                hintText: 'Байршил, лавлах дугаар, харилцагч…',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),

          // Status chips
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              children: [
                _StatusChip(
                  label: 'Бүгд',
                  count: _projects.length,
                  selected: _selectedStatus.isEmpty,
                  onTap: () => setState(() => _selectedStatus = ''),
                ),
                for (final s in kStatusOrder)
                  if (_statusCounts.containsKey(s))
                    _StatusChip(
                      label: s,
                      count: _statusCounts[s]!,
                      selected: _selectedStatus == s,
                      onTap: () =>
                          setState(() => _selectedStatus = s),
                    ),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // Project list
          if (_loading)
            const Expanded(child: Center(child: CircularProgressIndicator()))
          else if (_filtered.isEmpty)
            const Expanded(
              child: Center(
                  child: Text('Илүү цагийн төсөл олдсонгүй',
                      style: TextStyle(color: Colors.grey))),
            )
          else
            Expanded(
              child: RefreshIndicator(
                onRefresh: _loadProjects,
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
                  itemCount: _filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) =>
                      _ProjectCard(
                        proj: _filtered[i],
                        editingDocId: _editingDocId,
                        refController: _refController,
                        saving: _saving,
                        onTapRow: _openTA,
                        onEditRef: (proj) => setState(() {
                          _editingDocId = proj['docId'] as String;
                          _refController.text =
                              proj['referenceIdfromCustomer'] ?? '';
                        }),
                        onSaveRef: _saveRef,
                        onCancelRef: () =>
                            setState(() => _editingDocId = null),
                        onRefChanged: (_) => setState(() {}),
                      ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildCreateForm() {
    final today = DateTime.now().toIso8601String().substring(0, 10);
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 10, 12, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF1E3A5F).withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('➕ Шинэ TOMD ажил үүсгэх',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 12),
          _InfoRow('Статус', 'Ажиллаж байгаа', isStatus: true),
          _InfoRow('Харилцагч', 'Мобиком Корпораци ХХК'),
          _InfoRow('Ажлын төрөл', 'Үүрэн холбоо — Гэмтэл саатал'),
          _InfoRow('Эхлэх огноо', today),
          const SizedBox(height: 12),
          TextField(
            controller: _locationController,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: 'Байршил *',
              hintText: 'Байршил оруулна уу…',
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8)),
              contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12, vertical: 10),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => setState(() {
                    _showCreate = false;
                    _locationController.clear();
                  }),
                  child: const Text('Болих'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: (_locationController.text.trim().isNotEmpty &&
                          !_creating)
                      ? _submitCreate
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1E3A5F),
                    foregroundColor: Colors.white,
                  ),
                  child: _creating
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2))
                      : const Text('✔ Үүсгэх'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isStatus;
  const _InfoRow(this.label, this.value, {this.isStatus = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(label,
                style:
                    const TextStyle(fontSize: 12, color: Colors.grey)),
          ),
          isStatus
              ? StatusBadge(status: value)
              : Text(value,
                  style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

class _ProjectCard extends StatelessWidget {
  final Map<String, dynamic> proj;
  final String? editingDocId;
  final TextEditingController refController;
  final bool saving;
  final void Function(Map<String, dynamic>) onTapRow;
  final void Function(Map<String, dynamic>) onEditRef;
  final void Function(Map<String, dynamic>) onSaveRef;
  final VoidCallback onCancelRef;
  final void Function(String) onRefChanged;

  const _ProjectCard({
    required this.proj,
    required this.editingDocId,
    required this.refController,
    required this.saving,
    required this.onTapRow,
    required this.onEditRef,
    required this.onSaveRef,
    required this.onCancelRef,
    required this.onRefChanged,
  });

  bool get isEditing => editingDocId == proj['docId'];

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      elevation: 1,
      shadowColor: Colors.black12,
      child: InkWell(
        onTap: () => onTapRow(proj),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text('#${proj['id']}',
                      style: const TextStyle(
                          fontSize: 12, color: Colors.grey)),
                  const Spacer(),
                  StatusBadge(status: proj['Status'] ?? ''),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                proj['siteLocation'] ?? proj['ProjectName'] ?? '—',
                style: const TextStyle(
                    fontWeight: FontWeight.bold, fontSize: 15),
              ),
              if (proj['customer'] != null)
                Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: Text('🏢 ${proj['customer']}',
                      style: const TextStyle(
                          fontSize: 12, color: Colors.grey)),
                ),
              if (proj['StartDate'] != null)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text('📅 ${proj['StartDate']}',
                      style: const TextStyle(
                          fontSize: 12, color: Colors.grey)),
                ),

              const Divider(height: 16),

              // Reference ID row
              Row(
                children: [
                  const Text('🔖 Лавлах дугаар:',
                      style: TextStyle(fontSize: 12, color: Colors.grey)),
                  const SizedBox(width: 8),
                  if (!isEditing)
                    Expanded(
                      child: GestureDetector(
                        onTap: () => onEditRef(proj),
                        child: Row(
                          children: [
                            Flexible(
                              child: Text(
                                (proj['referenceIdfromCustomer'] ?? '').isEmpty
                                    ? '—'
                                    : proj['referenceIdfromCustomer'],
                                style: const TextStyle(fontSize: 13),
                              ),
                            ),
                            const SizedBox(width: 4),
                            const Icon(Icons.edit,
                                size: 14, color: Colors.blue),
                          ],
                        ),
                      ),
                    )
                  else
                    Expanded(
                      child: Row(
                        children: [
                          Expanded(
                            child: SizedBox(
                              height: 34,
                              child: TextField(
                                controller: refController,
                                onChanged: onRefChanged,
                                autofocus: true,
                                style: const TextStyle(fontSize: 13),
                                decoration: InputDecoration(
                                  contentPadding:
                                      const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 6),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(6),
                                    borderSide: const BorderSide(
                                        color: Color(0xFF6366F1)),
                                  ),
                                ),
                                onSubmitted: (_) => onSaveRef(proj),
                              ),
                            ),
                          ),
                          IconButton(
                            icon: saving
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2))
                                : const Icon(Icons.check,
                                    color: Colors.green, size: 20),
                            onPressed:
                                saving ? null : () => onSaveRef(proj),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(
                                minWidth: 32, minHeight: 32),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close,
                                color: Colors.grey, size: 20),
                            onPressed: onCancelRef,
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(
                                minWidth: 32, minHeight: 32),
                          ),
                        ],
                      ),
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

class _TaRecordCard extends StatelessWidget {
  final Map<String, dynamic> rec;
  const _TaRecordCard(this.rec);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${rec['Day'] ?? '—'}',
                style: const TextStyle(
                    fontSize: 12,
                    color: Colors.grey),
              ),
              Text(
                '${rec['EmployeeFirstName'] ?? ''} ${rec['EmployeeLastName'] ?? ''}'.trim(),
                style: const TextStyle(
                    fontWeight: FontWeight.bold, fontSize: 13),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              _KV('Чиг үүрэг', '${rec['Role'] ?? '—'}'),
              const SizedBox(width: 16),
              _KV('Цаг', '${rec['WorkingHour'] ?? 0}ц'),
              const SizedBox(width: 8),
              Text(
                '+ ${rec['overtimeHour'] ?? 0}ц',
                style: const TextStyle(
                    color: Color(0xFFD97706),
                    fontWeight: FontWeight.bold,
                    fontSize: 13),
              ),
            ],
          ),
          if ((rec['comment'] ?? '').isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              '${rec['comment']}',
              style: const TextStyle(
                  fontSize: 11, color: Colors.grey, fontStyle: FontStyle.italic),
            ),
          ],
        ],
      ),
    );
  }
}

class _KV extends StatelessWidget {
  final String k, v;
  const _KV(this.k, this.v);
  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('$k: ',
            style: const TextStyle(fontSize: 12, color: Colors.grey)),
        Text(v, style: const TextStyle(fontSize: 12)),
      ],
    );
  }
}

class _SumTile extends StatelessWidget {
  final String label, value;
  final bool highlight;
  const _SumTile(
      {required this.label, required this.value, this.highlight = false});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(fontSize: 11, color: Colors.grey)),
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: highlight ? const Color(0xFFD97706) : const Color(0xFF1E293B),
          ),
        ),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  const _StatusChip({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 6),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF1E3A5F) : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
              color: selected
                  ? const Color(0xFF1E3A5F)
                  : const Color(0xFFCBD5E1)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                  fontSize: 12,
                  color: selected ? Colors.white : Colors.grey[700]),
            ),
            const SizedBox(width: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: selected
                    ? Colors.white.withOpacity(0.25)
                    : Colors.grey[200],
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                    fontSize: 10,
                    color: selected ? Colors.white : Colors.grey[600]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _fmtNum(double v) {
  if (v == v.truncate()) return v.truncate().toString();
  return v.toStringAsFixed(1);
}
