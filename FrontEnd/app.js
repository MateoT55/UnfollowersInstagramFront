// ---------- Configuración ----------
const API_URL = "https://unfollowersinstagram.onrender.com/api/Unfollowers";

// ---------- Capa de API (sin lógica visual) ----------
async function scanFiles(seguidores, seguidos) {
  const formData = new FormData();
  formData.append("seguidores", seguidores);
  formData.append("seguidos", seguidos);

  let response;
  try {
    // Sin header Content-Type: el navegador genera el multipart con su boundary
    response = await fetch(API_URL, { method: "POST", body: formData });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Verificá que la Web API esté ejecutándose.");
  }

  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

// El backend devuelve texto plano en BadRequest("..."); ASP.NET puede devolver ProblemDetails (JSON)
async function readError(response) {
  const raw = await response.text();
  try {
    const data = JSON.parse(raw);
    if (typeof data === "string") return data;
    if (data.errors) return Object.values(data.errors).flat().join(" ");
    if (data.title) return data.title;
  } catch { /* no era JSON */ }
  return raw || `Error del servidor (${response.status}).`;
}

// ---------- Estado ----------
const files = { seguidores: null, seguidos: null };
let isLoading = false;

// ---------- Elementos ----------
const scanBtn = document.getElementById("scan-btn");
const scanLabel = document.getElementById("scan-label");
const messageBox = document.getElementById("message");
const resultsBody = document.getElementById("results-body");

// ---------- Mensajes ----------
function showMessage(text, type = "error") {
  messageBox.textContent = text;
  messageBox.className = `message ${type}`;
  messageBox.hidden = false;
}
const clearMessage = () => { messageBox.hidden = true; };

// ---------- Validación ----------
function validateFile(file) {
  if (!file.name.toLowerCase().endsWith(".json")) return "Solo se permiten archivos JSON.";
  if (file.size === 0) return "Los archivos no pueden estar vacíos.";
  return null;
}

// ---------- Dropzones ----------
function setupDropzone(key) {
  const zone = document.getElementById(`zone-${key}`);
  const input = document.getElementById(`input-${key}`);
  const label = zone.querySelector(".dz-file");

  function handleFile(file) {
    clearMessage();
    zone.classList.remove("loaded", "invalid");
    files[key] = null;
    label.textContent = label.dataset.empty;
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      zone.classList.add("invalid");
      showMessage(error);
      input.value = "";
      return;
    }
    files[key] = file;
    label.textContent = file.name;
    zone.classList.add("loaded");
  }

  input.addEventListener("change", () => handleFile(input.files[0]));

  ["dragenter", "dragover"].forEach(ev =>
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach(ev =>
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove("dragover"); }));
  zone.addEventListener("drop", e => {
    const file = e.dataTransfer.files[0];
    if (file) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
    }
    handleFile(file);
  });
}

// ---------- Resultados ----------
function renderResults(users) {
  resultsBody.replaceChildren();

  const summary = document.createElement("p");
  summary.className = "summary";

  if (users.length === 0) {
    summary.classList.add("ok");
    summary.textContent = "No se encontraron personas que no te sigan de vuelta.";
    resultsBody.append(summary);
    return;
  }

  summary.textContent = users.length === 1
    ? "1 persona no te sigue de vuelta"
    : `${users.length} personas no te siguen de vuelta`;

  const list = document.createElement("ul");
  list.className = "user-list";
  users.forEach(user => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `https://www.instagram.com/${encodeURIComponent(user)}/`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = `@${user}`; // textContent evita inyección de HTML
    li.append(a);
    list.append(li);
  });
  resultsBody.append(summary, list);
}

function renderResultsError() {
  resultsBody.innerHTML = '<p class="placeholder">No hay resultados para mostrar.</p>';
}

// ---------- Loading ----------
function setLoading(loading) {
  isLoading = loading;
  scanBtn.disabled = loading;
  scanBtn.classList.toggle("loading", loading);
  scanLabel.textContent = loading ? "Analizando archivos..." : "SCAN";
}

// ---------- SCAN ----------
async function handleScan() {
  if (isLoading) return;
  clearMessage();

  if (!files.seguidores || !files.seguidos) {
    showMessage("Tenés que cargar ambos archivos: seguidores y seguidos.");
    return;
  }
  for (const file of [files.seguidores, files.seguidos]) {
    const error = validateFile(file);
    if (error) { showMessage(error); return; }
  }

  setLoading(true);
  try {
    const users = await scanFiles(files.seguidores, files.seguidos);
    renderResults(Array.isArray(users) ? users : []);
  } catch (err) {
    showMessage(err.message);
    renderResultsError();
  } finally {
    setLoading(false);
  }
}

// ---------- Init ----------
setupDropzone("seguidores");
setupDropzone("seguidos");
scanBtn.addEventListener("click", handleScan);
