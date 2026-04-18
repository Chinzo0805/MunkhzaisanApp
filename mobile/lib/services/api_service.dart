import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/constants.dart';

class ApiService {
  static Future<Map<String, dynamic>> _post(
      String endpoint, Map<String, dynamic> body) async {
    final resp = await http.post(
      Uri.parse('$kFunctionsBaseUrl/$endpoint'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    if (resp.statusCode != 200) {
      throw Exception('$endpoint failed: ${resp.statusCode} ${resp.body}');
    }
    return jsonDecode(resp.body) as Map<String, dynamic>;
  }

  // ── Projects ──────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> manageProject(
      String action, Map<String, dynamic> data,
      {String? projectId}) async {
    return _post('manageProject', {
      'action': action,
      'projectData': data,
      if (projectId != null) 'projectId': projectId,
    });
  }

  // ── Time Attendance ───────────────────────────────────────────────────
  /// Flexible wrapper: action can be 'add', 'delete', etc.
  static Future<Map<String, dynamic>> manageTimeAttendanceRequest(
      String action, Map<String, dynamic> requestData,
      {String? requestId}) async {
    return _post('manageTimeAttendanceRequest', {
      'action': action,
      'requestData': requestData,
      if (requestId != null) 'requestId': requestId,
    });
  }

  // ── Warehouse ─────────────────────────────────────────────────────────
  /// Flexible wrapper: pass a full body map (must include 'action' key).
  static Future<Map<String, dynamic>> manageWarehouseRequest(
      Map<String, dynamic> body) async {
    return _post('manageWarehouseRequest', body);
  }

  // ── HSE ───────────────────────────────────────────────────────────────
  /// Flexible wrapper: pass a full body map (must include 'action' key).
  static Future<Map<String, dynamic>> manageHseInstruction(
      Map<String, dynamic> body) async {
    return _post('manageHseInstruction', body);
  }
}
