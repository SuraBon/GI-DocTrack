const SHEET_NAME = "Parcels";

// นำลิงก์ Google Sheet ของคุณมาใส่ตรงนี้ (ในเครื่องหมายคำพูด)
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1mVw8ZdW5HXkSfu0CY_M1TI7fqJpt77GAA_pVC9m92AU/edit?usp=sharing";

// ฟังก์ชันช่วยดึงข้อมูล Spreadsheet (แก้ที่นี่จุดเดียว)
function getSpreadsheet() {
  try {
    // ลองดึงแบบโปรเจกต์เดิมก่อน
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    // ถ้าพัง (แปลว่าสร้างโปรเจกต์ใหม่) จะดึงจากลิงก์แทน
    return SpreadsheetApp.openByUrl(SHEET_URL);
  }
}

// ฟังก์ชันสำหรับกดเรียกใช้เพื่อขอสิทธิ์ Google Drive โดยเฉพาะ
function authorizeDrive() {
  // คำสั่งนี้จะบังคับให้ Google ขอสิทธิ์ Drive แบบ "แก้ไขได้" (Full Access)
  var dummy = DriveApp.createFolder("DocTrack_Auth_Check");
  dummy.setTrashed(true);
  getSpreadsheet();
}

function setup() {
  const ss = getSpreadsheet();
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
  const sheet = getSpreadsheet().getSheetByName(SHEET_NAME);
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
  const sheet = getSpreadsheet().getSheetByName(SHEET_NAME);
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
  const sheet = getSpreadsheet().getSheetByName(SHEET_NAME);
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
  const sheet = getSpreadsheet().getSheetByName(SHEET_NAME);
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
  const sheet = getSpreadsheet().getSheetByName(SHEET_NAME);
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

      // จัดการเซฟรูปภาพลง Google Drive ถ้าเป็น Base64
      let finalPhotoUrl = payload.photoUrl;

      if (payload.photoUrl && payload.photoUrl.startsWith('data:image')) {
        try {
          const folderId = "1EdVJ73vJ0tGOxn1V3Jh4J2z98T2azrFH";
          const rootFolder = DriveApp.getFolderById(folderId);

          // สร้างโฟลเดอร์ย่อยตามเดือน (เช่น 2026-04)
          const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM");
          let folders = rootFolder.getFoldersByName(dateStr);
          let folder;
          if (folders.hasNext()) {
            folder = folders.next();
          } else {
            folder = rootFolder.createFolder(dateStr);
            folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          }

          const splitData = payload.photoUrl.split(',');
          const base64Data = splitData[1];
          const mimeTypeMatch = splitData[0].match(/:(.*?);/);
          const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
          const extension = mimeType.split('/')[1] || 'jpg';

          const filename = payload.trackingID + "_receipt." + extension;
          const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, filename);

          const file = folder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

          // URL สำหรับดูรูปโดยตรง
          finalPhotoUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
        } catch (e) {
          return createJsonResponse({ success: false, error: "Drive Error: " + e.toString() });
        }
      }

      // อัปเดต URL รูปภาพยืนยัน
      sheet.getRange(rowIndex, 11).setValue(finalPhotoUrl);

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
