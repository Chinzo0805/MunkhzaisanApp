import 'package:flutter/material.dart';

const String kFunctionsBaseUrl =
    'https://asia-east2-munkh-zaisan.cloudfunctions.net';

const String kProjectCollection = 'projects';
const String kTimeAttendanceCollection = 'timeAttendance';
const String kTimeAttendanceRequestsCollection = 'timeAttendanceRequests';
const String kUsersCollection = 'users';
const String kEmployeesCollection = 'employees';
const String kWarehouseCollection = 'warehouse';
const String kWarehouseRequestsCollection = 'warehouseRequests';
const String kHseInstructionsCollection = 'hseInstructions';
const String kSalariesCollection = 'salaries';
const String kConfirmedSalariesCollection = 'confirmedSalaries';

const Map<String, String> kStatusLabels = {
  'Төлөвлсөн': 'Төлөвлсөн',
  'Ажиллаж байгаа': 'Ажиллаж байгаа',
  'Ажил хүлээлгэн өгөх': 'Ажил хүлээлгэн өгөх',
  'Нэхэмжлэх өгөх ба Шалгах': 'Нэхэмжлэх өгөх ба Шалгах',
  'Урамшуулал олгох': 'Урамшуулал олгох',
  'Дууссан': 'Дууссан',
};

const List<String> kStatusOrder = [
  'Төлөвлсөн',
  'Ажиллаж байгаа',
  'Ажил хүлээлгэн өгөх',
  'Нэхэмжлэх өгөх ба Шалгах',
  'Урамшуулал олгох',
  'Дууссан',
];

const List<String> kAttendanceStatuses = [
  'Ирсэн',
  'Томилолт',
  'Чөлөөтэй/Амралт',
  'тасалсан',
];

// Alias used in screens
const List<String> kTAStatuses = kAttendanceStatuses;

const List<String> kWeekDays = [
  'Даваа',
  'Мягмар',
  'Лхагва',
  'Пүрэв',
  'Баасан',
  'Бямба',
  'Ням',
];

const Color kPrimaryColor = Color(0xFF1E3A5F);
const Color kAccentColor = Color(0xFF22C55E);
const Color kWarningColor = Color(0xFFD97706);
const Color kDangerColor = Color(0xFFDC2626);
const Color kBgColor = Color(0xFFF4F6FB);
