// Configuration (bilingual, same as before)
const CONFIG = {
  washrooms: [
    { id: "W001", name: "Toilette employé", location: "Bâtiment principal", numStalls: 1, numSinks: 1, numUrinals: 0 },
    { id: "W002", name: "Chalet homme", location: "Chalet", numStalls: 1, numSinks: 1, numUrinals: 1 },
    { id: "W003", name: "Chalet femme", location: "Chalet", numStalls: 1, numSinks: 1, numUrinals: 0 },
    { id: "W004", name: "Érablière homme", location: "Érablière", numStalls: 1, numSinks: 1, numUrinals: 1 },
    { id: "W005", name: "Érablière femme", location: "Érablière", numStalls: 3, numSinks: 2, numUrinals: 0 },
  ],
  checklistItems: [
    { id: "C001", fr: "Bol et siège de toilette nettoyés", en: "Toilet bowl and seat cleaned", appliesTo: "Cabine / Stall" },
    { id: "C002", fr: "Base de la toilette et plancher autour propres et secs", en: "Toilet base and surrounding floor clean and dry", appliesTo: "Cabine / Stall" },
    { id: "C003", fr: "Papier hygiénique disponible", en: "Toilet paper stocked", appliesTo: "Cabine / Stall" },
    { id: "C004", fr: "Chasse d’eau fonctionnelle", en: "Flush working properly", appliesTo: "Cabine / Stall" },
    { id: "C005", fr: "Lavabo et robinet nettoyés", en: "Sink and faucet cleaned", appliesTo: "Lavabo / Sink" },
    { id: "C006", fr: "Savon à main disponible", en: "Hand soap available", appliesTo: "Lavabo / Sink" },
    { id: "C007", fr: "Essuie-mains / papier en quantité suffisante", en: "Hand towels / paper stocked", appliesTo: "Lavabo / Sink" },
    { id: "C008", fr: "Miroir propre, sans taches", en: "Mirror clean, no spots", appliesTo: "Lavabo / Sink" },
    { id: "C009", fr: "Urinoir nettoyé", en: "Urinal cleaned", appliesTo: "Urinoir / Urinal" },
    { id: "C010", fr: "Bloc ou écran d’urinoir en place", en: "Urinal block/screen in place", appliesTo: "Urinoir / Urinal" },
    { id: "C011", fr: "Plancher propre et sécuritaire (sans flaques ni débris)", en: "Floor clean and safe (no puddles or debris)", appliesTo: "Général / General" },
    { id: "C012", fr: "Poubelles vidées, sac changé au besoin", en: "Trash emptied, bag replaced as needed", appliesTo: "Général / General" },
    { id: "C013", fr: "Poignées de porte, surfaces de contact essuyées", en: "Door handles and touch surfaces wiped", appliesTo: "Général / General" },
    { id: "C014", fr: "Odeur acceptable", en: "Odor acceptable", appliesTo: "Général / General" },
    { id: "C015", fr: "Éclairage fonctionnel", en: "Lighting working", appliesTo: "Général / General" },
    { id: "C016", fr: "Rien de brisé ou dangereux", en: "Nothing broken or unsafe", appliesTo: "Général / General" },
    { id: "C017", fr: "Vérification visuelle générale satisfaisante", en: "Overall visual check satisfactory", appliesTo: "Tous / All" },
  ],
};

// Backend endpoint for automatic daily report sync (server you or IT will host)
const SYNC_ENDPOINT = "https://your-server.example.com/api/inspections"; // <- change this when you have a backend
const STORAGE_KEY = "sanitary_inspections_v2";
const LAST_SYNC_KEY = "sanitary_last_sync_v2";

function loadInspections() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error(e);
    return [];
  }
}

function saveInspections(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error(e);
  }
}

function setLastSyncDate(dateISO) {
  localStorage.setItem(LAST_SYNC_KEY, dateISO);
}

function getLastSyncDate() {
  return localStorage.getItem(LAST_SYNC_KEY);
}

// Utils
function formatDateTime(dt) {
  return dt.toLocaleString("fr-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTodayISO() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function base64FromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function filteredChecklist(areaType) {
  return CONFIG.checklistItems.filter(item =>
    item.appliesTo === "Tous / All" || item.appliesTo === areaType
  );
}

// DOM elements
const tabButtons = document.querySelectorAll(".tab-button");
const tabContents = document.querySelectorAll(".tab-content");
const onlineStatusEl = document.getElementById("onlineStatus");
const onlineTextEl = document.getElementById("onlineText");

const washroomSelect = document.getElementById("washroomSelect");
const areaTypeSelect = document.getElementById("areaTypeSelect");
const areaNumberInput = document.getElementById("areaNumberInput");
const inspectorInput = document.getElementById("inspectorInput");
const notesInput = document.getElementById("notesInput");
const beforePhotoInput = document.getElementById("beforePhotoInput");
const afterPhotoInput = document.getElementById("afterPhotoInput");
const checklistContainer = document.getElementById("checklistContainer");
const areaHint = document.getElementById("areaHint");
const saveInspectionBtn = document.getElementById("saveInspectionBtn");
const saveMessage = document.getElementById("saveMessage");

const inspectionsSummary = document.getElementById("inspectionsSummary");
const inspectionsList = document.getElementById("inspectionsList");

// Tabs
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    tabButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    tabContents.forEach(c => {
      c.classList.toggle("active", c.id === "tab-" + tab);
    });
    if (tab === "list") {
      renderInspectionsList();
    }
  });
});

// Online/offline
function updateOnlineStatus() {
  if (navigator.onLine) {
    onlineStatusEl.style.backgroundColor = "#16a34a";
    onlineTextEl.textContent = "En ligne / Online";
    attemptSync(); // try to sync when we come online
  } else {
    onlineStatusEl.style.backgroundColor = "#dc2626";
    onlineTextEl.textContent = "Hors ligne / Offline";
  }
}
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();

// Populate washrooms
function populateWashrooms() {
  washroomSelect.innerHTML = "";
  CONFIG.washrooms.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w.id;
    opt.textContent = `${w.name} (${w.location})`;
    washroomSelect.appendChild(opt);
  });
}
populateWashrooms();

// Checklist rendering
function renderChecklist() {
  const areaType = areaTypeSelect.value;
  const list = filteredChecklist(areaType);

  checklistContainer.innerHTML = "";
  list.forEach(item => {
    const div = document.createElement("div");
    div.className = "checklist-item";
    const id = "chk_" + item.id;
    div.innerHTML = `
      <input type="checkbox" id="${id}" data-id="${item.id}">
      <label for="${id}">${item.fr} / ${item.en}</label>
    `;
    checklistContainer.appendChild(div);
  });

  // Hint about max numbers
  const selectedId = washroomSelect.value;
  const w = CONFIG.washrooms.find(x => x.id === selectedId);
  if (!w) {
    areaHint.textContent = "";
    return;
  }
  if (areaType === "Cabine / Stall") {
    areaHint.textContent = `Max: ${w.numStalls} cabine(s) dans cette toilette. / Max: ${w.numStalls} stall(s) in this washroom.`;
  } else if (areaType === "Lavabo / Sink") {
    areaHint.textContent = `Max: ${w.numSinks} lavabo(s) dans cette toilette. / Max: ${w.numSinks} sink(s) in this washroom.`;
  } else if (areaType === "Urinoir / Urinal") {
    areaHint.textContent = `Max: ${w.numUrinals} urinoir(s) dans cette toilette. / Max: ${w.numUrinals} urinal(s) in this washroom.`;
  } else {
    areaHint.textContent = "Laissez le numéro vide pour une inspection générale. / Leave number blank for a general inspection.";
  }
}

areaTypeSelect.addEventListener("change", renderChecklist);
washroomSelect.addEventListener("change", renderChecklist);
renderChecklist();

// Validate area number
function areaNumberIsValid(areaType, washroomId, num) {
  if (!num || isNaN(num)) return true; // general / blank is ok
  const w = CONFIG.washrooms.find(x => x.id === washroomId);
  if (!w) return true;
  if (areaType === "Cabine / Stall") {
    return num >= 1 && num <= w.numStalls;
  } else if (areaType === "Lavabo / Sink") {
    return num >= 1 && num <= w.numSinks;
  } else if (areaType === "Urinoir / Urinal") {
    return num >= 1 && num <= w.numUrinals;
  }
  return true;
}

// Save inspection
saveInspectionBtn.addEventListener("click", async () => {
  const inspector = inspectorInput.value.trim();
  const washroomId = washroomSelect.value;
  const areaType = areaTypeSelect.value;
  const areaNumber = areaNumberInput.value ? parseInt(areaNumberInput.value, 10) : null;
  const notes = notesInput.value.trim();

  if (!washroomId) {
    saveMessage.textContent = "Veuillez choisir une toilette. / Please select a washroom.";
    return;
  }
  if (!inspector) {
    saveMessage.textContent = "Veuillez entrer le nom de l’inspecteur. / Please enter the inspector name.";
    return;
  }
  if (!areaNumberIsValid(areaType, washroomId, areaNumber)) {
    saveMessage.textContent = "Numéro invalide pour cette zone et toilette. / Invalid number for this area and washroom.";
    return;
  }

  const checkedItems = Array.from(checklistContainer.querySelectorAll("input[type='checkbox']"))
    .filter(chk => chk.checked)
    .map(chk => chk.dataset.id);

  const beforeFile = beforePhotoInput.files[0] || null;
  const afterFile = afterPhotoInput.files[0] || null;

  let beforeBase64 = null;
  let afterBase64 = null;
  try {
    [beforeBase64, afterBase64] = await Promise.all([
      base64FromFile(beforeFile),
      base64FromFile(afterFile),
    ]);
  } catch (e) {
    console.error(e);
  }

  const now = new Date();
  const inspection = {
    id: "I_" + now.getTime(),
    dateTime: now.toISOString(),
    inspector,
    washroomId,
    areaType,
    areaNumber,
    completedTaskIds: checkedItems,
    notes,
    beforePhoto: beforeBase64,
    afterPhoto: afterBase64,
    synced: false,
  };

  const list = loadInspections();
  list.push(inspection);
  saveInspections(list);

  saveMessage.textContent = "Inspection enregistrée localement. / Inspection saved locally.";
  setTimeout(() => (saveMessage.textContent = ""), 3000);

  // Reset some fields
  notesInput.value = "";
  beforePhotoInput.value = "";
  afterPhotoInput.value = "";
  checklistContainer.querySelectorAll("input[type='checkbox']").forEach(chk => (chk.checked = false));

  // Try sync in background if possible
  attemptSync();
});

// Render inspections list
function renderInspectionsList() {
  const list = loadInspections();
  const today = getTodayISO();
  const todays = list.filter(i => i.dateTime.slice(0, 10) === today);
  inspectionsSummary.textContent = `${todays.length} inspection(s) aujourd’hui. / ${todays.length} inspection(s) today.`;

  inspectionsList.innerHTML = "";
  const sorted = [...list].sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
  sorted.forEach(item => {
    const w = CONFIG.washrooms.find(x => x.id === item.washroomId);
    const washroomName = w ? w.name : item.washroomId;
    const dt = new Date(item.dateTime);
    const tasks = item.completedTaskIds
      .map(id => {
        const t = CONFIG.checklistItems.find(x => x.id === id);
        return t ? `${t.fr} / ${t.en}` : id;
      })
      .join(", ");
    const div = document.createElement("div");
    div.className = "inspection-item";
    div.innerHTML = `
      <strong>${formatDateTime(dt)} – ${washroomName}</strong>
      <div>Zone / Area : ${item.areaType}${item.areaNumber ? " #" + item.areaNumber : ""}</div>
      <div>Inspecteur / Inspector : ${item.inspector}</div>
      <div>Tâches / Tasks : ${tasks || "Aucune / None"}</div>
      <div>Notes : ${item.notes || "Aucune / None"}</div>
    `;
    inspectionsList.appendChild(div);
  });
}

// Automatic sync logic (for backend daily report)
async function attemptSync() {
  // If no real endpoint configured, do nothing
  if (!SYNC_ENDPOINT || SYNC_ENDPOINT.includes("your-server.example.com")) {
    return;
  }
  if (!navigator.onLine) return;

  const today = getTodayISO();
  const lastSync = getLastSyncDate();
  // Only one sync per day from this device
  if (lastSync === today) return;

  const list = loadInspections();
  const unsynced = list.filter(i => !i.synced);

  if (!unsynced.length) {
    setLastSyncDate(today);
    return;
  }

  try {
    const payload = {
      deviceId: "ipad-" + (navigator.userAgent || "").slice(0, 40),
      syncedAt: new Date().toISOString(),
      inspections: unsynced,
    };
    const resp = await fetch(SYNC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      // Mark them as synced locally
      const updated = list.map(i =>
        unsynced.some(u => u.id === i.id) ? { ...i, synced: true } : i
      );
      saveInspections(updated);
      setLastSyncDate(today);
    } else {
      console.error("Sync failed with status", resp.status);
    }
  } catch (err) {
    console.error("Sync error", err);
  }
}

// Try sync shortly after load
window.addEventListener("load", () => {
  attemptSync();
});

// PWA: register service worker if available
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .catch(err => console.log("SW registration failed", err));
  });
}
