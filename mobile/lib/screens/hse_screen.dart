import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';
import '../config/constants.dart';

class HseScreen extends StatefulWidget {
  const HseScreen({super.key});

  @override
  State<HseScreen> createState() => _HseScreenState();
}

class _HseScreenState extends State<HseScreen> {
  final _db = FirebaseFirestore.instance;

  bool _loading = true;
  Map<String, dynamic>? _instruction;
  bool _confirmedToday = false;
  String? _confirmationTime;
  String _confirmProjectID = '';
  String _confirmTxnType = 'Хоолны мөнгө';
  bool _confirming = false;
  String _confirmError = '';

  List<Map<String, dynamic>> _activeProjects = [];

  final today = DateFormat('yyyy-MM-dd').format(DateTime.now());

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    final appState = context.read<AppState>();
    final empId = appState.employeeId;

    try {
      final results = await Future.wait([
        ApiService.manageHseInstruction({'action': 'getActive'}),
        empId != null
            ? ApiService.manageHseInstruction({
                'action': 'getTodayStatus',
                'employeeId': '$empId',
                'date': today,
              })
            : Future.value(<String, dynamic>{'confirmed': false, 'data': null}),
        _db
            .collection(kProjectCollection)
            .where('Status', isEqualTo: 'Ажиллаж байгаа')
            .get(),
      ]);

      final activeRes = results[0] as Map<String, dynamic>;
      final statusRes = results[1] as Map<String, dynamic>;
      final projSnap = results[2] as QuerySnapshot;

      final projects = projSnap.docs
          .map((d) => {'id': d.id, ...d.data() as Map<String, dynamic>})
          .toList()
        ..sort((a, b) {
          final ai = int.tryParse('${a['id'] ?? 0}') ?? 0;
          final bi = int.tryParse('${b['id'] ?? 0}') ?? 0;
          return ai.compareTo(bi);
        });

      setState(() {
        _instruction = activeRes['instruction'] as Map<String, dynamic>?;
        _confirmedToday = statusRes['confirmed'] as bool? ?? false;
        _confirmationTime = (statusRes['data'] as Map<String, dynamic>?)?['confirmedAt'] as String?;
        _confirmProjectID =
            ((statusRes['data'] as Map<String, dynamic>?)?['selectedProjectID'] ?? '') as String;
        _confirmTxnType =
            ((statusRes['data'] as Map<String, dynamic>?)?['transactionType'] ?? 'Хоолны мөнгө') as String;
        _activeProjects = projects;
      });
    } catch (e) {
      debugPrint('HSE load error: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _confirm() async {
    if (_instruction == null) return;
    final appState = context.read<AppState>();
    final empId = '${appState.employeeId ?? ''}';
    final empFirst = appState.userData?['firstName'] ?? '';
    final empLast = appState.userData?['lastName'] ?? '';
    final empName = '$empLast $empFirst'.trim();

    // Find project location
    String projLocation = '';
    if (_confirmProjectID.isNotEmpty) {
      final proj = _activeProjects.firstWhere(
        (p) => '${p['id']}' == _confirmProjectID,
        orElse: () => {},
      );
      projLocation = proj['siteLocation'] ?? proj['projectLocation'] ?? '';
    }

    setState(() {
      _confirming = true;
      _confirmError = '';
    });

    try {
      await ApiService.manageHseInstruction({
        'action': 'confirm',
        'employeeId': empId,
        'employeeName': empName,
        'instructionId': _instruction!['id'],
        'date': today,
        'selectedProjectID': _confirmProjectID,
        'selectedProjectLocation': projLocation,
        'transactionType': _confirmTxnType,
      });
      setState(() {
        _confirmedToday = true;
        _confirmationTime = DateTime.now().toIso8601String();
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✅ Зааварчилгаа баталгаажлаа')),
        );
      }
    } catch (e) {
      setState(() => _confirmError = 'Алдаа гарлаа: $e');
    } finally {
      setState(() => _confirming = false);
    }
  }

  String _fmtTime(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    try {
      final dt = DateTime.parse(iso).toLocal();
      return DateFormat('yyyy-MM-dd HH:mm').format(dt);
    } catch (_) {
      return iso.substring(0, 16);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FB),
      appBar: AppBar(title: const Text('🦺 HSE Зааварчилгаа')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: _buildBody(),
            ),
    );
  }

  Widget _buildBody() {
    if (_instruction == null) {
      return ListView(
        children: [
          Padding(
            padding: const EdgeInsets.all(40),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: const [
                Text('🦺', style: TextStyle(fontSize: 48)),
                SizedBox(height: 16),
                Text(
                  'Одоогоор идэвхтэй зааварчилгаа байхгүй байна.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 16),
                ),
                SizedBox(height: 8),
                Text(
                  'Удирдагч шинэ зааварчилгаа нэmmэгц энд харагдана.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey),
                ),
              ],
            ),
          ),
        ],
      );
    }

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        // Already confirmed banner
        if (_confirmedToday) ...[
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFDCFCE7),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF86EFAC)),
            ),
            child: Row(
              children: [
                const Text('✅', style: TextStyle(fontSize: 28)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Өнөөдрийн зааварчилгааг баталгаажууллаа',
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF166534)),
                      ),
                      if (_confirmationTime != null)
                        Text(
                          _fmtTime(_confirmationTime),
                          style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF166534)),
                        ),
                      if (_confirmProjectID.isNotEmpty)
                        Text(
                          '📍 $_confirmProjectID  ·  $_confirmTxnType',
                          style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF166534)),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],

        // Instruction card
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _instruction!['scope'] == 'global'
                          ? const Color(0xFFDEF7EC)
                          : const Color(0xFFE0E7FF),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      _instruction!['scope'] == 'global'
                          ? '🌍 Нийтлэг'
                          : '📁 Төсөл',
                      style: TextStyle(
                          fontSize: 11,
                          color: _instruction!['scope'] == 'global'
                              ? const Color(0xFF065F46)
                              : const Color(0xFF3730A3)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFDCFCE7),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text('✓ Идэвхтэй',
                        style: TextStyle(
                            fontSize: 11,
                            color: Color(0xFF16A34A),
                            fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                _instruction!['title'] ?? '—',
                style: const TextStyle(
                    fontWeight: FontWeight.bold, fontSize: 16),
              ),
              if ((_instruction!['scope'] == 'project') &&
                  (_instruction!['projectId'] != null))
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    'Төсөл: ${_instruction!['projectId']}',
                    style: const TextStyle(
                        fontSize: 12, color: Colors.grey),
                  ),
                ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _instruction!['content'] ?? '',
                  style: const TextStyle(
                      fontSize: 14, height: 1.5),
                ),
              ),
              if (_instruction!['updatedAt'] != null) ...[
                const SizedBox(height: 8),
                Text(
                  'Шинэчилсэн: ${_fmtTime(_instruction!['updatedAt'] as String?)}',
                  style: const TextStyle(
                      fontSize: 11, color: Colors.grey),
                ),
              ],
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Confirm section (only if not confirmed yet)
        if (!_confirmedToday) ...[
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Баталгаажуулалт',
                  style: TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 14),
                ),
                const SizedBox(height: 12),

                // Project selector
                DropdownButtonFormField<String>(
                  value: _confirmProjectID.isEmpty
                      ? null
                      : _confirmProjectID,
                  decoration: InputDecoration(
                    labelText: 'Ажлын байр (заавал биш)',
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                  ),
                  isExpanded: true,
                  items: [
                    const DropdownMenuItem(
                        value: null, child: Text('— Байхгүй —')),
                    ..._activeProjects.map((p) => DropdownMenuItem(
                          value: '${p['id']}',
                          child: Text(
                            '#${p['id']} ${p['siteLocation'] ?? ''}',
                            overflow: TextOverflow.ellipsis,
                          ),
                        )),
                  ],
                  onChanged: (v) =>
                      setState(() => _confirmProjectID = v ?? ''),
                ),
                const SizedBox(height: 10),

                // Transaction type
                DropdownButtonFormField<String>(
                  value: _confirmTxnType,
                  decoration: InputDecoration(
                    labelText: 'Гүйлгээний төрөл',
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                  ),
                  items: const [
                    DropdownMenuItem(
                        value: 'Хоолны мөнгө',
                        child: Text('🍽️ Хоолны мөнгө')),
                    DropdownMenuItem(
                        value: 'Томилолт',
                        child: Text('🚗 Томилолт')),
                  ],
                  onChanged: (v) =>
                      setState(() => _confirmTxnType = v ?? 'Хоолны мөнгө'),
                ),

                if (_confirmError.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(_confirmError,
                      style: const TextStyle(color: Colors.red)),
                ],

                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _confirming ? null : _confirm,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF16A34A),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: _confirming
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(
                                color: Colors.white, strokeWidth: 2))
                        : const Text(
                            '✅ Зааварчилгааг уншаад баталгаажуулах',
                            textAlign: TextAlign.center,
                          ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
