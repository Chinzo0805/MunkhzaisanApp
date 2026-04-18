import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';

class SalaryScreen extends StatefulWidget {
  const SalaryScreen({super.key});

  @override
  State<SalaryScreen> createState() => _SalaryScreenState();
}

class _SalaryScreenState extends State<SalaryScreen>
    with SingleTickerProviderStateMixin {
  final _db = FirebaseFirestore.instance;

  // Date picker
  late String _selectedMonth;
  String _bountyDay = '10'; // 10 or 25

  // Salary data
  bool _salaryLoading = false;
  Map<String, dynamic>? _salaryRow;
  Map<String, dynamic>? _salaryConfirmed;
  Map<String, dynamic>? _advanceRow;
  Map<String, dynamic>? _advanceConfirmed;
  List<Map<String, dynamic>> _salaryAdj = [];

  // Bounty data
  bool _bountyLoading = false;
  List<Map<String, dynamic>> _bountyProjects = [];
  Map<String, dynamic>? _bountyConfirmed;
  bool _bountyCalculated = false;

  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _selectedMonth =
        '${now.year}-${now.month.toString().padLeft(2, '0')}';
    _tabController = TabController(length: 2, vsync: this);
    // Default to full tab for 10th, advance for 25th
    _tabController.index = 0;
    _loadAll();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  String _salaryMonth() {
    if (_bountyDay == '10') {
      final parts = _selectedMonth.split('-');
      final y = int.parse(parts[0]);
      final m = int.parse(parts[1]);
      final prev = DateTime(y, m - 1, 1);
      return '${prev.year}-${prev.month.toString().padLeft(2, '0')}';
    }
    return _selectedMonth;
  }

  Future<void> _loadSalary() async {
    final empId = context.read<AppState>().employeeId;
    if (empId == null) return;
    setState(() {
      _salaryLoading = true;
      _salaryRow = null;
      _salaryConfirmed = null;
      _advanceRow = null;
      _advanceConfirmed = null;
      _salaryAdj = [];
    });

    final sm = _salaryMonth();
    final empIdStr = '$empId'.trim();

    try {
      final results = await Future.wait([
        _db.collection('salaries').doc('${sm}_full').get(),
        _db.collection('salaries').doc('${sm}_advance').get(),
        _db.collection('confirmedSalaries').doc('${sm}_full').get(),
        _db.collection('confirmedSalaries').doc('${sm}_advance').get(),
        _db.collection('salaryAdjustments').doc('${sm}_$empIdStr').get(),
      ]);

      final fullDoc = results[0];
      final advDoc = results[1];
      final fullConf = results[2];
      final advConf = results[3];
      final adjDoc = results[4];

      Map<String, dynamic>? salRow;
      if (fullDoc.exists) {
        final emps =
            List<Map<String, dynamic>>.from(fullDoc.data()?['employees'] ?? []);
        salRow = emps.firstWhere(
            (e) => '${e['employeeId']}'.trim() == empIdStr,
            orElse: () => {});
        if (salRow!.isEmpty) salRow = null;
      }

      Map<String, dynamic>? advRow;
      if (advDoc.exists) {
        final emps =
            List<Map<String, dynamic>>.from(advDoc.data()?['employees'] ?? []);
        advRow = emps.firstWhere(
            (e) => '${e['employeeId']}'.trim() == empIdStr,
            orElse: () => {});
        if (advRow!.isEmpty) advRow = null;
      }

      setState(() {
        _salaryRow = salRow;
        _salaryConfirmed = fullConf.exists ? fullConf.data() : null;
        _advanceRow = advRow;
        _advanceConfirmed = advConf.exists ? advConf.data() : null;
        _salaryAdj = adjDoc.exists
            ? List<Map<String, dynamic>>.from(adjDoc.data()?['entries'] ?? [])
            : [];
      });
    } catch (e) {
      debugPrint('Salary load error: $e');
    } finally {
      setState(() => _salaryLoading = false);
    }
  }

  Future<void> _loadBounty() async {
    final empId = context.read<AppState>().employeeId;
    if (empId == null) return;
    setState(() {
      _bountyLoading = true;
      _bountyProjects = [];
      _bountyConfirmed = null;
      _bountyCalculated = false;
    });

    final docId = '${_selectedMonth}_$_bountyDay';
    final myIdStr = '$empId'.trim();

    try {
      final results = await Future.wait([
        _db.collection('bountyCalculations').doc(docId).get(),
        _db.collection('confirmedBounties').doc(docId).get(),
      ]);
      final calcSnap = results[0];
      final confSnap = results[1];

      setState(() {
        _bountyConfirmed = confSnap.exists ? confSnap.data() : null;
        _bountyCalculated = calcSnap.exists;
      });

      if (!calcSnap.exists) return;

      final projects =
          List<Map<String, dynamic>>.from(calcSnap.data()?['projects'] ?? []);
      final myProjects = <Map<String, dynamic>>[];
      for (final proj in projects) {
        if (proj['projectType'] == 'unpaid') continue;
        final employees =
            List<Map<String, dynamic>>.from(proj['_employees'] ?? []);
        final myEmp = employees.firstWhere(
            (e) => '${e['employeeId'] ?? ''}'.trim() == myIdStr,
            orElse: () => {});
        if (myEmp.isEmpty) continue;
        final total = (myEmp['totalBounty'] ?? 0) as num;
        if (total == 0) continue;
        myProjects.add({
          ...proj,
          '_my': {
            'engineerBounty': myEmp['engineerBounty'] ?? 0,
            'nonEngineerBounty': myEmp['nonEngineerBounty'] ?? 0,
            'nonEngineerHours': myEmp['nonEngineerHours'] ?? 0,
            'overtimeBounty': myEmp['overtimeBounty'] ?? 0,
            'overtimeHours': myEmp['overtimeHours'] ?? 0,
            'total': total,
          },
        });
      }
      myProjects.sort((a, b) =>
          '${a['bountyPayDate']}'.compareTo('${b['bountyPayDate']}'));
      setState(() => _bountyProjects = myProjects);
    } catch (e) {
      debugPrint('Bounty load error: $e');
    } finally {
      setState(() => _bountyLoading = false);
    }
  }

  void _loadAll() {
    _tabController.index = _bountyDay == '25' ? 1 : 0;
    _loadSalary();
    _loadBounty();
  }

  Future<void> _pickMonth() async {
    final parts = _selectedMonth.split('-');
    final initial = DateTime(int.parse(parts[0]), int.parse(parts[1]));
    DateTime picked = initial;
    // Month picker
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Сар сонгох'),
        content: _MonthPicker(
          initial: initial,
          onChanged: (d) => picked = d,
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Болих')),
          TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                setState(() {
                  _selectedMonth =
                      '${picked.year}-${picked.month.toString().padLeft(2, '0')}';
                });
                _loadAll();
              },
              child: const Text('OK')),
        ],
      ),
    );
  }

  String _fmt(num? n) {
    if (n == null) return '0';
    return n.toInt().toString().replaceAllMapped(
        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FB),
      appBar: AppBar(
        title: const Text('💵 Цалин & Урамшуулал'),
      ),
      body: Column(
        children: [
          // Picker bar
          Container(
            color: const Color(0xFFF0F4FF),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: _pickMonth,
                    child: Row(
                      children: [
                        const Icon(Icons.calendar_month, size: 18,
                            color: Color(0xFF1E3A5F)),
                        const SizedBox(width: 6),
                        Text(_selectedMonth,
                            style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF1E3A5F))),
                        const Icon(Icons.arrow_drop_down,
                            color: Color(0xFF1E3A5F)),
                      ],
                    ),
                  ),
                ),
                const Text('Өдөр: ',
                    style: TextStyle(fontSize: 12, color: Colors.grey)),
                DropdownButton<String>(
                  value: _bountyDay,
                  underline: const SizedBox(),
                  items: const [
                    DropdownMenuItem(value: '10', child: Text('10-ны')),
                    DropdownMenuItem(value: '25', child: Text('25-ны')),
                  ],
                  onChanged: (v) {
                    setState(() => _bountyDay = v ?? '10');
                    _loadAll();
                  },
                ),
              ],
            ),
          ),

          // Tabs
          TabBar(
            controller: _tabController,
            labelColor: const Color(0xFF1E3A5F),
            unselectedLabelColor: Colors.grey,
            indicatorColor: const Color(0xFF1E3A5F),
            tabs: const [
              Tab(text: '💵 Цалин'),
              Tab(text: '🏆 Урамшуулал'),
            ],
          ),

          // Content
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildSalaryTab(),
                _buildBountyTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSalaryTab() {
    if (_salaryLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          // Sub-tabs: Full / Advance
          Container(
            color: Colors.white,
            child: TabBar(
              labelColor: const Color(0xFF1E3A5F),
              unselectedLabelColor: Colors.grey,
              indicatorColor: const Color(0xFF6366F1),
              tabs: const [
                Tab(text: 'Бүтэн сар'),
                Tab(text: 'Урьдчилгаа'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                _buildFullSalary(),
                _buildAdvanceSalary(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFullSalary() {
    if (_salaryRow == null) {
      return const Center(
          child: Text('Энэ сарын цалингийн тооцоолол байхгүй',
              style: TextStyle(color: Colors.grey)));
    }
    final row = _salaryRow!;
    final additions = _salaryAdj.where((e) => e['type'] == 'addition').toList();
    final deductions = _salaryAdj.where((e) => e['type'] == 'deduction').toList();

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        _ApprovalBanner(
          confirmed: _salaryConfirmed,
          label: 'Цалин',
        ),

        const SizedBox(height: 12),

        // Hours block
        _DetailCard(
          title: '⏱ Цагийн гүйцэтгэл',
          rows: [
            _DRow('Ажиллах хоног', '${row['workingDays'] ?? '—'} өдөр'),
            _DRow('Ажилласан цаг', '${row['normalHours'] ?? 0}ц'),
            _DRow('Тасалсан цаг (×2)',
                '−${row['absentHours'] ?? 0}ц → −${((row['absentHours'] ?? 0) as num) * 2}ц',
                isNeg: (row['absentHours'] ?? 0) > 0),
            _DRow('Тооцоолох цаг', '${row['effectiveHours'] ?? 0}ц',
                bold: true),
          ],
        ),
        const SizedBox(height: 10),

        // Calculation block
        _DetailCard(
          title: '💰 Цалингийн тооцоол',
          rows: [
            _DRow('Үндсэн цалин', '${_fmt(row['baseSalary'])}₮'),
            _DRow('Бодогдсон цалин', '${_fmt(row['calculatedSalary'])}₮'),
            if ((row['recurringAdditions'] ?? 0) > 0)
              _DRow('Тогтмол нэмэгдэл',
                  '+${_fmt(row['recurringAdditions'])}₮',
                  isPos: true),
            for (final e in additions)
              _DRow(e['note'] ?? e['category'] ?? 'Нэмэгдэл',
                  '+${_fmt(e['amount'] as num?)}₮',
                  isPos: true),
            _DRow('Нийт бодогдсон', '${_fmt(row['totalGross'])}₮',
                bold: true, separator: true),
            _DRow('НДШ ажилтан (11.5%)',
                '−${_fmt(row['employeeNDS'])}₮',
                isNeg: true),
            _DRow('ТНО', '${_fmt(row['tno'])}₮'),
            _DRow('ХХОАТ (10%)', '−${_fmt(row['hhoat'])}₮', isNeg: true),
            _DRow('ХХОАТ хөнгөлөлт', '${_fmt(row['discount'])}₮',
                isPos: true),
            _DRow('ХХОАТ төлөх', '−${_fmt(row['hhoatNet'])}₮',
                isNeg: true),
            if ((row['recurringDeductions'] ?? 0) > 0)
              _DRow('Тогтмол суутгал',
                  '−${_fmt(row['recurringDeductions'])}₮',
                  isNeg: true),
            for (final d in deductions)
              _DRow(d['category'] == 'advance'
                      ? 'Урьдчилгаа'
                      : d['note'] ?? 'Суутгал',
                  '−${_fmt(d['amount'] as num?)}₮',
                  isNeg: true),
            _DRow('💵 Гарт олгох', '${_fmt(row['netPay'])}₮',
                bold: true, separator: true, isPos: true),
          ],
        ),
      ],
    );
  }

  Widget _buildAdvanceSalary() {
    if (_advanceRow == null) {
      return const Center(
          child: Text('Урьдчилгааны тооцоолол байхгүй',
              style: TextStyle(color: Colors.grey)));
    }
    final row = _advanceRow!;
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        _ApprovalBanner(confirmed: _advanceConfirmed, label: 'Урьдчилгаа'),
        const SizedBox(height: 12),
        _DetailCard(
          title: '💵 Урьдчилгаа',
          rows: [
            _DRow('Ажилласан цаг (1–15)',
                '${row['effectiveHours'] ?? 0}ц'),
            _DRow('Урьдчилгаа', '${_fmt(row['advancePay'])}₮',
                bold: true, isPos: true),
          ],
        ),
      ],
    );
  }

  Widget _buildBountyTab() {
    if (_bountyLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (!_bountyCalculated) {
      return const Center(
          child: Text(
              'Энэ сарын урамшуулалын тооцоолол байхгүй байна',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey)));
    }

    final total = _bountyProjects.fold<num>(
        0, (s, p) => s + ((p['_my']?['total'] ?? 0) as num));

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        _ApprovalBanner(confirmed: _bountyConfirmed, label: 'Урамшуулал'),
        const SizedBox(height: 12),

        if (_bountyProjects.isEmpty)
          const Center(
              child: Text('Урамшуулалтай төсөл байхгүй',
                  style: TextStyle(color: Colors.grey)))
        else ...[
          for (final proj in _bountyProjects) _BountyProjectCard(proj, _fmt),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFFBBF24)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Нийт урамшуулал',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                Text(
                  '${_fmt(total)}₮',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: Color(0xFFD97706)),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

// ── Sub-widgets ──────────────────────────────────────────────────────────

class _ApprovalBanner extends StatelessWidget {
  final Map<String, dynamic>? confirmed;
  final String label;
  const _ApprovalBanner({required this.confirmed, required this.label});

  @override
  Widget build(BuildContext context) {
    final isConfirmed = confirmed?['fullyConfirmed'] == true;
    final supApproval = confirmed?['supervisorApproval'];
    final accApproval = confirmed?['accountantApproval'];

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isConfirmed
            ? const Color(0xFFDCFCE7)
            : const Color(0xFFFEF3C7),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
            color: isConfirmed
                ? const Color(0xFF16A34A)
                : const Color(0xFFF59E0B)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isConfirmed
                ? '✅ $label бүрэн батлагдсан'
                : '⚠️ Батлагдаагүй — урьдчилсан тооцоолол',
            style: TextStyle(
                fontWeight: FontWeight.bold,
                color: isConfirmed
                    ? const Color(0xFF16A34A)
                    : const Color(0xFFD97706)),
          ),
          const SizedBox(height: 8),
          _StampRow('👤 Менежер', supApproval),
          _StampRow('🧾 Нягтлан', accApproval),
        ],
      ),
    );
  }
}

class _StampRow extends StatelessWidget {
  final String label;
  final dynamic approval;
  const _StampRow(this.label, this.approval);

  @override
  Widget build(BuildContext context) {
    final approved = approval != null;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Text('$label: ', style: const TextStyle(fontSize: 12, color: Colors.grey)),
          Text(
            approved ? '✅ Батлагдсан' : '⏳ Хүлээгдэж байна',
            style: TextStyle(
                fontSize: 12,
                color: approved
                    ? const Color(0xFF16A34A)
                    : const Color(0xFFF59E0B)),
          ),
        ],
      ),
    );
  }
}

class _DetailCard extends StatelessWidget {
  final String title;
  final List<_DRow> rows;
  const _DetailCard({required this.title, required this.rows});

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
            child: Text(title,
                style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                    color: Color(0xFF1E3A5F))),
          ),
          const Divider(height: 1),
          for (final row in rows) row,
        ],
      ),
    );
  }
}

class _DRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;
  final bool separator;
  final bool isPos;
  final bool isNeg;

  const _DRow(
    this.label,
    this.value, {
    this.bold = false,
    this.separator = false,
    this.isPos = false,
    this.isNeg = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = isPos
        ? const Color(0xFF16A34A)
        : isNeg
            ? const Color(0xFFDC2626)
            : const Color(0xFF1E293B);

    return Container(
      decoration: separator
          ? const BoxDecoration(
              border: Border(top: BorderSide(color: Color(0xFFE2E8F0))))
          : null,
      padding: EdgeInsets.symmetric(
          horizontal: 14, vertical: separator ? 10 : 7),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  fontSize: 13,
                  color: bold ? const Color(0xFF1E293B) : Colors.grey[700])),
          Text(
            value,
            style: TextStyle(
                fontSize: 13,
                fontWeight: bold ? FontWeight.bold : FontWeight.normal,
                color: color),
          ),
        ],
      ),
    );
  }
}

class _BountyProjectCard extends StatelessWidget {
  final Map<String, dynamic> proj;
  final String Function(num?) fmt;
  const _BountyProjectCard(this.proj, this.fmt);

  @override
  Widget build(BuildContext context) {
    final my = proj['_my'] as Map<String, dynamic>;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
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
              Text(
                '${proj['referenceIdfromCustomer'] ?? '#${proj['id']}'}',
                style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                    color: Color(0xFF1E3A5F)),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFEDE9FE),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '${proj['projectType'] ?? ''}',
                  style: const TextStyle(
                      fontSize: 11, color: Color(0xFF7C3AED)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text('${proj['customer'] ?? '—'}',
              style: const TextStyle(color: Colors.grey, fontSize: 12)),
          Text('📍 ${proj['siteLocation'] ?? '—'}  ·  ${proj['bountyPayDate'] ?? ''}',
              style: const TextStyle(fontSize: 12, color: Colors.grey)),
          const Divider(height: 16),

          if ((my['engineerBounty'] as num? ?? 0) > 0)
            _BRow('👷 Инженерийн урамшуулал', '',
                fmt(my['engineerBounty'] as num?)),
          if ((my['nonEngineerBounty'] as num? ?? 0) > 0)
            _BRow('🔧 Техникчийн урамшуулал',
                '${(my['nonEngineerHours'] as num?)?.toStringAsFixed(1)}ц × 5,000',
                fmt(my['nonEngineerBounty'] as num?)),
          if ((my['overtimeBounty'] as num? ?? 0) > 0)
            _BRow('⏰ Илүү цагийн урамшуулал',
                '${(my['overtimeHours'] as num?)?.toStringAsFixed(1)}ц × 15,000',
                fmt(my['overtimeBounty'] as num?)),

          const Divider(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Нийт',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              Text(
                '${fmt(my['total'] as num?)}₮',
                style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF16A34A),
                    fontSize: 15),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _BRow extends StatelessWidget {
  final String label, detail, value;
  const _BRow(this.label, this.detail, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 13)),
                if (detail.isNotEmpty)
                  Text(detail,
                      style: const TextStyle(
                          fontSize: 11, color: Colors.grey)),
              ],
            ),
          ),
          Text(
            '+${value}₮',
            style: const TextStyle(
                color: Color(0xFF16A34A),
                fontWeight: FontWeight.bold,
                fontSize: 13),
          ),
        ],
      ),
    );
  }
}

// Simple month year picker dialog content
class _MonthPicker extends StatefulWidget {
  final DateTime initial;
  final void Function(DateTime) onChanged;
  const _MonthPicker({required this.initial, required this.onChanged});

  @override
  State<_MonthPicker> createState() => _MonthPickerState();
}

class _MonthPickerState extends State<_MonthPicker> {
  late int _year;
  late int _month;

  @override
  void initState() {
    super.initState();
    _year = widget.initial.year;
    _month = widget.initial.month;
  }

  @override
  Widget build(BuildContext context) {
    final months = [
      '1-р сар', '2-р сар', '3-р сар', '4-р сар',
      '5-р сар', '6-р сар', '7-р сар', '8-р сар',
      '9-р сар', '10-р сар', '11-р сар', '12-р сар',
    ];
    return SizedBox(
      width: 260,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                  onPressed: () {
                    setState(() => _year--);
                    widget.onChanged(DateTime(_year, _month));
                  },
                  icon: const Icon(Icons.chevron_left)),
              Text('$_year',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 16)),
              IconButton(
                  onPressed: () {
                    setState(() => _year++);
                    widget.onChanged(DateTime(_year, _month));
                  },
                  icon: const Icon(Icons.chevron_right)),
            ],
          ),
          GridView.builder(
            shrinkWrap: true,
            gridDelegate:
                const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              childAspectRatio: 2,
            ),
            itemCount: 12,
            itemBuilder: (_, i) {
              final selected = _month == i + 1;
              return GestureDetector(
                onTap: () {
                  setState(() => _month = i + 1);
                  widget.onChanged(DateTime(_year, i + 1));
                },
                child: Container(
                  margin: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    color: selected
                        ? const Color(0xFF1E3A5F)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    months[i],
                    style: TextStyle(
                        fontSize: 12,
                        color: selected ? Colors.white : Colors.black87),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
