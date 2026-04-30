const SHEET_NAME = "Parcels";
const API_KEY_PROPERTY = "API_KEY";
// Fallback key (ใช้กรณีไม่อยากตั้ง Script Properties)
// ตั้งค่านี้ให้ตรงกับ VITE_GAS_API_KEY แล้ว Deploy ใหม่
// แนะนำ: อย่า commit ค่า key ลง git ถ้า repo เป็น public
const SCRIPT_API_KEY = "";
const MAX_NOTE_LENGTH = 2000;
const MAX_BASE64_LENGTH = 6 * 1024 * 1024;
const TRACKING_ID_REGEX = /^TRK\d{8}\d{4,}$/;

// นำลิงก์ Google Sheet ของคุณมาใส่ตรงนี้ (ในเครื่องหมายคำพูด)
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1mVw8ZdW5HXkSfu0CY_M1TI7fqJpt77GAA_pVC9m92AU/edit?usp=sharing";

function getSpreadsheet() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    return SpreadsheetApp.openByUrl(SHEET_URL);
  }
}

function getApiKey() {
  return PropertiesService.getScriptProperties().getProperty(API_KEY_PROPERTY) || SCRIPT_API_KEY || "";
}

function normalizeBranchName(branch) {
  if (!branch) return "";
  const value = String(branch).trim();
  const aliases = {
    "พันธุ์สงคราม": "พิบูลสงคราม",
    "เซ็นทรัลพระราม 2": "เซ็นทรัล พระราม 2",
  };
  return aliases[value] || value;
}

function validateTrackingID(trackingID) {
  return !!trackingID && TRACKING_ID_REGEX.test(String(trackingID).trim());
}

function authorizeDrive() {
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
      "รูปยืนยัน",
      "Latitude",
      "Longitude"
    ]);
    sheet.getRange("A1:M1").setFontWeight("bold");
    sheet.getRange("A1:M1").setBackground("#f3f4f6");
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const configuredKey = getApiKey();
    if (!configuredKey) {
      return createJsonResponse({ success: false, error: "API key is not configured on script properties" });
    }
    if (payload.apiKey !== configuredKey) {
      return createJsonResponse({ success: false, error: "Unauthorized" });
    }

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
    } else if (action === 'searchParcels') {
      return handleSearchParcels(payload);
    }

    return createJsonResponse({ success: false, error: "Invalid action" });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

function doGet() {
  return createJsonResponse({
    success: true,
    service: "doc-track-api",
    version: "1.1.0",
    timestamp: new Date().toISOString(),
  });
}

function handleCreateParcel(payload) {
  if (!payload.senderName || !payload.senderBranch || !payload.receiverName || !payload.receiverBranch || !payload.docType) {
    return createJsonResponse({ success: false, error: "Missing required fields" });
  }
  if (payload.note && String(payload.note).length > MAX_NOTE_LENGTH) {
    return createJsonResponse({ success: false, error: "Note is too long" });
  }
  const sheet = getSpreadsheet().getSheetByName(SHEET_NAME);
  const date = new Date();

  // ป้องกัน Tracking ID ซ้ำกันโดยใช้ Millisecond ต่อท้าย
  const dateStr = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyyMMdd");
  const trackingId = "TRK" + dateStr + String(date.getTime()).slice(-4);

  const createdDate = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  sheet.appendRow([
    trackingId,
    createdDate,
    payload.senderName || "",
    normalizeBranchName(payload.senderBranch || ""),
    payload.receiverName || "",
    normalizeBranchName(payload.receiverBranch || ""),
    payload.docType || "",
    payload.description || "",
    payload.note || "",
    "รอจัดส่ง",
    "",
    "",
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

    if (parcel["วันที่สร้าง"] && parcel["วันที่สร้าง"].getTime) {
      parcel["วันที่สร้าง"] = Utilities.formatDate(parcel["วันที่สร้าง"], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    }

    if (payload.status === "ทั้งหมด" || !payload.status || parcel["สถานะ"] === payload.status) {
      parcels.push(parcel);
    }
  }

  parcels.reverse();
  return createJsonResponse({ success: true, parcels: parcels });
}

function handleGetParcel(payload) {
  if (!validateTrackingID(payload.trackingID)) {
    return createJsonResponse({ success: false, error: "Invalid trackingID format" });
  }
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
    const status = data[i][9];
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
  if (!validateTrackingID(payload.trackingID)) {
    return createJsonResponse({ success: false, error: "Invalid trackingID format" });
  }
  if (!payload.photoUrl) {
    return createJsonResponse({ success: false, error: "Missing photoUrl" });
  }
  if (payload.note && String(payload.note).length > MAX_NOTE_LENGTH) {
    return createJsonResponse({ success: false, error: "Note is too long" });
  }
  if (String(payload.photoUrl).startsWith("data:image") && String(payload.photoUrl).length > MAX_BASE64_LENGTH) {
    return createJsonResponse({ success: false, error: "Image payload is too large" });
  }
  const sheet = getSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] === payload.trackingID) {
      const rowIndex = i + 1;
      const currentStatus = row[9];
      const noteStr = String(row[8] || "");
      
      let isActuallyDelivered = currentStatus === "ส่งถึงแล้ว";
      if (isActuallyDelivered) {
        const lastForwardIdx = noteStr.lastIndexOf('[ส่งต่อโดย:');
        const lastProxyIdx = noteStr.lastIndexOf('[รับแทนโดย:');
        const lastNormalIdx = noteStr.lastIndexOf('[รับพัสดุเรียบร้อย');
        const maxIdx = Math.max(lastForwardIdx, lastProxyIdx, lastNormalIdx);
        if (maxIdx >= 0 && maxIdx === lastForwardIdx) {
          isActuallyDelivered = false; // it is in transit
        }
      }

      if (isActuallyDelivered) {
        return createJsonResponse({ success: false, error: "Parcel already delivered" });
      }

      sheet.getRange(rowIndex, 10).setValue("ส่งถึงแล้ว");

      let finalPhotoUrl = payload.photoUrl;

      if (payload.photoUrl && payload.photoUrl.startsWith('data:image')) {
        try {
          // ค้นหาหรือสร้างโฟลเดอร์หลักชื่อ DocTrack_Images
          let rootFolder;
          const rootFolderIterator = DriveApp.getFoldersByName("DocTrack_Images");
          if (rootFolderIterator.hasNext()) {
            rootFolder = rootFolderIterator.next();
          } else {
            rootFolder = DriveApp.createFolder("DocTrack_Images");
            try {
              rootFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            } catch (e) {
              console.log("Sharing restriction: " + e.message);
            }
          }

          // สร้างโฟลเดอร์ย่อยตามเดือน (เช่น 2026-04)
          const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM");
          let folders = rootFolder.getFoldersByName(dateStr);
          let folder;
          if (folders.hasNext()) {
            folder = folders.next();
          } else {
            folder = rootFolder.createFolder(dateStr);
            try {
              folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            } catch (e) {
              console.log("Sharing restriction: " + e.message);
            }
          }

          const splitData = payload.photoUrl.split(',');
          const base64Data = splitData[1];
          const mimeTypeMatch = splitData[0].match(/:(.*?);/);
          const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
          const extension = mimeType.split('/')[1] || 'jpg';

          const filename = payload.trackingID + "_receipt." + extension;
          const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, filename);

          const file = folder.createFile(blob);
          try {
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          } catch (e) {
            console.log("Sharing restriction: " + e.message);
          }

          finalPhotoUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
        } catch (e) {
          return createJsonResponse({ success: false, error: "Drive Error: " + e.toString() });
        }
      }

      sheet.getRange(rowIndex, 11).setValue(finalPhotoUrl);

      if (payload.note) {
        let noteToSave = payload.note;
        if (finalPhotoUrl) {
          noteToSave = noteToSave.replace(/\|IMAGE_URL\|/g, finalPhotoUrl);
        } else {
          noteToSave = noteToSave.replace(/ รูปภาพ: \|IMAGE_URL\|/g, '');
        }
        
        // Handle GPS coordinate replacement in the note string
        if (payload.latitude && payload.longitude) {
          noteToSave = noteToSave.replace(/\|LAT\|/g, payload.latitude);
          noteToSave = noteToSave.replace(/\|LNG\|/g, payload.longitude);
        } else {
          noteToSave = noteToSave.replace(/ GPS: \|LAT\|,\|LNG\|/g, '');
        }

        const existingNote = sheet.getRange(rowIndex, 9).getValue();
        sheet.getRange(rowIndex, 9).setValue(existingNote ? existingNote + "\n" + noteToSave : noteToSave);
      }

      // Save raw coordinates into new columns (if provided)
      if (typeof payload.latitude === 'number' && typeof payload.longitude === 'number') {
        sheet.getRange(rowIndex, 12).setValue(payload.latitude);
        sheet.getRange(rowIndex, 13).setValue(payload.longitude);
      }

      return createJsonResponse({ success: true });
    }
  }

  return createJsonResponse({ success: false, error: "Tracking ID not found" });
}

function handleSearchParcels(payload) {
  const query = (payload.query || "").toString().toLowerCase().trim();
  if (!query) {
    return createJsonResponse({ success: true, parcels: [] });
  }

  const sheet = getSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const parcels = [];

  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    const sender = String(row[2] || "").toLowerCase();
    const receiver = String(row[4] || "").toLowerCase();
    const tracking = String(row[0] || "").toLowerCase();

    if (tracking.indexOf(query) === -1 && sender.indexOf(query) === -1 && receiver.indexOf(query) === -1) {
      continue;
    }

    const parcel = {};
    for (let j = 0; j < headers.length; j++) {
      parcel[headers[j]] = row[j];
    }

    if (parcel["วันที่สร้าง"] && parcel["วันที่สร้าง"].getTime) {
      parcel["วันที่สร้าง"] = Utilities.formatDate(parcel["วันที่สร้าง"], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    }

    parcels.push(parcel);
    if (parcels.length >= 50) break;
  }

  return createJsonResponse({ success: true, parcels: parcels });
}

function setupApiKey(value) {
  if (!value) {
    throw new Error("Missing API key value");
  }
  PropertiesService.getScriptProperties().setProperty(API_KEY_PROPERTY, String(value).trim());
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
