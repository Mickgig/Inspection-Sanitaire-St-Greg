// Configuration (FR only, par élément avec photos)
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

const STORAGE_KEY = "sanitary_inspections_arbraska_v1";

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

// Onglets
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

// En ligne / hors ligne
function updateOnlineStatus() {
  if (navigator.onLine) {
    onlineStatusEl.style.backgroundColor = "#22c55e";
    onlineTextEl.textContent = "En ligne";
  } else {
    onlineStatusEl.style.backgroundColor = "#f97316";
    onlineTextEl.textContent = "Hors ligne (données enregistrées sur l’iPad)";
  }
}
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();

// Remplir la liste des toilettes
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

// Construire les sections par élément avec photos
function buildDynamicChecklist() {
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

    // Photos avant/après pour cet élément
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
    beforeInput.capture = "environment"; // ouvre la caméra sur iPad
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

  // Cabines
  if (w.numStalls > 0 && stallTasks.length) {
    const title = document.createElement("div");
    title.className = "fixture-section-title";
    title.textContent = "Cabines";
    dynamicChecklist.appendChild(title);
    for (let i = 1; i <= w.numStalls; i++) {
      dynamicChecklist.appendChild(createFixtureGroup("stall", i, stallTasks));
    }
  }

  // Lavabos
  if (w.numSinks > 0 && sinkTasks.length) {
    const title = document.createElement("div");
    title.className = "fixture-section-title";
    title.textContent = "Lavabos";
    dynamicChecklist.appendChild(title);
    for (let i = 1; i <= w.numSinks; i++) {
      dynamicChecklist.appendChild(createFixtureGroup("sink", i, sinkTasks));
    }
  }

  // Urinoirs
  if (w.numUrinals > 0 && urinalTasks.length) {
    const title = document.createElement("div");
    title.className = "fixture-section-title";
    title.textContent = "Urinoirs";
    dynamicChecklist.appendChild(title);
    for (let i = 1; i <= w.numUrinals; i++) {
      dynamicChecklist.appendChild(createFixtureGroup("urinal", i, urinalTasks));
    }
  }

  // Général
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

// Sauvegarde avec validations
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
      .filter(cb => cb.dataset.type === type && String(cb.dataset.index) == String(index) && cb.checked)
      .map(cb => cb.dataset.taskId);
  }

  // Valider cabines
  for (let i = 1; i <= w.numStalls; i++) {
    const checked = getChecked("stall", i);
    if (checked.length < stallTasks.length) {
      saveMessage.textContent = `Toutes les tâches doivent être cochées pour la cabine #${i}.`;
      return;
    }
  }

  // Valider lavabos
  for (let i = 1; i <= w.numSinks; i++) {
    const checked = getChecked("sink", i);
    if (checked.length < sinkTasks.length) {
      saveMessage.textContent = `Toutes les tâches doivent être cochées pour le lavabo #${i}.`;
      return;
    }
  }

  // Valider urinoirs
  for (let i = 1; i <= w.numUrinals; i++) {
    const checked = getChecked("urinal", i);
    if (checked.length < urinalTasks.length) {
      saveMessage.textContent = `Toutes les tâches doivent être cochées pour l’urinoir #${i}.`;
      return;
    }
  }

  // Valider général
  const generalChecked = getChecked("general", 0);
  if (generalTasks.length && generalChecked.length < generalTasks.length) {
    saveMessage.textContent = "Toutes les tâches générales doivent être cochées.";
    return;
  }

  // Récupérer les photos par élément
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

  saveMessage.textContent = "Inspection enregistrée sur cet appareil.";
  setTimeout(() => (saveMessage.textContent = ""), 3000);

  // Réinitialiser
  notesInput.value = "";
  document.querySelectorAll(".fixture-checkbox").forEach(cb => (cb.checked = false));
  document.querySelectorAll(".fixture-photo-input").forEach(inp => (inp.value = ""));
});

// Afficher l'historique
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

    const div = document.createElement("div");
    div.className = "inspection-item";
    div.innerHTML = `
      <strong>${formatDateTime(dt)} – ${washroomName}</strong>
      <div>Inspecteur : ${item.inspector}</div>
      <div>Cabines inspectées : ${stallCount}</div>
      <div>Lavabos inspectés : ${sinkCount}</div>
      <div>Urinoirs inspectés : ${urinalCount}</div>
      <div>Commentaires : ${item.notes || "Aucun"}</div>
    `;
    inspectionsList.appendChild(div);
  });
}

// PWA : service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .catch(err => console.log("Échec de l’enregistrement du service worker", err));
  });
}
