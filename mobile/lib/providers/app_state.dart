import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../services/auth_service.dart';

class AppState extends ChangeNotifier {
  final AuthService _authService = AuthService();
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  User? user;
  Map<String, dynamic>? userData;
  bool loading = true;
  String? error;

  AppState() {
    _authService.authStateChanges.listen(_onAuthChange);
  }

  Future<void> _onAuthChange(User? u) async {
    user = u;
    if (u != null) {
      loading = true;
      notifyListeners();
      try {
        final doc = await _db.collection('users').doc(u.uid).get();
        userData = doc.exists ? doc.data() : null;
      } catch (e) {
        error = e.toString();
      }
    } else {
      userData = null;
    }
    loading = false;
    notifyListeners();
  }

  Future<void> signInWithGoogle() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final data = await _authService.signInWithGoogle();
      // _onAuthChange triggered by authStateChanges
      if (data == null) {
        error = 'Нэвтрэх үед алдаа гарлаа. Та бүртгэлтэй эсэхийг шалгана уу.';
        loading = false;
        notifyListeners();
      }
    } catch (e) {
      error = e.toString();
      loading = false;
      notifyListeners();
    }
  }

  Future<void> signOut() async {
    await _authService.signOut();
  }

  bool get isSupervisor => userData?['role'] == 'Supervisor';
  bool get isAccountant => userData?['role'] == 'Accountant';
  String get employeeId => userData?['employeeId']?.toString() ?? '';
  String get firstName => userData?['employeeFirstName'] ?? '';
  String get lastName => userData?['employeeLastName'] ?? '';
  String get fullName => '$lastName $firstName'.trim();
  String get position => userData?['position'] ?? '';

  // --- View-as (supervisor on behalf of employee) ---
  Map<String, dynamic>? viewAsData;

  bool get isViewingAs => viewAsData != null;

  String get effectiveEmployeeId {
    if (viewAsData != null) return viewAsData!['employeeId']?.toString() ?? '';
    return employeeId;
  }

  String get effectiveFirstName {
    if (viewAsData != null) return viewAsData!['firstName'] ?? '';
    return firstName;
  }

  String get effectiveFullName {
    if (viewAsData != null) {
      final ln = viewAsData!['lastName'] ?? '';
      final fn = viewAsData!['firstName'] ?? '';
      return '$ln $fn'.trim();
    }
    return fullName;
  }

  String get effectivePosition {
    if (viewAsData != null) return viewAsData!['position'] ?? '';
    return position;
  }

  void setViewAs(Map<String, dynamic> data) {
    viewAsData = data;
    notifyListeners();
  }

  void clearViewAs() {
    viewAsData = null;
    notifyListeners();
  }
}
