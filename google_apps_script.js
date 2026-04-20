const SHEET_NAME = "Parcels";

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "TrackingID", 
      "วันที่สร้าง", 
      "ผู้ส่ง", 
      "สาขาผู้ส่ง", 
      "ผู้รับ", 
      "สาขาผู้รับ", 
      "ประเภทเอกสาร", 
      "รายละเอียด", 
      "หมายเหตุ", 
      "สถานะ", 
      "รูปยืนยัน"
    ]);
    sheet.getRange("A1:K1").setFontWeight("bold");
    sheet.getRange("A1:K1").setBackground("#f3f4f6");
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    
    if (action === 'createParcel') {
      return handleCreateParcel(payload);
    } else if (action === 'getParcels') {
      return handleGetParcels(payload);
    } else if (action === 'getParcel') {
      return handleGetParcel(payload);
    } else if (action === 'exportSummary') {
      return handleExportSummary();
    } else if (action === 'confirmReceipt') {
      return handleConfirmReceipt(payload);
    }
    
    return createJsonResponse({ success: false, error: "Invalid action" });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

function handleCreateParcel(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const date = new Date();
  
  // Generate Tracking ID (e.g., TRK20260420001)
  const dateStr = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyyMMdd");
  const lastRow = sheet.getLastRow();
  const sequence = (lastRow > 0) ? (lastRow) : 1;
  const trackingId = "TRK" + dateStr + String(sequence).padStart(3, '0');
  
  const createdDate = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  
  sheet.appendRow([
    trackingId,
    createdDate,
    payload.senderName || "",
    payload.senderBranch || "",
    payload.receiverName || "",
    payload.receiverBranch || "",
    payload.docType || "",
    payload.description || "",
    payload.note || "",
    "รอจัดส่ง",
    ""
  ]);
  
  return createJsonResponse({ success: true, trackingId: trackingId });
}

function handleGetParcels(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const parcels = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const parcel = {};
    for (let j = 0; j < headers.length; j++) {
      parcel[headers[j]] = row[j];
    }
    
    // Format Date correctly if it's a date object
    if (parcel["วันที่สร้าง"] && parcel["วันที่สร้าง"].getTime) {
      parcel["วันที่สร้าง"] = Utilities.formatDate(parcel["วันที่สร้าง"], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    }
    
    if (payload.status === "ทั้งหมด" || !payload.status || parcel["สถานะ"] === payload.status) {
      parcels.push(parcel);
    }
  }
  
  // เรียงลำดับจากใหม่ไปเก่า
  parcels.reverse();
  
  return createJsonResponse({ success: true, parcels: parcels });
}

function handleGetParcel(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] === payload.trackingID) {
      const parcel = {};
      for (let j = 0; j < headers.length; j++) {
        parcel[headers[j]] = row[j];
      }
      
      if (parcel["วันที่สร้าง"] && parcel["วันที่สร้าง"].getTime) {
        parcel["วันที่สร้าง"] = Utilities.formatDate(parcel["วันที่สร้าง"], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
      }
      
      return createJsonResponse({ success: true, parcel: parcel });
    }
  }
  
  return createJsonResponse({ success: false, error: "Not found" });
}

function handleExportSummary() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  let total = 0, pending = 0, transit = 0, delivered = 0;
  
  for (let i = 1; i < data.length; i++) {
    const status = data[i][9]; // คอลัมน์ J (index 9)
    total++;
    if (status === "รอจัดส่ง") pending++;
    else if (status === "กำลังจัดส่ง") transit++;
    else if (status === "ส่งถึงแล้ว") delivered++;
  }
  
  return createJsonResponse({ 
    success: true, 
    summary: { total, pending, transit, delivered } 
  });
}

function handleConfirmReceipt(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] === payload.trackingID) {
      const rowIndex = i + 1; // Google Sheet starts at row 1
      
      // อัปเดตหมายเหตุ (ถ้ามี)
      if (payload.note) {
        const existingNote = sheet.getRange(rowIndex, 9).getValue(); 
        sheet.getRange(rowIndex, 9).setValue(existingNote ? existingNote + "\n" + payload.note : payload.note);
      }
      
      // อัปเดตสถานะเป็น "ส่งถึงแล้ว"
      sheet.getRange(rowIndex, 10).setValue("ส่งถึงแล้ว");
      
      // อัปเดต URL รูปภาพยืนยัน
      sheet.getRange(rowIndex, 11).setValue(payload.photoUrl);
      
      return createJsonResponse({ success: true });
    }
  }
  
  return createJsonResponse({ success: false, error: "Tracking ID not found" });
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// จำเป็นต้องมีสำหรับ CORS
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
