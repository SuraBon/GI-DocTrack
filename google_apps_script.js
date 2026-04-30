const SHEET_NAME = "Parcels";
const API_KEY_PROPERTY = "API_KEY";
const ADMIN_INITIAL_PIN_PROPERTY = "ADMIN_INITIAL_PIN";
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

function getInitialAdminPin() {
  const props = PropertiesService.getScriptProperties();
  let pin = props.getProperty(ADMIN_INITIAL_PIN_PROPERTY);
  if (!pin) {
    pin = String(Math.floor(1000 + Math.random() * 9000));
    props.setProperty(ADMIN_INITIAL_PIN_PROPERTY, pin);
  }
  return pin;
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
      "Longitude",
      "CreatedBy"
    ]);
    sheet.getRange("A1:N1").setFontWeight("bold");
    sheet.getRange("A1:N1").setBackground("#f3f4f6");
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

  let pinSheet = ss.getSheetByName("BranchPINs");
  if (!pinSheet) {
    pinSheet = ss.insertSheet("BranchPINs");
    pinSheet.appendRow(["BranchName", "PIN"]);
    pinSheet.getRange("A1:B1").setFontWeight("bold");
    pinSheet.getRange("A1:B1").setBackground("#fee2e2");
  }

  let usersSheet = ss.getSheetByName("Users");
  if (!usersSheet) {
    usersSheet = ss.insertSheet("Users");
    usersSheet.appendRow(["EmployeeID", "Name", "Branch", "Role", "PIN", "CreatedAt"]);
    usersSheet.getRange("A1:F1").setFontWeight("bold");
    usersSheet.getRange("A1:F1").setBackground("#fef3c7");
    // Add default admin
    usersSheet.appendRow(["admin", "System Admin", "HQ", "Admin", getInitialAdminPin(), new Date()]);
  }
}

function getUsersSheet() {
  const ss = getSpreadsheet();
  let usersSheet = ss.getSheetByName("Users");
  if (!usersSheet) {
    setup();
    usersSheet = ss.getSheetByName("Users");
  }
  return usersSheet;
}

function getUserRecord(employeeId) {
  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  const targetId = String(employeeId || "").trim();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === targetId) {
      return {
        rowIndex: i + 1,
        employeeId: targetId,
        name: String(data[i][1] || "").trim(),
        branch: String(data[i][2] || "").trim(),
        role: String(data[i][3] || "User").trim() || "User",
        pin: String(data[i][4] || "").trim(),
        createdAt: data[i][5]
      };
    }
  }
  return null;
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

function getParcelSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName(SHEET_NAME);
  }
  ensureParcelSheetSchema(sheet);
  return sheet;
}

function ensureParcelSheetSchema(sheet) {
  const requiredHeaders = [
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
    "Longitude",
    "CreatedBy"
  ];
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
  requiredHeaders.forEach(function(header) {
    if (headers.indexOf(header) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
    }
  });
}

function hasAnyRole(payload, roles) {
  return roles.indexOf(String(payload.role || "")) !== -1;
}

function verifyPin(branchName, pin) {
  const cache = CacheService.getScriptCache();
  let pinData = cache.get("BranchPINs");

  if (!pinData) {
    const ss = getSpreadsheet();
    let pinSheet = ss.getSheetByName("BranchPINs");
    if (!pinSheet) {
      setup();
      pinSheet = ss.getSheetByName("BranchPINs");
    }
    const sheetData = pinSheet.getDataRange().getValues();
    pinData = JSON.stringify(sheetData);
    cache.put("BranchPINs", pinData, 600); // 10 minutes cache
  }

  const data = JSON.parse(pinData);
  let correctPin = "0000"; // Default PIN is 0000 if not specified
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(branchName).trim()) {
      if (String(data[i][1]).trim() !== "") {
        correctPin = String(data[i][1]).trim();
      }
      break;
    }
  }
  return String(pin).trim() === correctPin;
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

    // --- Token Signature Verification ---
    const protectedActions = ['createParcel', 'confirmReceipt', 'getParcels', 'exportSummary', 'getUsers', 'updateUserRole', 'deleteParcel', 'editParcel'];
    if (payload.token) {
      const parts = String(payload.token).split('|');
      if (parts.length === 3) {
        const expectedBytes = Utilities.computeHmacSha256Signature(parts[0] + "|" + parts[1], configuredKey);
        if (Utilities.base64Encode(expectedBytes) === parts[2]) {
          const userRecord = getUserRecord(parts[0]);
          if (!userRecord) {
            return createJsonResponse({ success: false, error: "User not found" });
          }
          // Token is valid, but role/name/branch come from the sheet so stale tokens cannot keep old privileges.
          payload.employeeId = userRecord.employeeId;
          payload.role = userRecord.role;
          payload.branch = userRecord.branch;
          payload.name = userRecord.name;
        } else {
          return createJsonResponse({ success: false, error: "Invalid token signature" });
        }
      } else {
        return createJsonResponse({ success: false, error: "Malformed token" });
      }
    } else {
      if (protectedActions.includes(action)) {
        return createJsonResponse({ success: false, error: "Authentication required (Missing Token)" });
      }
      payload.role = 'Guest';
    }

    const writeActions = ['createParcel', 'confirmReceipt', 'login', 'setupPin', 'updateUserRole', 'deleteParcel', 'editParcel'];
    const isWrite = writeActions.includes(action);

    let result;
    if (isWrite) {
      const lock = LockService.getScriptLock();
      let locked = false;
      try {
        locked = lock.tryLock(30000);
        if (!locked) {
          return createJsonResponse({ success: false, error: "ระบบไม่ว่าง กรุณาลองใหม่อีกครั้ง (Lock timeout)" });
        }
        result = routeAction(action, payload);
      } finally {
        if (locked) lock.releaseLock();
      }
    } else {
      result = routeAction(action, payload);
    }

    if (result) return result;

    return createJsonResponse({ success: false, error: "Invalid action" });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

function routeAction(action, payload) {
  if (action === 'createParcel') return handleCreateParcel(payload);
  if (action === 'getParcels') return handleGetParcels(payload);
  if (action === 'getParcel') return handleGetParcel(payload);
  if (action === 'exportSummary') return handleExportSummary(payload);
  if (action === 'confirmReceipt') return handleConfirmReceipt(payload);
  if (action === 'searchParcels') return handleSearchParcels(payload);
  if (action === 'login') return handleLogin(payload);
  if (action === 'setupPin') return handleSetupPin(payload);
  if (action === 'getUsers') return handleGetUsers(payload);
  if (action === 'updateUserRole') return handleUpdateUserRole(payload);
  if (action === 'deleteParcel') return handleDeleteParcel(payload);
  if (action === 'editParcel') return handleEditParcel(payload);
  return null;
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
  if (!hasAnyRole(payload, ['Admin', 'Manager', 'User'])) {
    return createJsonResponse({ success: false, error: "Forbidden" });
  }
  if (!payload.senderName || !payload.senderBranch || !payload.receiverName || !payload.receiverBranch || !payload.docType) {
    return createJsonResponse({ success: false, error: "Missing required fields" });
  }

  if (!verifyPin(payload.senderBranch, payload.pin)) {
    return createJsonResponse({ success: false, error: "รหัส PIN ของสาขาไม่ถูกต้อง" });
  }

  if (payload.note && String(payload.note).length > MAX_NOTE_LENGTH) {
    return createJsonResponse({ success: false, error: "Note is too long" });
  }
  const sheet = getParcelSheet();
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
    "",
    payload.employeeId || ""
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
  const sheet = getParcelSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    return createJsonResponse({ success: true, parcels: [], totalCount: 0, hasMore: false });
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const limit = parseInt(payload.limit) || 50;
  const offset = parseInt(payload.offset) || 0;

  const parcels = [];
  let currentEndRow = lastRow - offset;
  let hasMore = false;
  
  // To avoid hitting execution limits, we will read at most 1000 rows at a time
  // and accumulate until we hit our 'limit' of matched items.
  const CHUNK_SIZE = 500;

  while (currentEndRow > 1 && parcels.length < limit) {
    const startRow = Math.max(2, currentEndRow - CHUNK_SIZE + 1);
    const numRows = currentEndRow - startRow + 1;
    
    // Read this chunk
    const chunkData = sheet.getRange(startRow, 1, numRows, headers.length).getValues();
    
    // Iterate backwards through the chunk
    for (let i = chunkData.length - 1; i >= 0; i--) {
      const row = chunkData[i];
      
      // RBAC check
      if (payload.role === 'User') {
        const creatorId = String(row[13] || "").trim();
        if (creatorId !== String(payload.employeeId).trim()) {
          continue; // Skip if not created by this user
        }
      }

      // Status check
      if (payload.status && payload.status !== "ทั้งหมด") {
        if (row[9] !== payload.status) {
          continue;
        }
      }

      // Map to object
      const parcel = {};
      for (let j = 0; j < headers.length; j++) {
        parcel[headers[j]] = row[j];
      }

      if (parcel["วันที่สร้าง"] && parcel["วันที่สร้าง"].getTime) {
        parcel["วันที่สร้าง"] = Utilities.formatDate(parcel["วันที่สร้าง"], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
      }

      parcels.push(parcel);
      
      if (parcels.length >= limit) {
        hasMore = (startRow + i - 1) > 1;
        break;
      }
    }
    
    currentEndRow = startRow - 1;
    if (parcels.length < limit && currentEndRow > 1) {
      hasMore = true;
    } else if (currentEndRow <= 1) {
      hasMore = false;
    }
  }

  // Attach events
  const eventsMap = getParcelEventsMap();
  for (let p of parcels) {
    p.events = eventsMap[p.TrackingID] || [];
  }

  // totalCount is estimated as (lastRow - 1) for the client's knowledge
  const totalCount = payload.role === 'User'
    ? offset + parcels.length + (hasMore ? 1 : 0)
    : lastRow - 1;
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
  const sheet = getParcelSheet();
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

function handleExportSummary(payload) {
  if (!hasAnyRole(payload, ['Admin', 'Manager'])) {
    return createJsonResponse({ success: false, error: "Forbidden" });
  }
  const sheet = getParcelSheet();
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
  if (!hasAnyRole(payload, ['Admin', 'Manager'])) {
    return createJsonResponse({ success: false, error: "Forbidden" });
  }
  if (!validateTrackingID(payload.trackingID)) {
    return createJsonResponse({ success: false, error: "Invalid trackingID format" });
  }
  if (!payload.photoUrl) {
    return createJsonResponse({ success: false, error: "Missing photoUrl" });
  }

  // Location must be provided by the frontend payload during forwarding or delivery
  if (payload.location && !verifyPin(payload.location, payload.pin)) {
    return createJsonResponse({ success: false, error: "รหัส PIN ของสาขาไม่ถูกต้อง" });
  }
  if (payload.note && String(payload.note).length > MAX_NOTE_LENGTH) {
    return createJsonResponse({ success: false, error: "Note is too long" });
  }
  if (String(payload.photoUrl).startsWith("data:image") && String(payload.photoUrl).length > MAX_BASE64_LENGTH) {
    return createJsonResponse({ success: false, error: "Image payload is too large" });
  }
  const sheet = getParcelSheet();
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

  const sheet = getParcelSheet();
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

function generateToken(employeeId, role, secret) {
  const payloadStr = employeeId + "|" + role;
  const signatureBytes = Utilities.computeHmacSha256Signature(payloadStr, secret);
  const signature = Utilities.base64Encode(signatureBytes);
  return payloadStr + "|" + signature;
}

// --- RBAC & Users ---

function handleLogin(payload) {
  const employeeId = String(payload.employeeId || "").trim();
  const pin = String(payload.pin || "").trim();
  if (!employeeId) return createJsonResponse({ success: false, error: "Missing employee ID" });

  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === employeeId) {
      const storedPin = String(data[i][4] || "").trim();
      const role = String(data[i][3]).trim() || "User";
      const name = String(data[i][1]).trim();
      const branch = String(data[i][2]).trim();

      if (!storedPin) {
        return createJsonResponse({ success: true, needsSetup: true, role, name, branch });
      }

      if (storedPin !== pin) {
        return createJsonResponse({ success: false, error: "รหัส PIN ไม่ถูกต้อง" });
      }

      const token = generateToken(employeeId, role, getApiKey());
      return createJsonResponse({ success: true, user: { employeeId, name, branch, role, token } });
    }
  }

  // Auto-create new user if not found (can set role to User)
  // For security, you might want to restrict this in production.
  sheet.appendRow([employeeId, "Unknown", "Unknown", "User", "", new Date()]);
  return createJsonResponse({ success: true, needsSetup: true, role: "User", name: "Unknown", branch: "Unknown" });
}

function handleSetupPin(payload) {
  const employeeId = String(payload.employeeId || "").trim();
  const pin = String(payload.pin || "").trim();
  const name = String(payload.name || "").trim();
  const branch = String(payload.branch || "").trim();

  if (!employeeId || !pin) return createJsonResponse({ success: false, error: "Missing required fields" });
  if (!/^\d{4}$/.test(pin)) return createJsonResponse({ success: false, error: "PIN must be 4 digits" });

  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === employeeId) {
      const storedPin = String(data[i][4] || "").trim();
      if (storedPin) {
        return createJsonResponse({ success: false, error: "PIN already set" });
      }
      // Allow overriding name/branch during setup
      if (name) sheet.getRange(i + 1, 2).setValue(name);
      if (branch) sheet.getRange(i + 1, 3).setValue(branch);
      sheet.getRange(i + 1, 5).setValue(pin);
      
      const role = String(data[i][3]).trim() || "User";
      const finalName = name || String(data[i][1]).trim();
      const finalBranch = branch || String(data[i][2]).trim();

      const token = generateToken(employeeId, role, getApiKey());
      return createJsonResponse({ success: true, user: { employeeId, name: finalName, branch: finalBranch, role, token } });
    }
  }
  return createJsonResponse({ success: false, error: "User not found" });
}

function handleGetUsers(payload) {
  if (payload.role !== 'Admin') {
    return createJsonResponse({ success: false, error: "Forbidden: Admins only" });
  }
  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  const users = [];
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    users.push({
      employeeId: String(row[0]),
      name: String(row[1]),
      branch: String(row[2]),
      role: String(row[3]),
      hasPin: !!String(row[4]).trim(),
      createdAt: row[5] ? Utilities.formatDate(new Date(row[5]), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : ""
    });
  }
  return createJsonResponse({ success: true, users: users });
}

function handleUpdateUserRole(payload) {
  if (payload.role !== 'Admin') {
    return createJsonResponse({ success: false, error: "Forbidden: Admins only" });
  }

  const targetId = String(payload.targetId || "").trim();
  const newRole = payload.newRole;
  if (!targetId || !newRole) return createJsonResponse({ success: false, error: "Missing fields" });
  if (['Admin', 'Manager', 'User'].indexOf(newRole) === -1) {
    return createJsonResponse({ success: false, error: "Invalid role" });
  }
  if (targetId === String(payload.employeeId || "").trim() && newRole !== 'Admin') {
    return createJsonResponse({ success: false, error: "Cannot lower your own admin role" });
  }

  const sheet = getUsersSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === targetId) {
      sheet.getRange(i + 1, 4).setValue(newRole);
      return createJsonResponse({ success: true });
    }
  }
  return createJsonResponse({ success: false, error: "Target user not found" });
}

function handleDeleteParcel(payload) {
  if (payload.role !== 'Admin') {
    return createJsonResponse({ success: false, error: "Forbidden: Admins only" });
  }

  const trackingID = String(payload.trackingID || "").trim();
  if (!trackingID) return createJsonResponse({ success: false, error: "Missing trackingID" });
  if (!validateTrackingID(trackingID)) return createJsonResponse({ success: false, error: "Invalid trackingID format" });

  const sheet = getParcelSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === trackingID) {
      sheet.deleteRow(i + 1);
      const eventSheet = getEventSheet();
      if (eventSheet) {
        const eventData = eventSheet.getDataRange().getValues();
        for (let j = eventData.length - 1; j >= 1; j--) {
          if (String(eventData[j][1]).trim() === trackingID) {
            eventSheet.deleteRow(j + 1);
          }
        }
      }
      return createJsonResponse({ success: true });
    }
  }
  return createJsonResponse({ success: false, error: "Parcel not found" });
}

function handleEditParcel(payload) {
  if (payload.role !== 'Admin') {
    return createJsonResponse({ success: false, error: "Forbidden: Admins only" });
  }

  const { trackingID, updates } = payload;
  if (!trackingID || !updates) return createJsonResponse({ success: false, error: "Missing fields" });
  if (!validateTrackingID(trackingID)) return createJsonResponse({ success: false, error: "Invalid trackingID format" });

  const sheet = getParcelSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === trackingID) {
      const rowIndex = i + 1;
      
      if (updates.senderName) sheet.getRange(rowIndex, headers.indexOf("ผู้ส่ง") + 1).setValue(updates.senderName);
      if (updates.senderBranch) sheet.getRange(rowIndex, headers.indexOf("สาขาผู้ส่ง") + 1).setValue(updates.senderBranch);
      if (updates.receiverName) sheet.getRange(rowIndex, headers.indexOf("ผู้รับ") + 1).setValue(updates.receiverName);
      if (updates.receiverBranch) sheet.getRange(rowIndex, headers.indexOf("สาขาผู้รับ") + 1).setValue(updates.receiverBranch);
      if (updates.docType) sheet.getRange(rowIndex, headers.indexOf("ประเภทเอกสาร") + 1).setValue(updates.docType);
      if (updates.description) sheet.getRange(rowIndex, headers.indexOf("รายละเอียด") + 1).setValue(updates.description);
      
      return createJsonResponse({ success: true });
    }
  }
  return createJsonResponse({ success: false, error: "Parcel not found" });
}

function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
