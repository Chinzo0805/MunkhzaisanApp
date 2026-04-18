import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';
import '../config/constants.dart';

class TimeAttendanceScreen extends StatefulWidget {
  const TimeAttendanceScreen({super.key});

  @override
  State<TimeAttendanceScreen> createState() => _TimeAttendanceScreenState();
}

class _TimeAttendanceScreenState extends State<TimeAttendanceScreen> {
  final _db = FirebaseFirestore.instance;

  List<Map<String, dynamic>> _records = [];
  List<Map<String, dynamic>> _projects = [];
  bool _loading = true;
  bool _showForm = false;

  // Form state
  final _formKey = GlobalKey<FormState>();
  String _formDay = DateFormat('yyyy-MM-dd').format(DateTime.now());
  String _formWeekDay = '';
  String _formStatus = 'Ирсэн';
  String _formProjectId = '';
  String _formStartTime = '';
  String _formEndTime = '';
  double _formWorkingHour = 0;
  String _formComment = '';
  bool _submitting = false;
  bool _deleting = false;

  @override
  void initState() {
    super.initState();
    _formWeekDay = _getWeekDay(_formDay);
    _loadData();
  }

  String _getWeekDay(String dateStr) {
    try {
      final d = DateTime.parse(dateStr);
      const days = ['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'];
      return days[d.weekday % 7];
    } catch (_) {
      return '';
    }
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    final appState = context.read<AppState>();
    final empId = appState.employeeId;

    try {
      // Load TA records for this employee
      final snap = await _db
          .collection(kTimeAttendanceCollection)
          .where('EmployeeID', isEqualTo: empId)
          .orderBy('Day', descending: true)
          .get();

      // Load overtime projects for dropdown
      final projSnap = await _db
          .collection(kProjectCollection)
          .where('projectType', isEqualTo: 'overtime')
          .where('Status', isEqualTo: 'Ажиллаж байгаа')
          .get();

      setState(() {
        _records = snap.docs.map((d) => {'docId': d.id, ...d.data()}).toList();
        _projects = projSnap.docs
            .map((d) => {'docId': d.id, ...d.data()})
            .toList()
          ..sort((a, b) =>
              (b['id'] as int? ?? 0).compareTo(a['id'] as int? ?? 0));
      });
    } catch (e) {
      debugPrint('TA load error: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  void _calcWorkingHours() {
    try {
      if (_formStartTime.isEmpty || _formEndTime.isEmpty) return;
      final start = TimeOfDay(
        hour: int.parse(_formStartTime.split(':')[0]),
        minute: int.parse(_formStartTime.split(':')[1]),
      );
      final end = TimeOfDay(
        hour: int.parse(_formEndTime.split(':')[0]),
        minute: int.parse(_formEndTime.split(':')[1]),
      );
      double hours =
          end.hour + end.minute / 60 - start.hour - start.minute / 60;
      if (hours < 0) hours += 24;
      // Subtract 1 hour break if > 6 hours
      if (hours > 6) hours -= 1;
      setState(() => _formWorkingHour = double.parse(hours.toStringAsFixed(1)));
    } catch (_) {}
  }

  Future<void> _pickDate() async {
    final initial = DateTime.tryParse(_formDay) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() {
        _formDay = DateFormat('yyyy-MM-dd').format(picked);
        _formWeekDay = _getWeekDay(_formDay);
      });
    }
  }

  Future<void> _pickTime({required bool isStart}) async {
    final current = isStart ? _formStartTime : _formEndTime;
    TimeOfDay initial = TimeOfDay.now();
    if (current.isNotEmpty) {
      try {
        initial = TimeOfDay(
          hour: int.parse(current.split(':')[0]),
          minute: int.parse(current.split(':')[1]),
        );
      } catch (_) {}
    }
    final picked = await showTimePicker(context: context, initialTime: initial);
    if (picked != null) {
      final s = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
      setState(() {
        if (isStart) {
          _formStartTime = s;
        } else {
          _formEndTime = s;
        }
      });
      _calcWorkingHours();
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    _formKey.currentState!.save();

    final appState = context.read<AppState>();
    setState(() => _submitting = true);

    try {
      final empId = appState.employeeId ?? 0;
      final userData = appState.userData!;

      int? projId;
      String projName = '';
      if (_formProjectId.isNotEmpty) {
        projId = int.tryParse(_formProjectId);
        final proj = _projects.firstWhere(
            (p) => '${p['id']}' == _formProjectId,
            orElse: () => {});
        projName = proj['siteLocation'] ?? proj['ProjectName'] ?? '';
      }

      final payload = {
        'EmployeeID': empId,
        'EmployeeFirstName': userData['firstName'] ?? '',
        'EmployeePosition': userData['position'] ?? '',
        'Day': _formDay,
        'WeekDay': _formWeekDay,
        'Status': _formStatus,
        if (projId != null) 'ProjectID': projId,
        if (projName.isNotEmpty) 'ProjectName': projName,
        'startTime': _formStartTime,
        'endTime': _formEndTime,
        'WorkingHour': _formWorkingHour,
        'overtimeHour': 0,
        'comment': _formComment,
        'requestStatus': 'Хүлээгдэж байна',
      };

      await ApiService.manageTimeAttendanceRequest('add', payload);
      await _loadData();
      setState(() => _showForm = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✔ Бүртгэл илгээгдлаа')),
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

  Future<void> _delete(Map<String, dynamic> rec) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Устгах уу?'),
        content: Text('${rec['Day']} ${rec['Status']} бүртгэлийг устгах уу?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Болих')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Устгах',
                  style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm != true) return;
    setState(() => _deleting = true);
    try {
      await ApiService.manageTimeAttendanceRequest('delete', {},
          requestId: rec['docId'] as String);
      setState(() => _records.removeWhere((r) => r['docId'] == rec['docId']));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✔ Устгагдлаа')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('❌ Алдаа: $e')),
        );
      }
    } finally {
      setState(() => _deleting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FB),
      appBar: AppBar(
        title: const Text('🕐 Ирц бүртгэл'),
        actions: [
          TextButton.icon(
            onPressed: () => setState(() => _showForm = !_showForm),
            icon: Icon(
              _showForm ? Icons.close : Icons.add,
              color: Colors.white,
            ),
            label: Text(
              _showForm ? 'Болих' : 'Нэмэх',
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          if (_showForm) _buildForm(),
          if (_loading)
            const Expanded(child: Center(child: CircularProgressIndicator()))
          else if (_records.isEmpty)
            const Expanded(
              child: Center(
                child: Text('Бүртгэл алга',
                    style: TextStyle(color: Colors.grey)),
              ),
            )
          else
            Expanded(
              child: RefreshIndicator(
                onRefresh: _loadData,
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 20),
                  itemCount: _records.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => _TACard(
                    rec: _records[i],
                    onDelete: _delete,
                    deleting: _deleting,
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
            const Text('Ирц бүртгэл нэмэх',
                style:
                    TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 12),

            // Date
            GestureDetector(
              onTap: _pickDate,
              child: InputDecorator(
                decoration: InputDecoration(
                  labelText: 'Огноо',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8)),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                  suffixIcon: const Icon(Icons.calendar_today, size: 18),
                ),
                child: Text('$_formDay ($_formWeekDay)'),
              ),
            ),
            const SizedBox(height: 10),

            // Status dropdown
            DropdownButtonFormField<String>(
              value: _formStatus,
              decoration: InputDecoration(
                labelText: 'Статус',
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8)),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
              ),
              items: kTAStatuses
                  .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                  .toList(),
              onChanged: (v) => setState(() => _formStatus = v ?? 'Ирсэн'),
            ),
            const SizedBox(height: 10),

            // Project dropdown (optional)
            DropdownButtonFormField<String>(
              value: _formProjectId.isEmpty ? null : _formProjectId,
              decoration: InputDecoration(
                labelText: 'Ажлын байр (илүү цаг)',
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8)),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
              ),
              isExpanded: true,
              items: [
                const DropdownMenuItem(value: null, child: Text('— Байхгүй —')),
                ..._projects.map((p) => DropdownMenuItem(
                      value: '${p['id']}',
                      child: Text(
                        '#${p['id']} ${p['siteLocation'] ?? ''}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    )),
              ],
              onChanged: (v) =>
                  setState(() => _formProjectId = v ?? ''),
            ),
            const SizedBox(height: 10),

            // Start / End time
            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => _pickTime(isStart: true),
                    child: InputDecorator(
                      decoration: InputDecoration(
                        labelText: 'Эхлэх цаг',
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8)),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        suffixIcon: const Icon(Icons.access_time, size: 18),
                      ),
                      child: Text(_formStartTime.isEmpty
                          ? '— сонгох —'
                          : _formStartTime),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: GestureDetector(
                    onTap: () => _pickTime(isStart: false),
                    child: InputDecorator(
                      decoration: InputDecoration(
                        labelText: 'Дуусах цаг',
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8)),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        suffixIcon: const Icon(Icons.access_time, size: 18),
                      ),
                      child: Text(_formEndTime.isEmpty
                          ? '— сонгох —'
                          : _formEndTime),
                    ),
                  ),
                ),
              ],
            ),

            if (_formWorkingHour > 0) ...[
              const SizedBox(height: 6),
              Text(
                'Ажилласан цаг: ${_formWorkingHour}ц',
                style: const TextStyle(
                    color: Color(0xFF1E3A5F),
                    fontWeight: FontWeight.bold),
              ),
            ],
            const SizedBox(height: 10),

            // Comment
            TextFormField(
              maxLines: 2,
              onSaved: (v) => _formComment = v ?? '',
              decoration: InputDecoration(
                labelText: 'Тайлбар',
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8)),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
              ),
            ),
            const SizedBox(height: 12),

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
                    : const Text('✔ Илгээх'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TACard extends StatelessWidget {
  final Map<String, dynamic> rec;
  final Future<void> Function(Map<String, dynamic>) onDelete;
  final bool deleting;

  const _TACard(
      {required this.rec, required this.onDelete, required this.deleting});

  Color _statusColor(String s) {
    switch (s) {
      case 'Ирсэн': return const Color(0xFF16A34A);
      case 'Томилолт': return const Color(0xFF7C3AED);
      case 'Чөлөөтэй/Амралт': return const Color(0xFF2563EB);
      case 'тасалсан': return const Color(0xFFDC2626);
      default: return Colors.grey;
    }
  }

  Color _reqStatusColor(String s) {
    switch (s) {
      case 'Зөвшөөрсөн': return const Color(0xFF16A34A);
      case 'Татгалзсан': return const Color(0xFFDC2626);
      default: return const Color(0xFFF59E0B);
    }
  }

  @override
  Widget build(BuildContext context) {
    final reqStatus = rec['requestStatus'] as String? ?? 'Хүлээгдэж байна';
    final canDelete = reqStatus == 'Хүлээгдэж байна';

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
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: _statusColor(rec['Status'] ?? '').withOpacity(0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  rec['Status'] ?? '—',
                  style: TextStyle(
                      color: _statusColor(rec['Status'] ?? ''),
                      fontWeight: FontWeight.bold,
                      fontSize: 12),
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: _reqStatusColor(reqStatus).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  reqStatus,
                  style: TextStyle(
                      color: _reqStatusColor(reqStatus),
                      fontSize: 11),
                ),
              ),
              if (canDelete) ...[
                const SizedBox(width: 6),
                GestureDetector(
                  onTap: deleting ? null : () => onDelete(rec),
                  child: const Icon(Icons.delete_outline,
                      size: 18, color: Colors.red),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Text(
                '${rec['Day'] ?? '—'}',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(width: 8),
              Text(
                '${rec['WeekDay'] ?? ''}',
                style: const TextStyle(color: Colors.grey, fontSize: 12),
              ),
            ],
          ),
          if ((rec['ProjectName'] ?? '').isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              '🔧 ${rec['ProjectName']}',
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
          if ((rec['startTime'] ?? '').isNotEmpty) ...[
            const SizedBox(height: 4),
            Row(
              children: [
                Text(
                  '${rec['startTime']} – ${rec['endTime']}',
                  style: const TextStyle(fontSize: 13),
                ),
                const SizedBox(width: 12),
                Text(
                  '${rec['WorkingHour'] ?? 0}ц',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E3A5F)),
                ),
              ],
            ),
          ],
          if ((rec['comment'] ?? '').isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              '${rec['comment']}',
              style: const TextStyle(
                  fontSize: 11,
                  color: Colors.grey,
                  fontStyle: FontStyle.italic),
            ),
          ],
        ],
      ),
    );
  }
}
