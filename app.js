// Configuration (bilingual, per-item checklists, per-item photos)
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

const STORAGE_KEY = "sanitary_inspections_per_item_photos_v1";

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

// DOM elements
const tabButtons = document.querySelectorAll(".tab-button");
const tabContents = document.querySelectorAll(".tab-content");
const onlineStatusEl = document.getElementById("onlineStatus");
const onlineTextEl = document.getElementById("onlineText");

const washroomSelect = document.getElementById("washroomSelect");
const washroomInfo = document.getElementById("washroomInfo");
const inspectorInput = document.getElementById("inspectorInput");
const notesInput = document.getElementById("notesInput");
const dynamicChecklist = document.getElementById("dynamicChecklist");
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

// Build dynamic checklist per item, with per-item photos
function buildDynamicChecklist() {
  const washroomId = washroomSelect.value;
  const w = CONFIG.washrooms.find(x => x.id === washroomId);
  if (!w) {
    washroomInfo.textContent = "";
    dynamicChecklist.innerHTML = "";
    return;
  }

  washroomInfo.textContent = `Cabines / Stalls: ${w.numStalls} • Lavabos / Sinks: ${w.numSinks} • Urinoirs / Urinals: ${w.numUrinals}`;

  const stallTasks = CONFIG.checklistItems.filter(i => i.appliesTo === "Cabine / Stall");
  const sinkTasks = CONFIG.checklistItems.filter(i => i.appliesTo === "Lavabo / Sink");
  const urinalTasks = CONFIG.checklistItems.filter(i => i.appliesTo === "Urinoir / Urinal");
  const generalTasks = CONFIG.checklistItems.filter(i => i.appliesTo === "Général / General" || i.appliesTo === "Tous / All");

  dynamicChecklist.innerHTML = "";

  function createFixtureGroup(type, index, tasks) {
    const group = document.createElement("div");
    group.className = "fixture-group";
    group.dataset.type = type;
    group.dataset.index = String(index);
    const header = document.createElement("div");
    header.className = "fixture-group-header";
    const labelType =
      type === "stall" ? "Cabine / Stall" :
      type === "sink" ? "Lavabo / Sink" :
      type === "urinal" ? "Urinoir / Urinal" :
      "Général / General";
    header.textContent = `${labelType}${index ? " #" + index : ""}`;
    group.appendChild(header);

    tasks.forEach(task => {
      const div = document.createElement("div");
      div.className = "checklist-item";
      const id = `${type}-${index || 0}-${task.id}`;
      div.innerHTML = `
        <input type="checkbox" class="fixture-checkbox" id="${id}"
               data-type="${type}" data-index="${index || 0}" data-task-id="${task.id}">
        <label for="${id}">${task.fr} / ${task.en}</label>
      `;
      group.appendChild(div);
    });

    // Photos row (before/after) for this fixture
    const photosRow = document.createElement("div");
    photosRow.className = "photos-row";

    const beforeCol = document.createElement("div");
    beforeCol.className = "col";
    const beforeLabel = document.createElement("div");
    beforeLabel.className = "fixture-photo-label";
    beforeLabel.textContent = "Photo avant / Before";
    const beforeInput = document.createElement("input");
    beforeInput.type = "file";
    beforeInput.accept = "image/*";
    beforeInput.capture = "environment"; // hint to use camera on iPad
    beforeInput.className = "fixture-photo-input fixture-photo-before";
    beforeInput.id = `${type}-${index || 0}-before`;
    beforeInput.dataset.type = type;
    beforeInput.dataset.index = String(index || 0);
    beforeCol.appendChild(beforeLabel);
    beforeCol.appendChild(beforeInput);

    const afterCol = document.createElement("div");
    afterCol.className = "col";
    const afterLabel = document.createElement("div");
    afterLabel.className = "fixture-photo-label";
    afterLabel.textContent = "Photo après / After";
    const afterInput = document.createElement("input");
    afterInput.type = "file";
    afterInput.accept = "image/*";
    afterInput.capture = "environment"; // hint to use camera on iPad
    afterInput.className = "fixture-photo-input fixture-photo-after";
    afterInput.id = `${type}-${index || 0}-after`;
    afterInput.dataset.type = type;
    afterInput.dataset.index = String(index || 0);
    afterCol.appendChild(afterLabel);
    afterCol.appendChild(afterInput);

    photosRow.appendChild(beforeCol);
    photosRow.appendChild(afterCol);
    group.appendChild(photosRow);

    return group;
  }

  // Stalls
  if (w.numStalls > 0 && stallTasks.length) {
    const title = document.createElement("div");
    title.className = "fixture-section-title";
    title.textContent = "Cabines / Stalls";
    dynamicChecklist.appendChild(title);
    for (let i = 1; i <= w.numStalls; i++) {
      dynamicChecklist.appendChild(createFixtureGroup("stall", i, stallTasks));
    }
  }

  // Sinks
  if (w.numSinks > 0 && sinkTasks.length) {
    const title = document.createElement("div");
    title.className = "fixture-section-title";
    title.textContent = "Lavabos / Sinks";
    dynamicChecklist.appendChild(title);
    for (let i = 1; i <= w.numSinks; i++) {
      dynamicChecklist.appendChild(createFixtureGroup("sink", i, sinkTasks));
    }
  }

  // Urinals
  if (w.numUrinals > 0 && urinalTasks.length) {
    const title = document.createElement("div");
    title.className = "fixture-section-title";
    title.textContent = "Urinoirs / Urinals";
    dynamicChecklist.appendChild(title);
    for (let i = 1; i <= w.numUrinals; i++) {
      dynamicChecklist.appendChild(createFixtureGroup("urinal", i, urinalTasks));
    }
  }

  // General
  if (generalTasks.length) {
    const title = document.createElement("div");
    title.className = "fixture-section-title";
    title.textContent = "Général / General";
    dynamicChecklist.appendChild(title);
    dynamicChecklist.appendChild(createFixtureGroup("general", 0, generalTasks));
  }
}

washroomSelect.addEventListener("change", buildDynamicChecklist);
buildDynamicChecklist();

// Save inspection with validation: all components required
saveInspectionBtn.addEventListener("click", async () => {
  const inspector = inspectorInput.value.trim();
  const washroomId = washroomSelect.value;
  const notes = notesInput.value.trim();

  if (!washroomId) {
    saveMessage.textContent = "Veuillez choisir une toilette. / Please select a washroom.";
    return;
  }
  if (!inspector) {
    saveMessage.textContent = "Veuillez entrer le nom de l’inspecteur. / Please enter the inspector name.";
    return;
  }

  const w = CONFIG.washrooms.find(x => x.id === washroomId);
  if (!w) {
    saveMessage.textContent = "Toilette invalide. / Invalid washroom.";
    return;
  }

  const stallTasks = CONFIG.checklistItems.filter(i => i.appliesTo === "Cabine / Stall");
  const sinkTasks = CONFIG.checklistItems.filter(i => i.appliesTo === "Lavabo / Sink");
  const urinalTasks = CONFIG.checklistItems.filter(i => i.appliesTo === "Urinoir / Urinal");
  const generalTasks = CONFIG.checklistItems.filter(i => i.appliesTo === "Général / General" || i.appliesTo === "Tous / All");

  const checkboxes = Array.from(document.querySelectorAll(".fixture-checkbox"));

  function getChecked(type, index) {
    return checkboxes
      .filter(cb => cb.dataset.type === type && String(cb.dataset.index) == String(index) && cb.checked)
      .map(cb => cb.dataset.taskId);
  }

  // Validate stalls
  for (let i = 1; i <= w.numStalls; i++) {
    const checked = getChecked("stall", i);
    if (checked.length < stallTasks.length) {
      saveMessage.textContent = `Toutes les tâches doivent être cochées pour la cabine #${i}. / All tasks must be checked for stall #${i}.`;
      return;
    }
  }

  // Validate sinks
  for (let i = 1; i <= w.numSinks; i++) {
    const checked = getChecked("sink", i);
    if (checked.length < sinkTasks.length) {
      saveMessage.textContent = `Toutes les tâches doivent être cochées pour le lavabo #${i}. / All tasks must be checked for sink #${i}.`;
      return;
    }
  }

  // Validate urinals
  for (let i = 1; i <= w.numUrinals; i++) {
    const checked = getChecked("urinal", i);
    if (checked.length < urinalTasks.length) {
      saveMessage.textContent = `Toutes les tâches doivent être cochées pour l’urinoir #${i}. / All tasks must be checked for urinal #${i}.`;
      return;
    }
  }

  // Validate general
  const generalChecked = getChecked("general", 0);
  if (generalTasks.length && generalChecked.length < generalTasks.length) {
    saveMessage.textContent = "Toutes les tâches générales doivent être cochées. / All general tasks must be checked.";
    return;
  }

  // Collect photos per fixture
  async function getPhotosFor(type, index) {
    const beforeInput = document.getElementById(`${type}-${index}-before`);
    const afterInput = document.getElementById(`${type}-${index}-after`);
    const beforeFile = beforeInput && beforeInput.files[0] ? beforeInput.files[0] : null;
    const afterFile = afterInput && afterInput.files[0] ? afterInput.files[0] : null;
    const [beforeBase64, afterBase64] = await Promise.all([
      base64FromFile(beforeFile),
      base64FromFile(afterFile),
    ]);
    return { beforePhoto: beforeBase64, afterPhoto: afterBase64 };
  }

  const stalls = [];
  for (let i = 1; i <= w.numStalls; i++) {
    const photos = await getPhotosFor("stall", i);
    stalls.push({
      index: i,
      completedTaskIds: getChecked("stall", i),
      beforePhoto: photos.beforePhoto,
      afterPhoto: photos.afterPhoto,
    });
  }

  const sinks = [];
  for (let i = 1; i <= w.numSinks; i++) {
    const photos = await getPhotosFor("sink", i);
    sinks.push({
      index: i,
      completedTaskIds: getChecked("sink", i),
      beforePhoto: photos.beforePhoto,
      afterPhoto: photos.afterPhoto,
    });
  }

  const urinals = [];
  for (let i = 1; i <= w.numUrinals; i++) {
    const photos = await getPhotosFor("urinal", i);
    urinals.push({
      index: i,
      completedTaskIds: getChecked("urinal", i),
      beforePhoto: photos.beforePhoto,
      afterPhoto: photos.afterPhoto,
    });
  }

  const generalPhotos = await getPhotosFor("general", 0);

  const inspection = {
    id: "I_" + Date.now(),
    dateTime: new Date().toISOString(),
    inspector,
    washroomId,
    stalls,
    sinks,
    urinals,
    generalTasks: generalChecked,
    generalBeforePhoto: generalPhotos.beforePhoto,
    generalAfterPhoto: generalPhotos.afterPhoto,
    notes,
  };

  const list = loadInspections();
  list.push(inspection);
  saveInspections(list);

  saveMessage.textContent = "Inspection enregistrée localement. / Inspection saved locally.";
  setTimeout(() => (saveMessage.textContent = ""), 3000);

  // Reset fields
  notesInput.value = "";
  document.querySelectorAll(".fixture-checkbox").forEach(cb => (cb.checked = false));
  document.querySelectorAll(".fixture-photo-input").forEach(inp => (inp.value = ""));
});

// Render inspections list
function renderInspectionsList() {
  const list = loadInspections();
  inspectionsSummary.textContent = `${list.length} inspection(s) enregistrée(s) sur cet appareil. / ${list.length} inspection(s) saved on this device.`;

  inspectionsList.innerHTML = "";
  const sorted = [...list].sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
  sorted.forEach(item => {
    const w = CONFIG.washrooms.find(x => x.id === item.washroomId);
    const washroomName = w ? w.name : item.washroomId;
    const dt = new Date(item.dateTime);

    const stallCount = item.stalls ? item.stalls.length : 0;
    const sinkCount = item.sinks ? item.sinks.length : 0;
    const urinalCount = item.urinals ? item.urinals.length : 0;
    const generalCount = item.generalTasks ? item.generalTasks.length : 0;

    const div = document.createElement("div");
    div.className = "inspection-item";
    div.innerHTML = `
      <strong>${formatDateTime(dt)} – ${washroomName}</strong>
      <div>Inspecteur / Inspector : ${item.inspector}</div>
      <div>Cabines / Stalls inspectées : ${stallCount}</div>
      <div>Lavabos / Sinks inspectés : ${sinkCount}</div>
      <div>Urinoirs / Urinals inspectés : ${urinalCount}</div>
      <div>Tâches générales complétées : ${generalCount}</div>
      <div>Notes : ${item.notes || "Aucune / None"}</div>
    `;
    inspectionsList.appendChild(div);
  });
}

// PWA: register service worker if available
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .catch(err => console.log("SW registration failed", err));
  });
}
