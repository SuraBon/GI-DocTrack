const SHEET_NAME = "Parcels";
const API_KEY_PROPERTY = "API_KEY";
const ADMIN_INITIAL_PIN_PROPERTY = "ADMIN_INITIAL_PIN";
const VALID_ROLES = ["USER", "MESSENGER", "ADMIN"];
const DEMO_USERS = [
  ["user_test", "Demo User", "HQ", "USER", "user123"],
  ["messenger_test", "Demo Messenger", "HQ", "MESSENGER", "messenger123"],
  ["admin_test", "Demo Admin", "HQ", "ADMIN", "admin123"]
];
// Fallback key (ใช้กรณีไม่อยากตั้ง Script Properties)
// ตั้งค่านี้ให้ตรงกับ VITE_GAS_API_KEY แล้ว Deploy ใหม่
// แนะนำ: อย่า commit ค่า key ลง git ถ้า repo เป็น public
const SCRIPT_API_KEY = "";
const MAX_NOTE_LENGTH = 2000;
const MAX_BASE64_LENGTH = 6 * 1024 * 1024;
const TRACKING_ID_REGEX = /^TRK\d{8}\d{4,}$/;

// นำลิงก์ Google Sheet ของคุณมาใส่ตรงนี้ (ในเครื่องหมายคำพูด)
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1mVw8ZdW5HXkSfu0CY_M1TI7fqJpt77GAA_pVC9m92AU/edit?usp=sharing";
const YEAR_SPREADSHEETS_PROPERTY = "YEAR_SPREADSHEETS";
const YEAR_SPREADSHEET_PREFIX = "DocTrack";
const LEGACY_PARCEL_SHEET_NAME = SHEET_NAME;
const PARCEL_SHEET_PREFIX = "Parcels_";
const PARCEL_HEADERS = [
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
const EVENT_HEADERS = [
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
];

function getSpreadsheet() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    return SpreadsheetApp.openByUrl(SHEET_URL);
  }
}

function getYearSpreadsheetName(year) {
  return YEAR_SPREADSHEET_PREFIX + " " + year;
}

function getStoredYearSpreadsheetMap() {
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty(YEAR_SPREADSHEETS_PROPERTY) || "{}");
  } catch (e) {
    return {};
  }
}

function setStoredYearSpreadsheetMap(map) {
  PropertiesService.getScriptProperties().setProperty(YEAR_SPREADSHEETS_PROPERTY, JSON.stringify(map || {}));
}

function getMonthSheetName(dateOrYear, month) {
  let monthNumber = month;
  if (dateOrYear instanceof Date) {
    monthNumber = Number(Utilities.formatDate(dateOrYear, Session.getScriptTimeZone(), "MM"));
  }
  return PARCEL_SHEET_PREFIX + String(monthNumber).padStart(2, "0");
}

function getYearFromDate(date) {
  return Number(Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy"));
}

function parseTrackingDate(trackingID) {
  const match = String(trackingID || "").match(/^TRK(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function ensureHeaderRow(sheet, headers, background) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  const currentLastColumn = Math.max(sheet.getLastColumn(), 1);
  const currentHeaders = sheet.getRange(1, 1, 1, currentLastColumn).getValues()[0].map(String);
  headers.forEach(function(header) {
    if (currentHeaders.indexOf(header) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
    }
  });
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  if (background) sheet.getRange(1, 1, 1, headers.length).setBackground(background);
}

function ensureParcelSheetSchema(sheet) {
  ensureHeaderRow(sheet, PARCEL_HEADERS, "#f3f4f6");
}

function ensureEventSheetSchema(sheet) {
  ensureHeaderRow(sheet, EVENT_HEADERS, "#e0f2fe");
}

function getYearSpreadsheet(year, createIfMissing) {
  const normalizedYear = Number(year || getYearFromDate(new Date()));
  const master = getSpreadsheet();
  const masterId = master.getId();
  const map = getStoredYearSpreadsheetMap();
  const mappedId = map[String(normalizedYear)];

  if (mappedId) {
    try {
      return SpreadsheetApp.openById(mappedId);
    } catch (e) {
      delete map[String(normalizedYear)];
      setStoredYearSpreadsheetMap(map);
    }
  }

  let ss;
  if (String(normalizedYear) === String(getYearFromDate(new Date())) && master.getName() === getYearSpreadsheetName(normalizedYear)) {
    ss = master;
  } else {
    const yearName = getYearSpreadsheetName(normalizedYear);
    try {
      const existingFiles = DriveApp.getFilesByName(yearName);
      while (existingFiles.hasNext()) {
        const file = existingFiles.next();
        if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
          ss = SpreadsheetApp.openById(file.getId());
          break;
        }
      }
    } catch (e) {
      ss = null;
    }

    if (ss) {
      map[String(normalizedYear)] = ss.getId();
      setStoredYearSpreadsheetMap(map);
      return ss;
    }

    if (!createIfMissing) return null;

    if (!ss) {
      ss = SpreadsheetApp.create(yearName);
    }

    try {
      const parentFolders = DriveApp.getFileById(masterId).getParents();
      if (parentFolders.hasNext()) {
        const folder = parentFolders.next();
        const newFile = DriveApp.getFileById(ss.getId());
        folder.addFile(newFile);
        DriveApp.getRootFolder().removeFile(newFile);
      }
    } catch (e) {
      // Creating in root is still valid if folder move is not available.
    }
  }

  map[String(normalizedYear)] = ss.getId();
  setStoredYearSpreadsheetMap(map);
  return ss;
}

function getYearSpreadsheetsForRead() {
  const map = getStoredYearSpreadsheetMap();
  const years = Object.keys(map).map(Number).filter(function(year) { return !isNaN(year); });
  const currentYear = getYearFromDate(new Date());
  if (years.indexOf(currentYear) === -1) years.push(currentYear);
  years.sort(function(a, b) { return b - a; });

  const result = [];
  const seenIds = {};
  years.forEach(function(year) {
    const ss = getYearSpreadsheet(year, year === currentYear);
    if (ss) {
      seenIds[ss.getId()] = true;
      result.push({ year: year, spreadsheet: ss });
    }
  });

  const master = getSpreadsheet();
  const hasLegacyParcelSheets = master.getSheets().some(function(sheet) {
    return sheet.getName() === LEGACY_PARCEL_SHEET_NAME || sheet.getName().indexOf(PARCEL_SHEET_PREFIX) === 0;
  });
  if (hasLegacyParcelSheets && !seenIds[master.getId()]) {
    result.push({ year: currentYear, spreadsheet: master });
  }

  return result;
}

function getParcelSheet(date, createIfMissing) {
  const targetDate = date || new Date();
  const year = getYearFromDate(targetDate);
  const ss = getYearSpreadsheet(year, createIfMissing !== false);
  if (!ss) return null;
  const sheetName = getMonthSheetName(targetDate);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet && createIfMissing !== false) {
    sheet = ss.insertSheet(sheetName);
  }
  if (sheet) ensureParcelSheetSchema(sheet);
  return sheet;
}

function getParcelSheetsForRead() {
  const result = [];
  getYearSpreadsheetsForRead().forEach(function(entry) {
    const sheets = entry.spreadsheet.getSheets()
      .filter(function(sheet) {
        return sheet.getName() === LEGACY_PARCEL_SHEET_NAME || sheet.getName().indexOf(PARCEL_SHEET_PREFIX) === 0;
      })
      .sort(function(a, b) {
        if (a.getName() === LEGACY_PARCEL_SHEET_NAME) return 1;
        if (b.getName() === LEGACY_PARCEL_SHEET_NAME) return -1;
        return b.getName().localeCompare(a.getName());
      });
    sheets.forEach(function(sheet) {
      ensureParcelSheetSchema(sheet);
      result.push({ year: entry.year, spreadsheet: entry.spreadsheet, sheet: sheet });
    });
  });
  return result;
}

function getParcelStorageByTrackingId(trackingID) {
  const parsed = parseTrackingDate(trackingID);
  if (parsed) {
    const ss = getYearSpreadsheet(parsed.year, false);
    if (ss) {
      const sheet = ss.getSheetByName(getMonthSheetName(parsed.year, parsed.month));
      if (sheet) {
        ensureParcelSheetSchema(sheet);
        return { spreadsheet: ss, sheet: sheet };
      }
    }
  }

  const sheets = getParcelSheetsForRead();
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i].sheet;
    const data = sheet.getDataRange().getValues();
    for (let row = 1; row < data.length; row++) {
      if (String(data[row][0]).trim() === String(trackingID).trim()) {
        return { spreadsheet: sheets[i].spreadsheet, sheet: sheet };
      }
    }
  }
  return null;
}

function getEventSheetForSpreadsheet(ss) {
  let eventSheet = ss.getSheetByName("ParcelEvents");
  if (!eventSheet) {
    eventSheet = ss.insertSheet("ParcelEvents");
  }
  ensureEventSheetSchema(eventSheet);
  return eventSheet;
}

function getEventSheetForTrackingId(trackingID) {
  const storage = getParcelStorageByTrackingId(trackingID);
  if (storage) return getEventSheetForSpreadsheet(storage.spreadsheet);
  const parsed = parseTrackingDate(trackingID);
  if (parsed) {
    const ss = getYearSpreadsheet(parsed.year, true);
    return getEventSheetForSpreadsheet(ss);
  }
  return getEventSheetForSpreadsheet(getYearSpreadsheet(getYearFromDate(new Date()), true));
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
  getParcelSheet(new Date(), true);

  let eventSheet = ss.getSheetByName("ParcelEvents");
  if (!eventSheet) {
    eventSheet = ss.insertSheet("ParcelEvents");
  }
  ensureEventSheetSchema(eventSheet);

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
    usersSheet.appendRow(["admin", "System Admin", "HQ", "ADMIN", getInitialAdminPin(), new Date()]);
  }
  ensureDemoUsers(usersSheet);
}

function getUsersSheet() {
  const ss = getSpreadsheet();
  let usersSheet = ss.getSheetByName("Users");
  if (!usersSheet) {
    setup();
    usersSheet = ss.getSheetByName("Users");
  }
  ensureDemoUsers(usersSheet);
  return usersSheet;
}

function normalizeRole(role) {
  const value = String(role || "").trim().toUpperCase();
  if (value === "ADMIN") return "ADMIN";
  if (value === "MESSENGER" || value === "MANAGER") return "MESSENGER";
  if (value === "USER") return "USER";
  return "GUEST";
}

function ensureDemoUsers(usersSheet) {
  const data = usersSheet.getDataRange().getValues();
  const existingRows = {};
  for (let i = 1; i < data.length; i++) {
    existingRows[String(data[i][0] || "").trim()] = i + 1;
  }

  DEMO_USERS.forEach(function(user) {
    const rowIndex = existingRows[user[0]];
    if (rowIndex) {
      const row = data[rowIndex - 1];
      if (
        String(row[1] || "") !== user[1] ||
        String(row[2] || "") !== user[2] ||
        normalizeRole(row[3]) !== user[3] ||
        String(row[4] || "") !== user[4]
      ) {
        usersSheet.getRange(rowIndex, 2, 1, 4).setValues([[user[1], user[2], user[3], user[4]]]);
      }
    } else {
      usersSheet.appendRow([user[0], user[1], user[2], user[3], user[4], new Date()]);
    }
  });
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
        role: normalizeRole(data[i][3] || "USER"),
        pin: String(data[i][4] || "").trim(),
        createdAt: data[i][5]
      };
    }
  }
  return null;
}

function getEventSheet() {
  return getEventSheetForSpreadsheet(getYearSpreadsheet(getYearFromDate(new Date()), true));
}

function hasAnyRole(payload, roles) {
  return roles.indexOf(normalizeRole(payload.role)) !== -1;
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
      payload.role = 'GUEST';
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
  if (!hasAnyRole(payload, ['ADMIN', 'USER'])) {
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
  const date = new Date();
  const sheet = getParcelSheet(date, true);
  const yearSpreadsheet = getYearSpreadsheet(getYearFromDate(date), true);

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

  const eventSheet = getEventSheetForSpreadsheet(yearSpreadsheet);
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
  const eventsByTrackingId = {};

  getYearSpreadsheetsForRead().forEach(function(entry) {
    const eventSheet = entry.spreadsheet.getSheetByName("ParcelEvents");
    if (!eventSheet) return;
    const data = eventSheet.getDataRange().getValues();
    if (data.length <= 1) return;

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
  });

  return eventsByTrackingId;
}

function handleGetParcels(payload) {
  const limit = parseInt(payload.limit) || 50;
  const offset = parseInt(payload.offset) || 0;
  const parcels = [];
  let skipped = 0;
  let totalCount = 0;
  let hasMore = false;

  const sheets = getParcelSheetsForRead();
  if (!sheets.length) {
    return createJsonResponse({ success: true, parcels: [], totalCount: 0, hasMore: false });
  }

  sheets.forEach(function(entry) {
    const sheet = entry.sheet;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

    for (let i = data.length - 1; i >= 0; i--) {
      const row = data[i];

      if (normalizeRole(payload.role) === 'USER') {
        const creatorId = String(row[13] || "").trim();
        if (creatorId !== String(payload.employeeId).trim()) {
          continue;
        }
      }

      if (payload.status && payload.status !== "ทั้งหมด") {
        if (row[9] !== payload.status) {
          continue;
        }
      }

      totalCount++;
      if (skipped < offset) {
        skipped++;
        continue;
      }
      if (parcels.length >= limit) {
        hasMore = true;
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
    }
  });

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
  const storage = getParcelStorageByTrackingId(payload.trackingID);
  if (!storage) {
    return createJsonResponse({ success: false, error: "Not found" });
  }
  const sheet = storage.sheet;
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
  if (!hasAnyRole(payload, ['ADMIN', 'MESSENGER'])) {
    return createJsonResponse({ success: false, error: "Forbidden" });
  }
  let total = 0, pending = 0, transit = 0, delivered = 0;

  getParcelSheetsForRead().forEach(function(entry) {
    const data = entry.sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const status = data[i][9];
      total++;
      if (status === "รอจัดส่ง") pending++;
      else if (status === "กำลังจัดส่ง") transit++;
      else if (status === "ส่งถึงแล้ว") delivered++;
    }
  });

  return createJsonResponse({
    success: true,
    summary: { total, pending, transit, delivered }
  });
}

function handleConfirmReceipt(payload) {
  if (!hasAnyRole(payload, ['ADMIN', 'MESSENGER'])) {
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
  const storage = getParcelStorageByTrackingId(payload.trackingID);
  if (!storage) {
    return createJsonResponse({ success: false, error: "Tracking ID not found" });
  }
  const sheet = storage.sheet;
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
          const eventSheet = getEventSheetForSpreadsheet(storage.spreadsheet);
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

  const parcels = [];

  const sheets = getParcelSheetsForRead();
  for (let s = 0; s < sheets.length && parcels.length < 50; s++) {
    const sheet = sheets[s].sheet;
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) continue;
    const headers = data[0];

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
      const role = normalizeRole(data[i][3] || "USER");
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

  // Auto-create new user if not found (can set role to USER)
  // For security, you might want to restrict this in production.
  sheet.appendRow([employeeId, "Unknown", "Unknown", "USER", "", new Date()]);
  return createJsonResponse({ success: true, needsSetup: true, role: "USER", name: "Unknown", branch: "Unknown" });
}

function handleSetupPin(payload) {
  const employeeId = String(payload.employeeId || "").trim();
  const pin = String(payload.pin || "").trim();
  const name = String(payload.name || "").trim();
  const branch = String(payload.branch || "").trim();

  if (!employeeId || !pin) return createJsonResponse({ success: false, error: "Missing required fields" });
  if (pin.length < 4) return createJsonResponse({ success: false, error: "Password must be at least 4 characters" });

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
      
      const role = normalizeRole(data[i][3] || "USER");
      const finalName = name || String(data[i][1]).trim();
      const finalBranch = branch || String(data[i][2]).trim();

      const token = generateToken(employeeId, role, getApiKey());
      return createJsonResponse({ success: true, user: { employeeId, name: finalName, branch: finalBranch, role, token } });
    }
  }
  return createJsonResponse({ success: false, error: "User not found" });
}

function handleGetUsers(payload) {
  if (normalizeRole(payload.role) !== 'ADMIN') {
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
      role: normalizeRole(row[3] || "USER"),
      hasPin: !!String(row[4]).trim(),
      createdAt: row[5] ? Utilities.formatDate(new Date(row[5]), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : ""
    });
  }
  return createJsonResponse({ success: true, users: users });
}

function handleUpdateUserRole(payload) {
  if (normalizeRole(payload.role) !== 'ADMIN') {
    return createJsonResponse({ success: false, error: "Forbidden: Admins only" });
  }

  const targetId = String(payload.targetId || "").trim();
  const newRole = normalizeRole(payload.newRole);
  if (!targetId || !newRole) return createJsonResponse({ success: false, error: "Missing fields" });
  if (VALID_ROLES.indexOf(newRole) === -1) {
    return createJsonResponse({ success: false, error: "Invalid role" });
  }
  if (targetId === String(payload.employeeId || "").trim() && newRole !== 'ADMIN') {
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
  if (normalizeRole(payload.role) !== 'ADMIN') {
    return createJsonResponse({ success: false, error: "Forbidden: Admins only" });
  }

  const trackingID = String(payload.trackingID || "").trim();
  if (!trackingID) return createJsonResponse({ success: false, error: "Missing trackingID" });
  if (!validateTrackingID(trackingID)) return createJsonResponse({ success: false, error: "Invalid trackingID format" });

  const storage = getParcelStorageByTrackingId(trackingID);
  if (!storage) return createJsonResponse({ success: false, error: "Parcel not found" });
  const sheet = storage.sheet;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === trackingID) {
      sheet.deleteRow(i + 1);
      const eventSheet = getEventSheetForSpreadsheet(storage.spreadsheet);
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
  if (normalizeRole(payload.role) !== 'ADMIN') {
    return createJsonResponse({ success: false, error: "Forbidden: Admins only" });
  }

  const { trackingID, updates } = payload;
  if (!trackingID || !updates) return createJsonResponse({ success: false, error: "Missing fields" });
  if (!validateTrackingID(trackingID)) return createJsonResponse({ success: false, error: "Invalid trackingID format" });

  const storage = getParcelStorageByTrackingId(trackingID);
  if (!storage) return createJsonResponse({ success: false, error: "Parcel not found" });
  const sheet = storage.sheet;
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
