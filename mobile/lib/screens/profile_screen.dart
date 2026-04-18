import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../providers/app_state.dart';
import 'package:go_router/go_router.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  // Employee document from Firestore
  Map<String, dynamic>? _empData;
  String? _empDocId;
  bool _empLoading = false;

  // Clothes size edit state
  bool _editingClothes = false;
  bool _clothesSaving = false;
  String _clothesSaved = '';
  final _upperCtrl = TextEditingController();
  final _lowerCtrl = TextEditingController();
  final _shoeCtrl = TextEditingController();

  // Bank edit state
  bool _editingBank = false;
  bool _bankSaving = false;
  String _bankSaved = '';
  final _bankNameCtrl = TextEditingController();
  final _bankAccountCtrl = TextEditingController();

  static const _mongolianBanks = [
    'Хаан банк', 'Голомт банк', 'Худалдаа хөгжлийн банк (ТДБ)',
    'Хас банк (XacBank)', 'Улаанбаатар хот банк', 'Капитал банк',
    'Богд банк', 'Нийслэл банк', 'Транс банк', 'Чингис хаан банк',
    'М банк', 'Ариг банк', 'Кредит банк', 'Төрийн банк', 'Зоос банк',
  ];
  String _selectedBank = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadEmployeeDoc());
  }

  @override
  void dispose() {
    _upperCtrl.dispose();
    _lowerCtrl.dispose();
    _shoeCtrl.dispose();
    _bankNameCtrl.dispose();
    _bankAccountCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadEmployeeDoc() async {
    final appState = context.read<AppState>();
    final empIdRaw = appState.employeeId;
    if (empIdRaw.isEmpty) return;
    setState(() => _empLoading = true);
    try {
      final intId = int.tryParse(empIdRaw);
      QuerySnapshot snap;
      if (intId != null) {
        snap = await _db.collection('employees').where('Id', isEqualTo: intId).limit(1).get();
        if (snap.docs.isEmpty) {
          snap = await _db.collection('employees').where('Id', isEqualTo: empIdRaw).limit(1).get();
        }
      } else {
        snap = await _db.collection('employees').where('NumID', isEqualTo: empIdRaw).limit(1).get();
      }
      if (snap.docs.isNotEmpty) {
        final d = snap.docs.first;
        setState(() {
          _empData = d.data() as Map<String, dynamic>;
          _empDocId = d.id;
        });
      }
    } catch (_) {}
    setState(() => _empLoading = false);
  }

  void _startEditClothes() {
    _upperCtrl.text = _empData?['ClothesUpperSize'] ?? '';
    _lowerCtrl.text = _empData?['ClothesLowerSize'] ?? '';
    _shoeCtrl.text = _empData?['ClothesShoesSize'] ?? '';
    setState(() { _editingClothes = true; _clothesSaved = ''; });
  }

  Future<void> _saveClothes() async {
    if (_empDocId == null) return;
    setState(() { _clothesSaving = true; _clothesSaved = ''; });
    try {
      final patch = {
        'ClothesUpperSize': _upperCtrl.text.trim(),
        'ClothesLowerSize': _lowerCtrl.text.trim(),
        'ClothesShoesSize': _shoeCtrl.text.trim(),
        'updatedAt': DateTime.now().toIso8601String(),
      };
      await _db.collection('employees').doc(_empDocId).update(patch);
      setState(() {
        _empData = {...?_empData, ...patch};
        _editingClothes = false;
        _clothesSaved = '✅ Хадгалагдлаа';
      });
      Future.delayed(const Duration(seconds: 3), () {
        if (mounted) setState(() => _clothesSaved = '');
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Алдаа: ${e.toString()}')),
        );
      }
    }
    setState(() => _clothesSaving = false);
  }

  void _startEditBank() {
    _bankNameCtrl.text = _empData?['BankName'] ?? '';
    _bankAccountCtrl.text = _empData?['BankAccountNumber'] ?? '';
    _selectedBank = _empData?['BankName'] ?? '';
    setState(() { _editingBank = true; _bankSaved = ''; });
  }

  Future<void> _saveBank() async {
    if (_empDocId == null) return;
    setState(() { _bankSaving = true; _bankSaved = ''; });
    try {
      final patch = {
        'BankName': _selectedBank.trim(),
        'BankAccountNumber': _bankAccountCtrl.text.trim(),
        'updatedAt': DateTime.now().toIso8601String(),
      };
      await _db.collection('employees').doc(_empDocId).update(patch);
      setState(() {
        _empData = {...?_empData, ...patch};
        _editingBank = false;
        _bankSaved = '✅ Хадгалагдлаа';
      });
      Future.delayed(const Duration(seconds: 3), () {
        if (mounted) setState(() => _bankSaved = '');
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Алдаа: ${e.toString()}')),
        );
      }
    }
    setState(() => _bankSaving = false);
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final userData = appState.userData;

    if (userData == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('👤 Миний мэдээлэл')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final firstName = userData['firstName'] ?? userData['employeeFirstName'] ?? '';
    final lastName = userData['lastName'] ?? userData['employeeLastName'] ?? '';
    final fullName = '$lastName $firstName'.trim();
    final position = userData['position'] ?? '';
    final department = userData['department'] ?? '';
    final email = userData['email'] ?? '';
    final phone = userData['phone'] ?? '';
    final empId = userData['employeeId'] ?? appState.employeeId ?? '';
    final isSupervisor = appState.isSupervisor;

    // Prefer employee doc data (Firestore employees collection)
    final bankName = _empData?['BankName'] ?? '';
    final bankAccount = _empData?['BankAccountNumber'] ?? '';
    final clothesUpper = _empData?['ClothesUpperSize'] ?? '';
    final clothesLower = _empData?['ClothesLowerSize'] ?? '';
    final clothesShoes = _empData?['ClothesShoesSize'] ?? '';

    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FB),
      appBar: AppBar(
        title: const Text('👤 Миний мэдээлэл'),
        actions: [
          TextButton(
            onPressed: () => _confirmSignOut(context),
            child: const Text('Гарах',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Avatar and name card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF1E3A5F),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: Colors.white.withOpacity(0.2),
                  child: Text(
                    firstName.isNotEmpty
                        ? firstName[0].toUpperCase()
                        : '?',
                    style: const TextStyle(
                        fontSize: 28,
                        color: Colors.white,
                        fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  fullName,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
                if (position.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    position,
                    style: TextStyle(
                        color: Colors.white.withOpacity(0.8),
                        fontSize: 13),
                  ),
                ],
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: isSupervisor
                        ? const Color(0xFFDC2626)
                        : Colors.white.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    isSupervisor ? '🔑 Удирдлага' : '👷 Ажилтан',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Info card
          _InfoCard(
            title: '📋 Ерөнхий мэдээлэл',
            rows: [
              _InfoRow(label: 'Ажилтны дугаар', value: '$empId'),
              if (department.isNotEmpty)
                _InfoRow(label: 'Хэлтэс', value: department),
              if (position.isNotEmpty)
                _InfoRow(label: 'Албан тушаал', value: position),
            ],
          ),
          const SizedBox(height: 12),

          // Contact card
          _InfoCard(
            title: '📞 Холбоо барих',
            rows: [
              if (email.isNotEmpty) _InfoRow(label: 'Имэйл', value: email),
              if (phone.isNotEmpty) _InfoRow(label: 'Утас', value: phone),
            ],
          ),
          const SizedBox(height: 12),

          if (_empLoading)
            const Center(child: CircularProgressIndicator(strokeWidth: 2))
          else ...[
            // Bank card
            _EditableCard(
              title: '🏦 Банкны мэдээлэл',
              editing: _editingBank,
              savedMsg: _bankSaved,
              onEdit: _empDocId != null ? _startEditBank : null,
              onSave: _saveBank,
              onCancel: () => setState(() => _editingBank = false),
              saving: _bankSaving,
              viewContent: Column(
                children: [
                  _InfoRow(label: 'Банк', value: bankName.isNotEmpty ? bankName : '—'),
                  _InfoRow(label: 'Данс №', value: bankAccount.isNotEmpty ? bankAccount : '—'),
                ],
              ),
              editContent: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Банк', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  const SizedBox(height: 4),
                  DropdownButtonFormField<String>(
                    value: _mongolianBanks.contains(_selectedBank) ? _selectedBank : null,
                    hint: const Text('— Банк сонгоно уу —'),
                    isExpanded: true,
                    items: _mongolianBanks.map((b) => DropdownMenuItem(value: b, child: Text(b, style: const TextStyle(fontSize: 13)))).toList(),
                    onChanged: (v) => setState(() => _selectedBank = v ?? ''),
                    decoration: const InputDecoration(
                      contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text('IBAN Дансны дугаар', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: _bankAccountCtrl,
                    decoration: const InputDecoration(
                      hintText: 'IBAN Дансны дугаар',
                      contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Clothes sizes card
            _EditableCard(
              title: '👔 Хувцасны хэмжээ',
              editing: _editingClothes,
              savedMsg: _clothesSaved,
              onEdit: _empDocId != null ? _startEditClothes : null,
              onSave: _saveClothes,
              onCancel: () => setState(() => _editingClothes = false),
              saving: _clothesSaving,
              viewContent: Column(
                children: [
                  _InfoRow(label: '👔 Дээд хувцас', value: clothesUpper.isNotEmpty ? clothesUpper : '—'),
                  _InfoRow(label: '👖 Доод хувцас', value: clothesLower.isNotEmpty ? clothesLower : '—'),
                  _InfoRow(label: '👟 Гутлын хэмжээ', value: clothesShoes.isNotEmpty ? clothesShoes : '—'),
                ],
              ),
              editContent: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('👔 Дээд хувцасны хэмжээ', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: _upperCtrl,
                    decoration: const InputDecoration(
                      hintText: 'S / M / L / XL / XXL',
                      contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text('👖 Доод хувцасны хэмжээ', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: _lowerCtrl,
                    decoration: const InputDecoration(
                      hintText: 'S / M / L / XL / XXL',
                      contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text('👟 Гутлын хэмжээ', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: _shoeCtrl,
                    decoration: const InputDecoration(
                      hintText: '38 / 40 / 42 / 44',
                      contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 24),

          // Sign-out button
          OutlinedButton.icon(
            onPressed: () => _confirmSignOut(context),
            icon: const Icon(Icons.logout, color: Colors.red),
            label: const Text(
              'Системээс гарах',
              style: TextStyle(color: Colors.red),
            ),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Colors.red),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),

          const SizedBox(height: 8),

          // App version
          const Center(
            child: Text(
              'Мөнх-Зайсан v1.0.0',
              style: TextStyle(color: Colors.grey, fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmSignOut(BuildContext context) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Гарах уу?'),
        content: const Text('Та системээс гарахдаа итгэлтэй байна уу?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Болих')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Гарах',
                  style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm == true && context.mounted) {
      await context.read<AppState>().signOut();
      if (context.mounted) context.go('/login');
    }
  }
}

// ── Editable card (view + edit inline) ─────────────────────────────────
class _EditableCard extends StatelessWidget {
  final String title;
  final bool editing;
  final bool saving;
  final String savedMsg;
  final VoidCallback? onEdit;
  final Future<void> Function() onSave;
  final VoidCallback onCancel;
  final Widget viewContent;
  final Widget editContent;

  const _EditableCard({
    required this.title,
    required this.editing,
    required this.saving,
    required this.savedMsg,
    required this.onEdit,
    required this.onSave,
    required this.onCancel,
    required this.viewContent,
    required this.editContent,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: Color(0xFF1E3A5F)),
                  ),
                ),
                if (!editing && onEdit != null)
                  TextButton.icon(
                    onPressed: onEdit,
                    icon: const Icon(Icons.edit, size: 14),
                    label: const Text('Засах', style: TextStyle(fontSize: 12)),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ),
              ],
            ),
          ),
          const Divider(height: 1),
          if (!editing) ...[
            viewContent,
            if (savedMsg.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                child: Text(savedMsg, style: const TextStyle(color: Colors.green, fontSize: 12)),
              ),
          ] else ...[
            Padding(
              padding: const EdgeInsets.all(14),
              child: editContent,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Row(
                children: [
                  ElevatedButton(
                    onPressed: saving ? null : onSave,
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1E3A5F)),
                    child: saving
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('💾 Хадгалах', style: TextStyle(color: Colors.white)),
                  ),
                  const SizedBox(width: 8),
                  TextButton(
                    onPressed: onCancel,
                    child: const Text('Болих'),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final String title;
  final List<Widget> rows;
  const _InfoCard({required this.title, required this.rows});

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const SizedBox();
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
            child: Text(
              title,
              style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: Color(0xFF1E3A5F)),
            ),
          ),
          const Divider(height: 1),
          ...rows,
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(color: Colors.grey, fontSize: 13),
            ),
          ),
          Expanded(
            child: Text(
              value.isNotEmpty ? value : '—',
              style: const TextStyle(
                  fontWeight: FontWeight.w500, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}
