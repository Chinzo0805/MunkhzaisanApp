import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';
import '../config/constants.dart';

class WarehouseRequestScreen extends StatefulWidget {
  const WarehouseRequestScreen({super.key});

  @override
  State<WarehouseRequestScreen> createState() =>
      _WarehouseRequestScreenState();
}

class _WarehouseRequestScreenState extends State<WarehouseRequestScreen> {
  final _db = FirebaseFirestore.instance;

  List<Map<String, dynamic>> _warehouseItems = [];
  List<Map<String, dynamic>> _myRequests = [];
  List<Map<String, dynamic>> _activeProjects = [];
  bool _loading = true;
  bool _showForm = false;

  // Form
  final _formKey = GlobalKey<FormState>();
  String _warehouseId = '';
  String _warehouseName = '';
  double _quantity = 0;
  String _projectId = '';
  String _projectName = '';
  String _purpose = '';
  bool _submitting = false;

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
        _db.collection('warehouse').get(),
        empId != null
            ? _db
                .collection('warehouseRequests')
                .where('requestedEmpID', isEqualTo: empId)
                .get()
            : Future.value(null as QuerySnapshot?),
        _db
            .collection(kProjectCollection)
            .where('Status', isEqualTo: 'Ажиллаж байгаа')
            .get(),
      ]);

      final warehouseSnap = results[0] as QuerySnapshot;
      final requestSnap = results[1] as QuerySnapshot?;
      final projSnap = results[2] as QuerySnapshot;

      final items = warehouseSnap.docs
          .map((d) => {'docId': d.id, ...d.data() as Map<String, dynamic>})
          .where((i) => (i['quantity'] as num? ?? 0) > 0)
          .toList()
        ..sort((a, b) =>
            '${a['Name']}'.compareTo('${b['Name']}'));

      final requests = requestSnap?.docs
              .map((d) =>
                  {'docId': d.id, ...d.data() as Map<String, dynamic>})
              .toList()
          ?? [];
      requests.sort((a, b) {
        final at = a['createdAt'];
        final bt = b['createdAt'];
        if (at == null && bt == null) return 0;
        if (at == null) return 1;
        if (bt == null) return -1;
        if (at is Timestamp && bt is Timestamp) {
          return bt.compareTo(at);
        }
        return 0;
      });

      final projects = projSnap.docs
          .map((d) => {'docId': d.id, ...d.data() as Map<String, dynamic>})
          .toList()
        ..sort((a, b) {
          final ai = int.tryParse('${a['id'] ?? 0}') ?? 0;
          final bi = int.tryParse('${b['id'] ?? 0}') ?? 0;
          return ai.compareTo(bi);
        });

      setState(() {
        _warehouseItems = items;
        _myRequests = requests;
        _activeProjects = projects;
      });
    } catch (e) {
      debugPrint('Warehouse load error: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    _formKey.currentState!.save();

    if (_warehouseId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Материал сонгоно уу')),
      );
      return;
    }

    final appState = context.read<AppState>();
    final empId = appState.employeeId;
    final empFirst = appState.userData?['firstName'] ?? '';
    final empLast = appState.userData?['lastName'] ?? '';
    final empName = '$empFirst $empLast'.trim();

    setState(() => _submitting = true);
    try {
      await ApiService.manageWarehouseRequest({
        'action': 'create',
        'request': {
          'WarehouseID': _warehouseId,
          'WarehouseName': _warehouseName,
          'quantity': _quantity,
          'requestedEmpID': empId,
          'requestedEmpName': empName,
          'projectID': _projectId,
          'ProjectName': _projectName,
          'purpose': _purpose,
        },
      });

      await _loadData();
      setState(() {
        _showForm = false;
        _warehouseId = '';
        _warehouseName = '';
        _quantity = 0;
        _projectId = '';
        _projectName = '';
        _purpose = '';
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✔ Хүсэлт илгээгдлаа')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('❌ Алдаа: $e')),
        );
      }
    } finally {
      setState(() => _submitting = false);
    }
  }

  Future<void> _delete(Map<String, dynamic> req) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Болих уу?'),
        content: Text('${req['WarehouseName']} хүсэлтийг цуцлах уу?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Үгүй')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Тийм',
                  style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      await ApiService.manageWarehouseRequest({
        'action': 'delete',
        'requestId': req['docId'],
      });
      await _loadData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✔ Хүсэлт цуцлагдлаа')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('❌ Алдаа: $e')),
        );
      }
    }
  }

  String _fmtDate(dynamic ts) {
    if (ts == null) return '';
    if (ts is Timestamp) {
      return DateFormat('yyyy-MM-dd HH:mm').format(ts.toDate().toLocal());
    }
    return '$ts';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FB),
      appBar: AppBar(
        title: const Text('📦 Агуулах хүсэлт'),
        actions: [
          TextButton.icon(
            onPressed: () => setState(() => _showForm = !_showForm),
            icon: Icon(
              _showForm ? Icons.close : Icons.add,
              color: Colors.white,
            ),
            label: Text(
              _showForm ? 'Болих' : 'Хүсэлт',
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                if (_showForm) _buildForm(),
                if (_myRequests.isEmpty && !_showForm)
                  const Expanded(
                    child: Center(
                      child: Text('Хүсэлт байхгүй байна',
                          style: TextStyle(color: Colors.grey)),
                    ),
                  )
                else
                  Expanded(
                    child: RefreshIndicator(
                      onRefresh: _loadData,
                      child: ListView.separated(
                        padding:
                            const EdgeInsets.fromLTRB(12, 10, 12, 20),
                        itemCount: _myRequests.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: 8),
                        itemBuilder: (_, i) => _RequestCard(
                          req: _myRequests[i],
                          onDelete: _delete,
                          fmtDate: _fmtDate,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
    );
  }

  Widget _buildForm() {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 10, 12, 0),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF1E3A5F).withOpacity(0.3)),
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('📦 Агуулахаас материал хүсэх',
                style: TextStyle(
                    fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 12),

            // Warehouse item selector
            DropdownButtonFormField<String>(
              value: _warehouseId.isEmpty ? null : _warehouseId,
              decoration: InputDecoration(
                labelText: 'Материал *',
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8)),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
              ),
              isExpanded: true,
              items: _warehouseItems
                  .map((item) => DropdownMenuItem<String>(
                        value: '${item['docId']}',
                        child: Text(
                          '${item['Name']} (${item['quantity']} ${item['unit'] ?? ''})',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ))
                  .toList(),
              onChanged: (v) {
                if (v == null) return;
                final item = _warehouseItems
                    .firstWhere((i) => i['docId'] == v);
                setState(() {
                  _warehouseId = v;
                  _warehouseName = '${item['Name']}';
                });
              },
              validator: (v) => v == null || v.isEmpty
                  ? 'Материал сонгоно уу'
                  : null,
            ),
            const SizedBox(height: 10),

            // Quantity
            TextFormField(
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(
                labelText: 'Тоо хэмжээ *',
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8)),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
              ),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Тоо оруулна уу';
                final n = double.tryParse(v);
                if (n == null || n <= 0) return 'Зөв тоо оруулна уу';
                return null;
              },
              onSaved: (v) => _quantity = double.tryParse(v ?? '0') ?? 0,
            ),
            const SizedBox(height: 10),

            // Project (optional)
            DropdownButtonFormField<String>(
              value: _projectId.isEmpty ? null : _projectId,
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
                ..._activeProjects.map((p) => DropdownMenuItem<String>(
                      value: '${p['id']}',
                      child: Text(
                        '#${p['id']} ${p['siteLocation'] ?? ''}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    )),
              ],
              onChanged: (v) {
                if (v == null) {
                  setState(() {
                    _projectId = '';
                    _projectName = '';
                  });
                  return;
                }
                final p = _activeProjects
                    .firstWhere((pr) => '${pr['id']}' == v);
                setState(() {
                  _projectId = v;
                  _projectName =
                      '${p['siteLocation'] ?? p['ProjectName'] ?? ''}';
                });
              },
            ),
            const SizedBox(height: 10),

            // Purpose
            TextFormField(
              maxLines: 2,
              onSaved: (v) => _purpose = v ?? '',
              decoration: InputDecoration(
                labelText: 'Зориулалт / Тайлбар',
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8)),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
              ),
            ),
            const SizedBox(height: 14),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1E3A5F),
                  foregroundColor: Colors.white,
                ),
                child: _submitting
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2))
                    : const Text('✔ Хүсэлт илгээх'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RequestCard extends StatelessWidget {
  final Map<String, dynamic> req;
  final Future<void> Function(Map<String, dynamic>) onDelete;
  final String Function(dynamic) fmtDate;

  const _RequestCard({
    required this.req,
    required this.onDelete,
    required this.fmtDate,
  });

  Color _statusColor(String s) {
    switch (s) {
      case 'approved': return const Color(0xFF16A34A);
      case 'rejected': return const Color(0xFFDC2626);
      default: return const Color(0xFFF59E0B);
    }
  }

  String _statusLabel(String s) {
    switch (s) {
      case 'approved': return '✅ Зөвшөөрсөн';
      case 'rejected': return '❌ Татгалзсан';
      default: return '⏳ Хүлээгдэж байна';
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = req['status'] as String? ?? 'pending';
    final canDelete = status == 'pending';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${req['WarehouseName'] ?? '—'}',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: _statusColor(status).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  _statusLabel(status),
                  style: TextStyle(
                      fontSize: 11, color: _statusColor(status)),
                ),
              ),
              if (canDelete) ...[
                const SizedBox(width: 6),
                GestureDetector(
                  onTap: () => onDelete(req),
                  child: const Icon(Icons.cancel_outlined,
                      size: 18, color: Colors.red),
                ),
              ],
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Text(
                'Тоо: ${req['quantity']}',
                style: const TextStyle(
                    fontWeight: FontWeight.w500, fontSize: 13),
              ),
              if ((req['projectID'] ?? '').isNotEmpty) ...[
                const Text('  ·  ', style: TextStyle(color: Colors.grey)),
                Expanded(
                  child: Text(
                    '🔧 ${req['ProjectName'] ?? req['projectID']}',
                    style: const TextStyle(
                        fontSize: 12, color: Colors.grey),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ],
          ),
          if ((req['purpose'] ?? '').isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              '${req['purpose']}',
              style: const TextStyle(
                  fontSize: 12,
                  color: Colors.grey,
                  fontStyle: FontStyle.italic),
            ),
          ],
          if (status == 'rejected' &&
              (req['rejectionReason'] ?? '').isNotEmpty) ...[
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                '❌ ${req['rejectionReason']}',
                style: const TextStyle(
                    fontSize: 11, color: Color(0xFFDC2626)),
              ),
            ),
          ],
          const SizedBox(height: 4),
          Text(
            fmtDate(req['createdAt']),
            style: const TextStyle(fontSize: 11, color: Colors.grey),
          ),
        ],
      ),
    );
  }
}
