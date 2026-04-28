// =============================================================================
// Google Apps Script — รับข้อมูลการส่งต่อผู้ป่วยจาก BMS Dashboard
// =============================================================================
//
// วิธีใช้:
// 1. สร้าง Google Spreadsheet ใหม่
// 2. ไปที่ Extensions > Apps Script
// 3. วางโค้ดนี้ในไฟล์ Code.gs
// 4. กด Deploy > New deployment > Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 5. กด Deploy และคัดลอก URL ที่ได้
// 6. นำ URL ไปวางในหน้ารายชื่อผู้ป่วย > ปุ่มส่ง Google Sheets
// =============================================================================

var SHEET_NAME = 'referout';

var HEADERS = [
  'เลขที่ส่งต่อ', 'วันที่', 'เวลา', 'HN', 'ผู้ป่วย', 'เพศ', 'อายุ',
  'โรงพยาบาลปลายทาง', 'แพทย์', 'สิทธิ', 'ระดับเร่งด่วน', 'แผนก',
  'PDX', 'วินิจฉัย', 'จุดส่งต่อ', 'นำส่ง-พยาบาล', 'นำส่ง-แพทย์', 'นำส่ง-รถพยาบาล'
];

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var data = payload.data || [];

    if (data.length === 0) {
      return jsonResponse({ success: false, message: 'ไม่มีข้อมูล' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);

    // สร้างชีทใหม่พร้อมหัวคอลัมน์ถ้ายังไม่มี
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.getRange(1, 1, 1, HEADERS.length)
        .setFontWeight('bold')
        .setBackground('#4472C4')
        .setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }

    // แปลงข้อมูลเป็นแถวตามลำดับหัวคอลัมน์
    var rows = data.map(function(row) {
      return HEADERS.map(function(h) { return row[h] || ''; });
    });

    // เพิ่มข้อมูลต่อท้าย
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length)
      .setValues(rows);

    return jsonResponse({
      success: true,
      message: 'บันทึกข้อมูล ' + rows.length + ' รายการสำเร็จ',
      rowsAdded: rows.length
    });

  } catch (error) {
    return jsonResponse({ success: false, message: error.toString() });
  }
}

function doGet(e) {
  return jsonResponse({
    status: 'ok',
    message: 'BMS ReferOut Script พร้อมใช้งาน',
    sheetName: SHEET_NAME
  });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
