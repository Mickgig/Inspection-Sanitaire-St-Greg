// Configuration (FR only)
const CONFIG = {
  washrooms: [
    { id: "W001", name: "Toilette employé", location: "Bâtiment principal", numStalls: 1, numSinks: 1, numUrinals: 0 },
    { id: "W002", name: "Chalet homme", location: "Chalet", numStalls: 1, numSinks: 1, numUrinals: 1 },
    { id: "W003", name: "Chalet femme", location: "Chalet", numStalls: 1, numSinks: 1, numUrinals: 0 },
    { id: "W004", name: "Érablière homme", location: "Érablière", numStalls: 1, numSinks: 1, numUrinals: 1 },
    { id: "W005", name: "Érablière femme", location: "Érablière", numStalls: 3, numSinks: 2, numUrinals: 0 },
  ],
  checklistItems: [
    { id: "C001", label: "Bol et siège de toilette nettoyés", appliesTo: "Cabine / Stall" },
    { id: "C002", label: "Base de la toilette et plancher autour propres et secs", appliesTo: "Cabine / Stall" },
    { id: "C003", label: "Papier hygiénique disponible", appliesTo: "Cabine / Stall" },
    { id: "C004", label: "Chasse d’eau fonctionnelle", appliesTo: "Cabine / Stall" },
    { id: "C005", label: "Lavabo et robinet nettoyés", appliesTo: "Lavabo / Sink" },
    { id: "C006", label: "Savon à main disponible", appliesTo: "Lavabo / Sink" },
    { id: "C007", label: "Essuie-mains / papier en quantité suffisante", appliesTo: "Lavabo / Sink" },
    { id: "C008", label: "Miroir propre, sans taches", appliesTo: "Lavabo / Sink" },
    { id: "C009", label: "Urinoir nettoyé", appliesTo: "Urinoir / Urinal" },
    { id: "C010", label: "Bloc ou écran d’urinoir en place", appliesTo: "Urinoir / Urinal" },
    { id: "C011", label: "Plancher propre et sécuritaire (sans flaques ni débris)", appliesTo: "Général / General" },
    { id: "C012", label: "Poubelles vidées, sac changé au besoin", appliesTo: "Général / General" },
    { id: "C013", label: "Poignées de porte et surfaces de contact essuyées", appliesTo: "Général / General" },
    { id: "C014", label: "Odeur acceptable", appliesTo: "Général / General" },
    { id: "C015", label: "Éclairage fonctionnel", appliesTo: "Général / General" },
    { id: "C016", label: "Rien de brisé ou dangereux", appliesTo: "Général / General" },
    { id: "C017", label: "Inspection visuelle générale satisfaisante", appliesTo: "Tous / All" },
  ],
};

const STORAGE_KEY = "sanitary_inspections_arbraska_v2";
const SYNC_QUEUE_KEY = "sanitary_inspections_sync_queue_v2";

// Put your Azure Function URL here later
const BACKEND_URL = "PASTE_YOUR_BACKEND_URL_HERE";

let currentInspectionStart = null;

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

function loadSyncQueue() {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error(e);
    return [];
  }
}

function saveSyncQueue(queue) {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error(e);
  }
}

function queueForSync(item) {
  const queue = loadSyncQueue();
  queue.push(item);
  saveSyncQueue(queue);
}

async function trySyncQueue() {
  if (!navigator.onLine) return;
  if (!BACKEND_URL || BACKEND_URL === "PASTE_YOUR_BACKEND_URL_HERE") return;

  const queue = loadSyncQueue();
  if (!queue.length) return;

  const remaining = [];
  for (const item of queue) {
    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
    } catch (err) {
      console.error("Sync failed for", item.id, err);
      remaining.push(item);
    }
  }
  saveSyncQueue(remaining);
}

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

// DOM refs
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
const supervisorStats = document.getElementById("supervisorStats");
const supervisorCharts = document.getElementById("supervisorCharts");

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
    } else if (tab === "supervisor") {
      renderSupervisorView();
    }
  });
});

// Online / offline
function updateOnlineStatus() {
  if (navigator.onLine) {
    onlineStatusEl.style.backgroundColor = "#22c55e";
    onlineTextEl.textContent = "En ligne";
  } else {
    onlineStatusEl.style.backgroundColor = "#f97316";
    onlineTextEl.textContent = "Hors ligne (données sur l’iPad)";
  }
}

window.addEventListener("online", () => {
  updateOnlineStatus();
  trySyncQueue();
});
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();

// Washrooms
function populateWashrooms() {
  washroomSelect.innerHTML = "";
  CONFIG.washrooms.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w.id;
    opt.textContent = `${w.name} – ${w.location}`;
    washroomSelect.appendChild(opt);
  });
}
populateWashrooms();

// Dynamic checklist
function buildDynamicChecklist() {
  currentInspectionStart = new Date().toISOString();

  const washroomId = washroomSelect.value;
  const w = CONFIG.washrooms.find(x => x.id === washroomId);
  if (!w) {
    washroomInfo.textContent = "";
    dynamicChecklist.innerHTML = "";
    return;
  }

  washroomInfo.textContent = `Cabines : ${w.numStalls} • Lavabos : ${w.numSinks} • Urinoirs : ${w.numUrinals}`;

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
      type === "stall" ? "Cabine" :
      type === "sink" ? "Lavabo" :
      type === "urinal" ? "Urinoir" :
      "Général";
    header.textContent = index ? `${labelType} #${index}` : labelType;
    group.appendChild(header);

    tasks.forEach(task => {
      const div = document.createElement("div");
      div.className = "checklist-item";
      const id = `${type}-${index || 0}-${task.id}`;
      div.innerHTML = `
        <input type="checkbox" class="fixture-checkbox" id="${id}"
               data-type="${type}" data-index="${index || 0}" data-task-id="${task.id}">
        <label for="${id}">${task.label}</label>
      `;
      group.appendChild(div);
    });

    const photosRow = document.createElement("div");
    photosRow.className = "photos-row";

    const beforeCol = document.createElement("div");
    beforeCol.className = "col";
    const beforeLabel = document.createElement("div");
    beforeLabel.className = "fixture-photo-label";
    beforeLabel.textContent = "Photo avant";
    const beforeInput = document.createElement("input");
    beforeInput.type = "file";
    beforeInput.accept = "image/*";
    beforeInput.capture = "environment";
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
    afterLabel.textContent = "Photo après";
    const afterInput = document.createElement("input");
    afterInput.type = "file";
    afterInput.accept = "image/*";
    afterInput.capture = "environment";
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

  // Sections
  if (w.numStalls > 0 && stallTasks.length) {
    const title = document.createElement("div");
    title.className = "fixture-section-title";
    title.textContent = "Cabines";
    dynamicChecklist.appendChild(title);
    for (let i = 1; i <= w.numStalls; i++) {
      dynamicChecklist.appendChild(createFixtureGroup("stall", i, stallTasks));
    }
  }

  if (w.numSinks > 0 && sinkTasks.length) {
    const title = document.createElement("div");
    title.className = "fixture-section-title";
    title.textContent = "Lavabos";
    dynamicChecklist.appendChild(title);
    for (let i = 1; i <= w.numSinks; i++) {
      dynamicChecklist.appendChild(createFixtureGroup("sink", i, sinkTasks));
    }
  }

  if (w.numUrinals > 0 && urinalTasks.length) {
    const title = document.createElement("div");
    title.className = "fixture-section-title";
    title.textContent = "Urinoirs";
    dynamicChecklist.appendChild(title);
    for (let i = 1; i <= w.numUrinals; i++) {
      dynamicChecklist.appendChild(createFixtureGroup("urinal", i, urinalTasks));
    }
  }

  if (generalTasks.length) {
    const title = document.createElement("div");
    title.className = "fixture-section-title";
    title.textContent = "Général";
    dynamicChecklist.appendChild(title);
    dynamicChecklist.appendChild(createFixtureGroup("general", 0, generalTasks));
  }
}

washroomSelect.addEventListener("change", buildDynamicChecklist);
buildDynamicChecklist();

// Save
saveInspectionBtn.addEventListener("click", async () => {
  const inspector = inspectorInput.value.trim();
  const washroomId = washroomSelect.value;
  const notes = notesInput.value.trim();

  if (!washroomId) {
    saveMessage.textContent = "Veuillez choisir une toilette.";
    return;
  }
  if (!inspector) {
    saveMessage.textContent = "Veuillez entrer le nom complet de l’inspecteur.";
    return;
  }

  const w = CONFIG.washrooms.find(x => x.id === washroomId);
  if (!w) {
    saveMessage.textContent = "Toilette invalide.";
    return;
  }

  const stallTasks = CONFIG.checklistItems.filter(i => i.appliesTo === "Cabine / Stall");
  const sinkTasks = CONFIG.checklistItems.filter(i => i.appliesTo === "Lavabo / Sink");
  const urinalTasks = CONFIG.checklistItems.filter(i => i.appliesTo === "Urinoir / Urinal");
  const generalTasks = CONFIG.checklistItems.filter(i => i.appliesTo === "Général / General" || i.appliesTo === "Tous / All");

  const checkboxes = Array.from(document.querySelectorAll(".fixture-checkbox"));

  function getChecked(type, index) {
    return checkboxes
      .filter(cb => cb.dataset.type === type && String(cb.dataset.index) === String(index) && cb.checked)
      .map(cb => cb.dataset.taskId);
  }

  // Validate
  for (let i = 1; i <= w.numStalls; i++) {
    const checked = getChecked("stall", i);
    if (checked.length < stallTasks.length) {
      saveMessage.textContent = `Toutes les tâches doivent être cochées pour la cabine #${i}.`;
      return;
    }
  }

  for (let i = 1; i <= w.numSinks; i++) {
    const checked = getChecked("sink", i);
    if (checked.length < sinkTasks.length) {
      saveMessage.textContent = `Toutes les tâches doivent être cochées pour le lavabo #${i}.`;
      return;
    }
  }

  for (let i = 1; i <= w.numUrinals; i++) {
    const checked = getChecked("urinal", i);
    if (checked.length < urinalTasks.length) {
      saveMessage.textContent = `Toutes les tâches doivent être cochées pour l’urinoir #${i}.`;
      return;
    }
  }

  const generalChecked = getChecked("general", 0);
  if (generalTasks.length && generalChecked.length < generalTasks.length) {
    saveMessage.textContent = "Toutes les tâches générales doivent être cochées.";
    return;
  }

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

  const endTime = new Date();
  const startTime = currentInspectionStart ? new Date(currentInspectionStart) : endTime;
  const durationMs = endTime - startTime;
  const durationSeconds = Math.round(durationMs / 1000);

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
    dateTime: endTime.toISOString(),
    inspector,
    washroomId,
    stalls,
    sinks,
    urinals,
    generalTasks: generalChecked,
    generalBeforePhoto: generalPhotos.beforePhoto,
    generalAfterPhoto: generalPhotos.afterPhoto,
    notes,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    durationSeconds,
  };

  const photosForServer = [];

  stalls.forEach(s => {
    photosForServer.push({
      fixtureType: "Cabine",
      fixtureIndex: s.index,
      beforePhoto: s.beforePhoto,
      afterPhoto: s.afterPhoto,
    });
  });

  sinks.forEach(s => {
    photosForServer.push({
      fixtureType: "Lavabo",
      fixtureIndex: s.index,
      beforePhoto: s.beforePhoto,
      afterPhoto: s.afterPhoto,
    });
  });

  urinals.forEach(u => {
    photosForServer.push({
      fixtureType: "Urinoir",
      fixtureIndex: u.index,
      beforePhoto: u.beforePhoto,
      afterPhoto: u.afterPhoto,
    });
  });

  photosForServer.push({
    fixtureType: "General",
    fixtureIndex: 0,
    beforePhoto: generalPhotos.beforePhoto,
    afterPhoto: generalPhotos.afterPhoto,
  });

  const summaryForServer = {
    id: inspection.id,
    dateTime: inspection.dateTime,
    inspector,
    washroomId,
    washroomName: w ? w.name : washroomId,
    stallsCount: stalls.length,
    sinksCount: sinks.length,
    urinalsCount: urinals.length,
    notes,
    startTime: inspection.startTime,
    endTime: inspection.endTime,
    durationSeconds: inspection.durationSeconds,
    photos: photosForServer,
  };

  queueForSync(summaryForServer);
  trySyncQueue();

  const list = loadInspections();
  list.push(inspection);
  saveInspections(list);

  saveMessage.textContent = "Inspection enregistrée sur cet appareil.";
  setTimeout(() => (saveMessage.textContent = ""), 3000);

  notesInput.value = "";
  document.querySelectorAll(".fixture-checkbox").forEach(cb => (cb.checked = false));
  document.querySelectorAll(".fixture-photo-input").forEach(inp => (inp.value = ""));
});

// History
function renderInspectionsList() {
  const list = loadInspections();
  inspectionsSummary.textContent = `${list.length} inspection(s) enregistrée(s) sur cet iPad.`;

  inspectionsList.innerHTML = "";
  const sorted = [...list].sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
  sorted.forEach(item => {
    const w = CONFIG.washrooms.find(x => x.id === item.washroomId);
    const washroomName = w ? w.name : item.washroomId;
    const dt = new Date(item.dateTime);

    const stallCount = item.stalls ? item.stalls.length : 0;
    const sinkCount = item.sinks ? item.sinks.length : 0;
    const urinalCount = item.urinals ? item.urinals.length : 0;
    const durationMin = item.durationSeconds ? Math.round(item.durationSeconds / 60) : null;

    const div = document.createElement("div");
    div.className = "inspection-item";
    div.innerHTML = `
      <strong>${formatDateTime(dt)} – ${washroomName}</strong>
      <div>Inspecteur : ${item.inspector}</div>
      <div>Cabines inspectées : ${stallCount}</div>
      <div>Lavabos inspectés : ${sinkCount}</div>
      <div>Urinoirs inspectés : ${urinalCount}</div>
      <div>Durée : ${durationMin !== null ? durationMin + " min" : "N/D"}</div>
      <div>Commentaires : ${item.notes || "Aucun"}</div>
    `;
    inspectionsList.appendChild(div);
  });
}

// Supervisor view
function renderSupervisorView() {
  const list = loadInspections();
  supervisorCharts.innerHTML = "";

  if (!list.length) {
    supervisorStats.textContent = "Aucune inspection enregistrée sur cet appareil.";
    return;
  }

  const byWashroom = {};
  let totalDuration = 0;
  let durationCount = 0;

  list.forEach(i => {
    const w = CONFIG.washrooms.find(x => x.id === i.washroomId);
    const name = w ? w.name : i.washroomId;
    if (!byWashroom[name]) {
      byWashroom[name] = { count: 0, totalDuration: 0, hasDuration: 0 };
    }
    byWashroom[name].count += 1;
    if (typeof i.durationSeconds === "number") {
      byWashroom[name].totalDuration += i.durationSeconds;
      byWashroom[name].hasDuration += 1;
      totalDuration += i.durationSeconds;
      durationCount += 1;
    }
  });

  const total = list.length;
  const avgDurationSec = durationCount ? totalDuration / durationCount : 0;
  const avgDurationMin = Math.round(avgDurationSec / 60);

  supervisorStats.textContent =
    `Total inspections : ${total} – durée moyenne : ${avgDurationMin} min`;

  const maxCount = Math.max(...Object.values(byWashroom).map(v => v.count));
  const chart = document.createElement("div");
  chart.style.display = "flex";
  chart.style.flexDirection = "column";
  chart.style.gap = "0.4rem";
  chart.style.marginTop = "0.7rem";

  Object.entries(byWashroom).forEach(([name, v]) => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "0.4rem";

    const label = document.createElement("div");
    label.style.width = "150px";
    label.style.fontSize = "0.8rem";
    label.textContent = name;

    const barWrapper = document.createElement("div");
    barWrapper.style.flex = "1";
    barWrapper.style.height = "12px";
    barWrapper.style.background = "#e5e7eb";
    barWrapper.style.borderRadius = "999px";

    const bar = document.createElement("div");
    bar.style.height = "100%";
    bar.style.borderRadius = "999px";
    bar.style.background = "#22c55e";
    bar.style.width = `${(v.count / maxCount) * 100}%`;

    const countLabel = document.createElement("div");
    countLabel.style.width = "40px";
    countLabel.style.fontSize = "0.8rem";
    countLabel.textContent = v.count;

    barWrapper.appendChild(bar);
    row.appendChild(label);
    row.appendChild(barWrapper);
    row.appendChild(countLabel);
    chart.appendChild(row);
  });

  supervisorCharts.appendChild(chart);
}

// PWA service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .catch(err => console.log("Échec de l’enregistrement du service worker", err));
  });
}
