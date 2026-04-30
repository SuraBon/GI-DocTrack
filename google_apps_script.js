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

  let eventSheet = ss.getSheetByName("ParcelEvents");
  if (!eventSheet) {
    eventSheet = ss.insertSheet("ParcelEvents");
    eventSheet.appendRow([
      "EventID",
      "TrackingID",
      "Timestamp",
      "EventType",
      "Location",
      "DestLocation",
      "Person",
      "PhotoUrl",
      "Latitude",
      "Longitude",
      "Note"
    ]);
    eventSheet.getRange("A1:K1").setFontWeight("bold");
    eventSheet.getRange("A1:K1").setBackground("#e0f2fe");
  }
}

function getEventSheet() {
  const ss = getSpreadsheet();
  let eventSheet = ss.getSheetByName("ParcelEvents");
  if (!eventSheet) {
    setup(); // Create it via setup
    eventSheet = ss.getSheetByName("ParcelEvents");
  }
  return eventSheet;
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

  const eventSheet = getEventSheet();
  if (eventSheet) {
    const eventId = "EVT" + Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyyMMddHHmmssSSS") + Math.floor(Math.random() * 1000);
    eventSheet.appendRow([
      eventId,
      trackingId,
      createdDate,
      "CREATED",
      normalizeBranchName(payload.senderBranch || ""),
      normalizeBranchName(payload.receiverBranch || ""),
      payload.senderName || "",
      "",
      "",
      "",
      "รับเข้าระบบ"
    ]);
  }

  return createJsonResponse({ success: true, trackingId: trackingId });
}

function getParcelEventsMap() {
  const eventSheet = getEventSheet();
  if (!eventSheet) return {};
  const data = eventSheet.getDataRange().getValues();
  if (data.length <= 1) return {};
  
  const headers = data[0];
  const eventsByTrackingId = {};
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const trackingId = row[1];
    
    const evt = {
      id: String(row[0]),
      trackingId: String(trackingId),
      timestamp: String(row[2]),
      eventType: String(row[3]),
      location: String(row[4]),
      destLocation: String(row[5]),
      person: String(row[6]),
      photoUrl: String(row[7]),
      latitude: row[8] !== "" ? Number(row[8]) : undefined,
      longitude: row[9] !== "" ? Number(row[9]) : undefined,
      note: String(row[10])
    };
    
    if (!eventsByTrackingId[trackingId]) {
      eventsByTrackingId[trackingId] = [];
    }
    eventsByTrackingId[trackingId].push(evt);
  }
  return eventsByTrackingId;
}

function handleGetParcels(payload) {
  const sheet = getSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const allFiltered = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (payload.status === "ทั้งหมด" || !payload.status || row[9] === payload.status) {
      allFiltered.push(row);
    }
  }

  const limit = parseInt(payload.limit) || 50;
  const offset = parseInt(payload.offset) || 0;
  const totalCount = allFiltered.length;
  const hasMore = (offset + limit) < totalCount;

  const parcels = [];
  if (offset < totalCount) {
    const startIndex = totalCount - 1 - offset;
    const endIndex = Math.max(-1, startIndex - limit);

    for (let i = startIndex; i > endIndex; i--) {
      const row = allFiltered[i];
      const parcel = {};
      for (let j = 0; j < headers.length; j++) {
        parcel[headers[j]] = row[j];
      }

      if (parcel["วันที่สร้าง"] && parcel["วันที่สร้าง"].getTime) {
        parcel["วันที่สร้าง"] = Utilities.formatDate(parcel["วันที่สร้าง"], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
      }

      parcels.push(parcel);
    }
  }

  // Attach events
  const eventsMap = getParcelEventsMap();
  for (let p of parcels) {
    p.events = eventsMap[p.TrackingID] || [];
  }

  return createJsonResponse({ 
    success: true, 
    parcels: parcels,
    totalCount: totalCount,
    hasMore: hasMore
  });
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

      const eventsMap = getParcelEventsMap();
      parcel.events = eventsMap[payload.trackingID] || [];

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
      // We don't need regex logic to check if it's delivered anymore if we use eventType, 
      // but for backward compatibility, we can leave the check or simplify it.
      if (isActuallyDelivered && payload.eventType === 'FORWARD') {
        // cannot forward an already delivered parcel
        return createJsonResponse({ success: false, error: "Parcel already delivered" });
      }

      let newStatus = currentStatus;
      if (payload.eventType === 'DELIVERED' || payload.eventType === 'PROXY') {
        newStatus = "ส่งถึงแล้ว";
      } else if (payload.eventType === 'FORWARD') {
        newStatus = "กำลังจัดส่ง";
      }

      // Only update main status if it changed
      if (newStatus !== currentStatus) {
        sheet.getRange(rowIndex, 10).setValue(newStatus);
      }

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

          const filename = payload.trackingID + "_" + new Date().getTime() + "." + extension;
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

      // Update main sheet's photo if delivered, or leave it. Actually, update it if it's the latest proof.
      if (finalPhotoUrl) {
        sheet.getRange(rowIndex, 11).setValue(finalPhotoUrl);
      }

      if (payload.note) {
        const existingNote = sheet.getRange(rowIndex, 9).getValue();
        sheet.getRange(rowIndex, 9).setValue(existingNote ? existingNote + "\n" + payload.note : payload.note);
      }

      // Save raw coordinates into new columns for main tracking (if provided)
      if (typeof payload.latitude === 'number' && typeof payload.longitude === 'number') {
        sheet.getRange(rowIndex, 12).setValue(payload.latitude);
        sheet.getRange(rowIndex, 13).setValue(payload.longitude);
      }

      // Insert structured event into ParcelEvents
      if (payload.eventType) {
        const eventSheet = getEventSheet();
        if (eventSheet) {
          const eventId = "EVT" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmssSSS") + Math.floor(Math.random() * 1000);
          const eventTimeStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
          eventSheet.appendRow([
            eventId,
            payload.trackingID,
            eventTimeStr,
            payload.eventType,
            payload.location || "",
            payload.destLocation || "",
            payload.person || "",
            finalPhotoUrl || "",
            typeof payload.latitude === 'number' ? payload.latitude : "",
            typeof payload.longitude === 'number' ? payload.longitude : "",
            payload.note || ""
          ]);
        }
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

  // Attach events
  const eventsMap = getParcelEventsMap();
  for (let p of parcels) {
    p.events = eventsMap[p.TrackingID] || [];
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
