import 'dart:async';
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

  // Real-time listener for the linked employee doc
  StreamSubscription? _employeeSubscription;

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

        // Block departed employees (State == 'Гарсан')
        if (userData != null && userData!['employeeId'] != null) {
          final empId = userData!['employeeId'];
          final empSnap = await _db
              .collection('employees')
              .where('Id', isEqualTo: int.tryParse(empId.toString()) ?? empId)
              .limit(1)
              .get();
          if (empSnap.docs.isNotEmpty &&
              empSnap.docs.first.data()['State'] == 'Гарсан') {
            error = 'Таны эрх хаагдсан байна. Та компанийг орхисон тул системд нэвтрэх боломжгүй.';
            userData = null;
            loading = false;
            notifyListeners();
            await _authService.signOut();
            return;
          }

          // Employee is active — watch in real time so they are kicked out
          // immediately if their state is changed to 'Гарсан' while logged in
          _employeeSubscription?.cancel();
          _employeeSubscription = _db
              .collection('employees')
              .where('Id', isEqualTo: int.tryParse(empId.toString()) ?? empId)
              .limit(1)
              .snapshots()
              .listen((snap) async {
            if (snap.docs.isNotEmpty &&
                snap.docs.first.data()['State'] == 'Гарсан') {
              error = 'Таны эрх хаагдсан байна. Та компанийг орхисон тул системд нэвтрэх боломжгүй.';
              userData = null;
              notifyListeners();
              await _authService.signOut();
            }
          });
        }
      } catch (e) {
        error = e.toString();
      }
    } else {
      _employeeSubscription?.cancel();
      _employeeSubscription = null;
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
    _employeeSubscription?.cancel();
    _employeeSubscription = null;
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
