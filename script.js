const SUPABASE_URL = "https://oskorapwgvoecvtdtkwi.supabase.co";
const SUPABASE_KEY = "sb_publishable_Zm5qgcsjzsuzicBwa6Z0sA_qgn-Gm5R";
const STAFF_SESSION_STORAGE_KEY = "rafacStaffSession";

let publicSupabaseClient = null;
let supabaseClient = null;
if(window.supabase){
  publicSupabaseClient = createSupabaseClient();
  supabaseClient = publicSupabaseClient;
}else{
  alert("Supabase did not load. Check the internet connection.");
}

let uniformStock = [];
let uniformIssues = [];
let uniformRequests = [];
let atKit = [];
let atIssues = [];
let atRequests = [];
let kitLists = [];
let kitListItems = [];
let serviceChecks = [];
let tempPasswords = [];
let kitEvents = JSON.parse(localStorage.getItem("kitEvents") || "[]");
let inspectionRecords = JSON.parse(localStorage.getItem("inspectionRecords") || "[]");
let serialRules = JSON.parse(localStorage.getItem("serialRules") || "[]");
let uniformBulkRows = [];
let atBulkRows = [];
let eventCadets = JSON.parse(localStorage.getItem("eventCadets") || "{}");
let pendingEventIssues = JSON.parse(localStorage.getItem("pendingEventIssues") || "[]");
let selectedCheckerEvent = "";
let modalCadet = "";

function createSupabaseClient(sessionToken=""){
  const options = {
    auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
  };
  if(sessionToken){
    options.global = {headers:{"x-staff-session":sessionToken}};
  }
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, options);
}
function activateStaffSession(session){
  supabaseClient = createSupabaseClient(session.session_token);
  try{
    sessionStorage.setItem(STAFF_SESSION_STORAGE_KEY, JSON.stringify({
      session_token:session.session_token,
      access_label:session.access_label,
      expires_at:session.expires_at
    }));
  }catch(error){
    console.warn("Could not persist the staff session in this tab.", error);
  }
}
function clearStaffSession(){
  try{sessionStorage.removeItem(STAFF_SESSION_STORAGE_KEY);}catch(error){console.warn(error);}
  supabaseClient = publicSupabaseClient;
}
function getStoredStaffSession(){
  try{
    const value = sessionStorage.getItem(STAFF_SESSION_STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  }catch(error){
    console.warn("Could not restore the staff session.", error);
    return null;
  }
}
function setLoginBusy(busy){
  const button = document.getElementById("staffLoginButton");
  if(!button) return;
  button.disabled = busy;
  button.textContent = busy ? "Checking..." : "Login";
}
function escapeHtml(value){
  return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function formatDate(value){ if(!value) return ""; try{return new Date(value).toLocaleString("en-GB");}catch{return value;} }
function todayISO(){return new Date().toISOString();}
const DAY_MS = 1000 * 60 * 60 * 24;
function uniqueSorted(values, compareFn){
  return [...new Set(values.filter(Boolean))].sort(compareFn);
}
function findById(items, id){
  return items.find(item => String(item.id) === String(id));
}
function withoutId(items, id){
  return items.filter(item => String(item.id) !== String(id));
}
function filterBySearch(items, inputId, fields){
  const query = (document.getElementById(inputId)?.value || "").toLowerCase();
  return items.filter(item => fields.some(field =>
    String(item[field] || "").toLowerCase().includes(query)
  ));
}
function populateSelect(id, placeholder, items, getValue=x => x, getLabel=getValue, preserveValue=false){
  const select = document.getElementById(id); if(!select) return;
  const current = preserveValue ? select.value : "";
  const options = items.map(item => `<option value="${escapeHtml(getValue(item))}">${escapeHtml(getLabel(item))}</option>`).join("");
  select.innerHTML = `<option value="">${placeholder}</option>${options}`;
  if(current) select.value = current;
}
function setFieldValues(values){
  Object.entries(values).forEach(([id, value]) => {
    const field = document.getElementById(id);
    if(field) field.value = value;
  });
}
function renderTableRows(tableId, rows, colspan, emptyMessage, renderRow){
  const table = document.getElementById(tableId); if(!table) return false;
  table.innerHTML = rows.length
    ? rows.map(renderRow).join("")
    : `<tr><td colspan="${colspan}" class="no-data">${emptyMessage}</td></tr>`;
  return true;
}
function renderKitChecklist(containerId, items, checkboxClass, emptyMessage){
  const container = document.getElementById(containerId); if(!container) return;
  container.innerHTML = items.length
    ? items.map(item => `<label><input type="checkbox" class="${checkboxClass}" value="${escapeHtml(item.kit_type)}"> ${escapeHtml(item.kit_type)} ${item.required ? "(Required)" : "(Optional)"}</label>`).join("")
    : `<p>${emptyMessage}</p>`;
}
function getCheckedValues(selector){
  return Array.from(document.querySelectorAll(selector)).map(item => item.value);
}
function requestActionButtons(id, handlerName){
  return `<button onclick="${handlerName}('${id}', 'Approved')">Approve</button><button class="danger" onclick="${handlerName}('${id}', 'Rejected')">Reject</button>`;
}
async function updateRequestStatus(table, id, status, reload){
  const {error} = await supabaseClient.from(table).update({status}).eq("id", id);
  if(error){ console.error(error); alert("Could not update request."); return; }
  await reload();
}
function saveLocal(){
  localStorage.setItem("eventCadets", JSON.stringify(eventCadets));
  localStorage.setItem("pendingEventIssues", JSON.stringify(pendingEventIssues));
  localStorage.setItem("kitEvents", JSON.stringify(kitEvents));
  localStorage.setItem("inspectionRecords", JSON.stringify(inspectionRecords));
}
function showOnly(id){
  document.querySelectorAll(".screen, .app").forEach(page => page.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
}
function goHome(){showOnly("homePage");}
function showStaffLogin(){showOnly("staffLoginPage");}
async function logout(){
  try{await supabaseClient?.rpc("end_staff_session");}catch(error){console.error(error);}
  clearStaffSession();
  goHome();
}
async function showCadetUniformPortal(){showOnly("cadetUniformPortal"); await loadUniformCatalog(); populateCadetUniformDropdowns();}
async function showCadetATPortal(){showOnly("cadetATPortal"); await loadKitLists(); populateCadetATEvents();}
async function loginStaff(){
  const username = document.getElementById("staffUsername").value.trim();
  const password = document.getElementById("staffPassword").value;
  if(!publicSupabaseClient){alert("Supabase is unavailable.");return;}
  if(!password){alert("Enter the staff password.");return;}
  if(username && username.length < 3){alert("Enter the full temporary username.");return;}

  setLoginBusy(true);
  try{
    const {data,error} = await publicSupabaseClient.rpc("authenticate_staff", {
      p_password:password,
      p_username:username || null
    });
    if(error){
      console.error(error);
      const message = String(error.message || "");
      const setupMissing = message.includes("authenticate_staff");
      const lockedOut = message.includes("Too many failed attempts");
      alert(setupMissing
        ? "Secure staff authentication is not configured. Apply SECURITY_SETUP.md first."
        : lockedOut
          ? "Too many failed attempts. Please wait 15 minutes and try again."
          : "Could not authenticate staff access.");
      return;
    }

    const session = Array.isArray(data) ? data[0] : data;
    if(!session?.session_token){alert("Incorrect or expired credentials.");return;}

    activateStaffSession(session);
    setFieldValues({staffUsername:"", staffPassword:""});
    await openStaffApp(session.access_label || "Staff Access");
  }catch(error){
    console.error(error);
    alert("Could not authenticate staff access. Check the connection and try again.");
  }finally{
    setLoginBusy(false);
  }
}
async function restoreStaffSession(){
  const stored = getStoredStaffSession();
  if(!stored?.session_token || !publicSupabaseClient){goHome();return;}

  try{
    supabaseClient = createSupabaseClient(stored.session_token);
    const {data,error} = await supabaseClient.rpc("validate_staff_session");
    const session = Array.isArray(data) ? data[0] : data;
    if(error || !session){
      if(error) console.error(error);
      clearStaffSession();
      goHome();
      return;
    }

    await openStaffApp(session.access_label || stored.access_label || "Staff Access");
  }catch(error){
    console.error(error);
    clearStaffSession();
    goHome();
  }
}
async function openStaffApp(label){
  document.getElementById("loginStatus").innerText = label;
  showOnly("staffApp");
  await loadAll();
  const requestedRoute = location.hash.replace("#", "");
  showStaffPage(routeToPage(requestedRoute || "dashboard"));
}
const SPA_ROUTES = {
  "dashboard":"dashboardPage",
  "uniform-stock":"uniformStockPage",
  "uniform-issued":"uniformIssuedPage",
  "uniform-requests":"uniformRequestsPage",
  "at-stock":"atStockPage",
  "at-issue":"atIssuePage",
  "kit-lists":"kitListPage",
  "serial-numbers":"serialRulesPage",
  "events":"eventsPage",
  "event-issues":"eventIssuePage",
  "kit-checker":"kitCheckerPage",
  "missing-kit":"missingKitPage",
  "borrow-stats":"borrowStatsPage",
  "inspections":"inspectionPage",
  "serviceability":"serviceabilityPage",
  "low-stock":"lowStockPage",
  "at-requests":"atRequestsPage",
  "temporary-passwords":"tempPasswordPage"
};

const PAGE_ROUTES = Object.fromEntries(
  Object.entries(SPA_ROUTES).map(([route, page]) => [page, route])
);

function routeToPage(route){
  return SPA_ROUTES[route] || "dashboardPage";
}

function pageToRoute(pageId){
  return PAGE_ROUTES[pageId] || "dashboard";
}

const CONSOLIDATED_PAGE_PARENTS = {
  "borrowStatsPage":"dashboardPage",
  "lowStockPage":"uniformStockPage",
  "eventIssuePage":"eventsPage",
  "kitCheckerPage":"eventsPage"
};

const STAFF_PAGE_RENDERERS = {
  dashboardPage(){ renderMainDashboard(); renderBorrowStats(); },
  eventsPage(){ populateEventDashboardSelect(); loadEventDashboard(); populateEventIssueFilter(); renderEventIssueSheet(); populateCheckerEvents(); loadCheckerEvent(); },
  missingKitPage(){ renderMissingKitDashboard(); },
  inspectionPage(){ populateInspectionKitDropdown(); renderInspectionSystem(); },
  uniformStockPage(){ renderUniformStock(); populateUniformBulkDropdowns(); renderUniformBulkTable(); renderLowStockOrderingList(); },
  uniformIssuedPage(){ populateUniformIssueDropdowns(); renderUniformIssues(); },
  uniformRequestsPage(){ renderUniformRequests(); },
  atStockPage(){ renderATKit(); populateATBulkTypeDropdown(); renderATBulkTable(); showNextATSerialPreview(); },
  atIssuePage(){ populateATIssueDropdowns(); renderATIssues(); },
  kitListPage(){ populateKitListDropdowns(); renderKitListItems(); },
  serialRulesPage(){ renderSerialRules(); populateATBulkTypeDropdown(); },
  serviceabilityPage(){ populateServiceKitDropdown(); renderServiceability(); },
  atRequestsPage(){ renderATRequests(); },
  tempPasswordPage(){ loadTempPasswords(); }
};

function showStaffPage(id){
  id = CONSOLIDATED_PAGE_PARENTS[id] || id;
  document.querySelectorAll(".staff-page").forEach(page => page.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
  document.querySelectorAll(`[data-parent-page="${id}"]`).forEach(page => page.classList.add("active"));
  document.querySelector("nav")?.classList.remove("open");

  const route = pageToRoute(id);
  if(location.hash !== "#" + route){
    history.replaceState(null, "", "#" + route);
  }

  document.querySelectorAll("nav button").forEach(button => {
    const action = button.getAttribute("onclick") || "";
    button.classList.toggle("active-nav", action.includes("'" + id + "'"));
  });
  STAFF_PAGE_RENDERERS[id]?.();
}
function showStaffSection(pageId, sectionId){
  showStaffPage(pageId);
  document.getElementById(sectionId)?.scrollIntoView();
}
async function loadAll(){
  await loadUniformStock(); await loadUniformIssues(); await loadUniformRequests();
  await refreshATIssueData(); await loadATRequests();
  await loadKitLists(); await loadServiceChecks(); await loadTempPasswords(false); populateUniformBulkDropdowns(); populateATBulkTypeDropdown();
}
function renderATOverview(){
  renderMissingKitDashboard();
  renderBorrowStats();
  renderMainDashboard();
  renderEventDashboard();
}
async function refreshATIssueData(){
  await loadATKit();
  await loadATIssues();
  renderATOverview();
}
async function loadUniformCatalog(){
  if(!publicSupabaseClient) return;
  const {data,error} = await publicSupabaseClient.rpc("get_uniform_catalog");
  if(error){console.error(error);alert("Could not load the uniform list.");return;}
  uniformStock = data || [];
  populateCadetUniformDropdowns();
}
async function loadUniformStock(){
  if(!supabaseClient) return;
  const {data,error} = await supabaseClient.from("uniform_stock").select("*").order("item").order("size");
  if(error){ console.error(error); alert("Could not load uniform stock."); return; }
  uniformStock = data || [];
  renderUniformStock(); populateUniformIssueDropdowns(); populateCadetUniformDropdowns();
}
function renderUniformStock(){
  const rows = filterBySearch(uniformStock, "uniformSearch", ["item", "size", "box_number"]);
  renderTableRows("uniformStockTable", rows, 7, "No uniform stock found", row => {
    const qty = Number(row.quantity || 0);
    const min = Number(row.warning_level || 1);
    const cls = qty <= 0 ? "out-row" : qty <= min ? "low-row" : "";
    return `<tr class="${cls}">
      <td>${escapeHtml(row.item)}</td><td>${escapeHtml(row.size)}</td><td>${escapeHtml(row.box_number)}</td><td>${qty}</td><td>${min}</td>
      <td><button onclick="changeUniformQty('${row.id}', -1)">-1</button><button onclick="changeUniformQty('${row.id}', 1)">+1</button><button onclick="setUniformQty('${row.id}')">Set</button></td>
      <td><button class="danger" onclick="deleteUniformStock('${row.id}')">Delete</button></td></tr>`;
  });
}
async function addUniformStock(){
  const item = document.getElementById("uniformItem").value.trim();
  const size = document.getElementById("uniformSize").value.trim();
  const box = document.getElementById("uniformBox").value.trim();
  const quantity = Number(document.getElementById("uniformQty").value || 0);
  const warning = Number(document.getElementById("uniformMin").value || 1);
  if(!item || !size){alert("Enter item and size.");return;}
  const {error} = await supabaseClient.from("uniform_stock").insert([{item, size, box_number:box, quantity, warning_level:warning}]);
  if(error){ console.error(error); alert("Could not add uniform stock."); return; }
  setFieldValues({uniformItem:"", uniformSize:"", uniformBox:"", uniformQty:"", uniformMin:"1"});
  await loadUniformStock();
}
async function changeUniformQty(id, amount){
  const row = findById(uniformStock, id); if(!row) return;
  const qty = Math.max(0, Number(row.quantity || 0) + amount);
  const {error} = await supabaseClient.from("uniform_stock").update({quantity:qty,updated_at:todayISO()}).eq("id", id);
  if(error){ console.error(error); alert("Could not update stock."); return; }
  await loadUniformStock();
}
async function setUniformQty(id){
  const row = findById(uniformStock, id); if(!row) return;
  const value = prompt("Enter new quantity:", row.quantity || 0); if(value === null) return;
  const qty = Number(value); if(isNaN(qty) || qty < 0){alert("Enter a valid number.");return;}
  const {error} = await supabaseClient.from("uniform_stock").update({quantity:qty,updated_at:todayISO()}).eq("id", id);
  if(error){ console.error(error); alert("Could not update stock."); return; }
  await loadUniformStock();
}
async function deleteUniformStock(id){
  if(!confirm("Delete this uniform item?")) return;
  const {error} = await supabaseClient.from("uniform_stock").delete().eq("id", id);
  if(error){ console.error(error); alert("Could not delete uniform stock."); return; }
  await loadUniformStock();
}
function populateUniformIssueDropdowns(){
  populateUniformItemDropdown("uniformIssueItem");
}
function populateUniformSizesForIssue(){
  populateUniformSizeDropdown("uniformIssueItem", "uniformIssueSize");
  showUniformIssueStockInfo();
}
function populateUniformItemDropdown(selectId){
  populateSelect(selectId, "Select item", uniqueSorted(uniformStock.map(x => x.item)));
}
function populateUniformSizeDropdown(itemSelectId, sizeSelectId){
  const item = document.getElementById(itemSelectId).value;
  const sizes = uniqueSorted(uniformStock.filter(x => x.item === item).map(x => x.size));
  populateSelect(sizeSelectId, "Select size", sizes);
}
function showUniformIssueStockInfo(){
  const item = document.getElementById("uniformIssueItem").value;
  const size = document.getElementById("uniformIssueSize").value;
  const info = document.getElementById("uniformStockInfo");
  if(!item || !size){info.innerHTML = "Select an item and size.";return;}
  const matches = uniformStock.filter(x => x.item === item && x.size === size);
  const total = matches.reduce((sum,x) => sum + Number(x.quantity || 0), 0);
  info.innerHTML = `<strong>Total available:</strong> ${total}<br>${matches.map(x => `${escapeHtml(x.box_number || "No box")} - Qty ${x.quantity || 0}`).join("<br>")}`;
}
async function issueUniform(){
  const cadet = document.getElementById("uniformIssueCadet").value.trim();
  const item = document.getElementById("uniformIssueItem").value;
  const size = document.getElementById("uniformIssueSize").value;
  const qty = Number(document.getElementById("uniformIssueQty").value || 1);
  if(!cadet || !item || !size || qty < 1){alert("Complete all fields.");return;}
  const matches = uniformStock.filter(x => x.item === item && x.size === size && Number(x.quantity || 0) > 0).sort((a,b) => Number(b.quantity || 0) - Number(a.quantity || 0));
  let remaining = qty; const records = [];
  for(const stock of matches){
    if(remaining <= 0) break;
    const available = Number(stock.quantity || 0);
    const taken = Math.min(available, remaining);
    const {error:updateError} = await supabaseClient.from("uniform_stock").update({quantity:available - taken,updated_at:todayISO()}).eq("id", stock.id);
    if(updateError){ console.error(updateError); alert("Could not update stock."); return; }
    records.push({cadet_name:cadet,item:stock.item,size:stock.size,box_number:stock.box_number,quantity:taken,issued_by:"Staff",returned:false});
    remaining -= taken;
  }
  if(remaining > 0){alert("Not enough stock available."); await loadUniformStock(); return;}
  const {error} = await supabaseClient.from("uniform_issues").insert(records);
  if(error){ console.error(error); alert("Stock updated but issue history failed."); return; }
  alert("Uniform issued.");
  setFieldValues({uniformIssueCadet:"", uniformIssueItem:"", uniformIssueQty:"1"});
  document.getElementById("uniformIssueSize").innerHTML = `<option value="">Select size</option>`;
  await loadUniformStock(); await loadUniformIssues();
}
async function loadUniformIssues(){
  const {data,error} = await supabaseClient.from("uniform_issues").select("*").order("issue_date", {ascending:false});
  if(error){ console.error(error); return; }
  uniformIssues = data || []; renderUniformIssues();
}
function renderUniformIssues(){
  const rows = filterBySearch(uniformIssues, "uniformIssueSearch", ["cadet_name", "item", "size", "box_number"]);
  renderTableRows("uniformIssuedTable", rows, 7, "No uniform issues found", x => `<tr><td>${escapeHtml(x.cadet_name)}</td><td>${escapeHtml(x.item)}</td><td>${escapeHtml(x.size)}</td><td>${escapeHtml(x.box_number)}</td><td>${escapeHtml(x.quantity)}</td><td>${formatDate(x.issue_date || x.created_at)}</td><td>${x.returned ? "Yes" : "No"}</td></tr>`);
}
async function loadUniformRequests(){
  const {data,error} = await supabaseClient.from("uniform_requests").select("*").order("requested_at", {ascending:false});
  if(error){ console.error(error); return; }
  uniformRequests = data || []; renderUniformRequests();
}
function renderUniformRequests(){
  renderTableRows("uniformRequestsTable", uniformRequests, 7, "No uniform requests found", x => `<tr><td>${escapeHtml(x.cadet_name)}</td><td>${escapeHtml(x.item)}</td><td>${escapeHtml(x.size)}</td><td>${escapeHtml(x.reason)}</td><td>${escapeHtml(x.status || "Pending")}</td><td>${formatDate(x.requested_at || x.created_at)}</td><td>${requestActionButtons(x.id, "updateUniformRequest")}</td></tr>`);
}
async function updateUniformRequest(id, status){
  await updateRequestStatus("uniform_requests", id, status, loadUniformRequests);
}
function populateCadetUniformDropdowns(){
  populateUniformItemDropdown("cadetUniformItem");
}
function populateCadetUniformSizes(){
  populateUniformSizeDropdown("cadetUniformItem", "cadetUniformSize");
}
async function submitUniformRequest(){
  const cadet = document.getElementById("cadetUniformName").value.trim();
  const item = document.getElementById("cadetUniformItem").value;
  const size = document.getElementById("cadetUniformSize").value;
  const reason = document.getElementById("cadetUniformReason").value.trim();
  if(!publicSupabaseClient){alert("Supabase is unavailable.");return;}
  if(!cadet || !item || !size || !reason){alert("Complete all fields.");return;}
  const {error} = await publicSupabaseClient.rpc("submit_uniform_request", {
    p_cadet_name:cadet,
    p_item:item,
    p_size:size,
    p_reason:reason
  });
  if(error){ console.error(error); alert("Could not submit request."); return; }
  alert("Request submitted.");
  setFieldValues({cadetUniformName:"", cadetUniformItem:"", cadetUniformReason:""});
  document.getElementById("cadetUniformSize").innerHTML = `<option value="">Select size</option>`;
}
async function loadATKit(){
  const {data,error} = await supabaseClient.from("at_kit").select("*").order("kit_type").order("kit_number");
  if(error){ console.error(error); alert("Could not load AT kit."); return; }
  atKit = data || []; renderATKit(); populateATIssueDropdowns(); populateServiceKitDropdown();
}
async function countBorrows(kitId, kitType, kitNumber){
  const {count} = await supabaseClient.from("at_kit_issues").select("*", {count:"exact", head:true}).or(`kit_id.eq.${kitId},and(kit_type.eq.${kitType},kit_number.eq.${kitNumber})`);
  return count || 0;
}
function renderATKit(){
  const rows = filterBySearch(atKit, "atSearch", ["kit_type", "kit_number", "size", "location", "condition", "status", "notes"]);
  if(!renderTableRows("atKitTable", rows, 9, "No AT kit found", x => `<tr><td>${escapeHtml(x.kit_type)}</td><td>${escapeHtml(x.kit_number)}</td><td>${escapeHtml(x.size)}</td><td>${escapeHtml(x.location)}</td><td>${escapeHtml(x.condition)}</td><td>${escapeHtml(x.status || "Available")}</td><td id="borrow-${x.id}">...</td><td>${escapeHtml(x.notes)}</td><td><button class="danger" onclick="deleteATKit('${x.id}')">Delete</button></td></tr>`)) return;
  rows.forEach(x => {
    countBorrows(x.id, x.kit_type, x.kit_number).then(count => { const cell = document.getElementById(`borrow-${x.id}`); if(cell) cell.textContent = count; });
  });
}
async function addATKit(){
  const kit_type = document.getElementById("atType").value.trim();
  const kit_number = document.getElementById("atNumber").value.trim();
  const size = document.getElementById("atSize").value.trim();
  const location = document.getElementById("atLocation").value.trim();
  const condition = document.getElementById("atCondition").value.trim() || "Good";
  const notes = document.getElementById("atNotes").value.trim();
  if(!kit_type || !kit_number){alert("Enter kit type and identifying number.");return;}
  const {error} = await supabaseClient.from("at_kit").insert([{kit_type, kit_number, size, location, condition, notes, status:"Available"}]);
  if(error){ console.error(error); alert("Could not add AT kit."); return; }
  setFieldValues({atType:"", atNumber:"", atSize:"", atLocation:"", atNotes:"", atCondition:"Good"});
  await loadATKit();
}
async function deleteATKit(id){
  if(!confirm("Delete this AT kit item?")) return;
  const {error} = await supabaseClient.from("at_kit").delete().eq("id", id);
  if(error){ console.error(error); alert("Could not delete AT kit."); return; }
  await loadATKit();
}
function populateATIssueDropdowns(){
  populateSelect("atIssueType", "Select kit type", uniqueSorted(atKit.map(x => x.kit_type)));
}
function populateATIssueNumbers(){
  const type = document.getElementById("atIssueType").value;
  const available = atKit.filter(x => x.kit_type === type && (x.status || "Available") === "Available");
  populateSelect("atIssueKit", "Select item number", available, x => x.id, x => `${x.kit_number} ${x.size ? "- " + x.size : ""}`);
  showATIssueInfo();
}
function showATIssueInfo(){
  const id = document.getElementById("atIssueKit").value;
  const info = document.getElementById("atIssueInfo");
  const item = findById(atKit, id);
  if(!item){info.innerHTML = "Select a kit item.";return;}
  info.innerHTML = `<strong>Type:</strong> ${escapeHtml(item.kit_type)}<br><strong>Number:</strong> ${escapeHtml(item.kit_number)}<br><strong>Size:</strong> ${escapeHtml(item.size)}<br><strong>Condition:</strong> ${escapeHtml(item.condition)}<br><strong>Location:</strong> ${escapeHtml(item.location)}`;
}
async function issueATKit(){
  const cadet = document.getElementById("atIssueCadet").value.trim();
  const kitId = document.getElementById("atIssueKit").value;
  const eventName = document.getElementById("atIssueEvent").value.trim();
  const notes = document.getElementById("atIssueNotes").value.trim();
  const kit = findById(atKit, kitId);
  if(!cadet || !kit){alert("Enter cadet and select kit.");return;}
  const {error:updateError} = await supabaseClient.from("at_kit").update({status:"Issued", updated_at:todayISO()}).eq("id", kit.id);
  if(updateError){ console.error(updateError); alert("Could not update kit status."); return; }
  const {error} = await supabaseClient.from("at_kit_issues").insert([{kit_id:kit.id,kit_type:kit.kit_type,kit_number:kit.kit_number,cadet_name:cadet,event_name:eventName,issued_by:"Staff",returned:false,notes}]);
  if(error){ console.error(error); alert("Kit marked issued but issue record failed."); return; }
  alert("AT kit issued.");
  setFieldValues({atIssueCadet:"", atIssueType:"", atIssueEvent:"", atIssueNotes:""});
  document.getElementById("atIssueKit").innerHTML = `<option value="">Select item number</option>`;
  await refreshATIssueData();
}
async function loadATIssues(){
  const {data,error} = await supabaseClient.from("at_kit_issues").select("*").order("issued_at", {ascending:false});
  if(error){ console.error(error); return; }
  atIssues = data || []; renderATIssues(); renderEventIssueSheet();
}
function renderATIssues(){
  renderTableRows("atIssuesTable", atIssues, 6, "No AT issues found", x => `<tr><td>${escapeHtml(x.cadet_name)}</td><td>${escapeHtml(x.event_name)}</td><td>${escapeHtml(x.kit_type)}</td><td>${escapeHtml(x.kit_number)}</td><td>${formatDate(x.issued_at || x.created_at)}</td><td>${x.returned ? "Yes" : `<button onclick="returnATKit('${x.id}')">Return</button>`}</td></tr>`);
}
async function returnATKit(issueId){
  const issue = findById(atIssues, issueId); if(!issue) return;
  if(!confirm("Mark this item as returned?")) return;
  await supabaseClient.from("at_kit_issues").update({returned:true, return_date:todayISO()}).eq("id", issueId);
  if(issue.kit_id) await supabaseClient.from("at_kit").update({status:"Available", updated_at:todayISO()}).eq("id", issue.kit_id);
  await refreshATIssueData();
}
async function loadKitLists(){
  if(!supabaseClient) return;
  const {data:lists,error:listError} = await supabaseClient.from("at_kit_lists").select("*").eq("active", true).order("activity_name");
  if(listError){ console.error(listError); return; }
  const {data:items,error:itemError} = await supabaseClient.from("at_kit_list_items").select("*").order("display_order");
  if(itemError){ console.error(itemError); return; }
  kitLists = lists || []; kitListItems = items || [];
  populateKitListDropdowns(); populateEventIssueFilter(); populateCheckerEvents(); populateCadetATEvents(); renderKitListItems();
}
function populateKitListDropdowns(){
  populateKitListSelect("kitListSelect", "Select kit list");
}
function populateKitListSelect(id, placeholder){
  populateSelect(id, placeholder, kitLists, x => x.id, x => x.activity_name);
}
async function createKitList(){
  const name = document.getElementById("kitListName").value.trim();
  const notes = document.getElementById("kitListNotes").value.trim();
  if(!name){alert("Enter a kit list/event name.");return;}
  const {error} = await supabaseClient.from("at_kit_lists").insert([{activity_name:name, notes, active:true}]);
  if(error){ console.error(error); alert("Could not create kit list."); return; }
  document.getElementById("kitListName").value = ""; document.getElementById("kitListNotes").value = ""; await loadKitLists();
}
async function addKitListItem(){
  const kit_list_id = document.getElementById("kitListSelect").value;
  const kit_type = document.getElementById("kitListItem").value.trim();
  const required = document.getElementById("kitListRequired").value === "true";
  if(!kit_list_id || !kit_type){alert("Select a kit list and enter an item.");return;}
  const order = kitListItems.filter(x => String(x.kit_list_id) === String(kit_list_id)).length + 1;
  const {error} = await supabaseClient.from("at_kit_list_items").insert([{kit_list_id, kit_type, required, display_order:order}]);
  if(error){ console.error(error); alert("Could not add item."); return; }
  document.getElementById("kitListItem").value = ""; await loadKitLists();
}
function renderKitListItems(){
  const selected = document.getElementById("kitListSelect")?.value || "";
  const rows = kitListItems.filter(x => !selected || String(x.kit_list_id) === String(selected));
  renderTableRows("kitListItemsTable", rows, 4, "No kit list items found", x => {
    const list = findById(kitLists, x.kit_list_id);
    return `<tr><td>${escapeHtml(list?.activity_name || "")}</td><td>${escapeHtml(x.kit_type)}</td><td>${x.required ? "Required" : "Optional"}</td><td><button class="danger" onclick="deleteKitListItem('${x.id}')">Delete</button></td></tr>`;
  });
}
async function deleteKitListItem(id){
  const {error} = await supabaseClient.from("at_kit_list_items").delete().eq("id", id);
  if(error){ console.error(error); alert("Could not delete item."); return; }
  await loadKitLists();
}
function populateEventIssueFilter(){
  populateSelect("eventIssueFilter", "All events", kitLists, x => x.activity_name, x => x.activity_name);
}
function renderEventIssueSheet(){
  const eventName = document.getElementById("eventIssueFilter")?.value || "";
  const rows = atIssues.filter(x => !eventName || x.event_name === eventName);
  renderTableRows("eventIssueTable", rows, 6, "No event issues found", x => `<tr><td>${escapeHtml(x.event_name)}</td><td>${escapeHtml(x.cadet_name)}</td><td>${escapeHtml(x.kit_type)}</td><td>${escapeHtml(x.kit_number)}</td><td>${formatDate(x.issued_at || x.created_at)}</td><td>${x.returned ? "Yes" : "No"}</td></tr>`);
}
function populateCheckerEvents(){
  populateKitListSelect("checkerEvent", "Select event / kit list");
}
function loadCheckerEvent(){
  selectedCheckerEvent = document.getElementById("checkerEvent").value;
  renderCheckerCadets(); renderPendingEventIssues();
}
function saveCheckerCadets(){
  const id = document.getElementById("checkerEvent").value;
  const text = document.getElementById("checkerCadets").value;
  if(!id){alert("Select an event first.");return;}
  const cadets = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if(!cadets.length){alert("Enter at least one cadet.");return;}
  eventCadets[id] = cadets; saveLocal(); renderCheckerCadets();
}
function renderCheckerCadets(){
  if(!selectedCheckerEvent){renderTableRows("checkerCadetsTable", [], 2, "Select an event", () => "");return;}
  const cadets = eventCadets[selectedCheckerEvent] || [];
  renderTableRows("checkerCadetsTable", cadets, 2, "No cadets added", cadet => `<tr><td>${escapeHtml(cadet)}</td><td><button onclick="openKitModal('${escapeHtml(cadet)}')">Select Kit</button></td></tr>`);
}
function openKitModal(cadet){
  modalCadet = cadet;
  const items = kitListItems.filter(x => String(x.kit_list_id) === String(selectedCheckerEvent));
  document.getElementById("kitModalTitle").innerText = `Issue kit to ${cadet}`;
  renderKitChecklist("kitModalChecklist", items, "modal-kit-check", "No kit items found for this event.");
  document.getElementById("kitModal").style.display = "block";
}
function closeKitModal(){document.getElementById("kitModal").style.display = "none"; modalCadet = "";}
function confirmModalKitSelection(){
  const selected = getCheckedValues(".modal-kit-check:checked");
  if(!selected.length){alert("Select at least one item.");return;}
  const list = findById(kitLists, selectedCheckerEvent);
  selected.forEach(type => pendingEventIssues.push({id: Date.now() + Math.random(),eventId:selectedCheckerEvent,eventName:list?.activity_name || "",cadet:modalCadet,kitType:type,kitNumber:""}));
  saveLocal(); closeKitModal(); renderPendingEventIssues();
}
function renderPendingEventIssues(){
  const rows = pendingEventIssues.filter(x => String(x.eventId) === String(selectedCheckerEvent));
  renderTableRows("pendingEventIssueTable", rows, 6, "No kit selected for issue", row => `<tr><td>${escapeHtml(row.eventName)}</td><td>${escapeHtml(row.cadet)}</td><td>${escapeHtml(row.kitType)}</td><td><select onchange="setPendingKitNumber('${row.id}', this.value)"><option value="">Select number</option>${availableKitOptions(row.kitType, row.kitNumber)}</select></td><td><button onclick="issuePendingEventKit('${row.id}')">Issue</button></td><td><button class="danger" onclick="removePendingIssue('${row.id}')">Remove</button></td></tr>`);
}
function availableKitOptions(type, selectedNumber){
  return atKit.filter(x => x.kit_type === type && ((x.status || "Available") === "Available" || x.kit_number === selectedNumber)).map(x => `<option value="${escapeHtml(x.kit_number)}" ${x.kit_number === selectedNumber ? "selected" : ""}>${escapeHtml(x.kit_number)} ${x.size ? "- " + escapeHtml(x.size) : ""}</option>`).join("");
}
function setPendingKitNumber(id, number){
  const row = findById(pendingEventIssues, id);
  if(row){row.kitNumber = number; saveLocal();}
}
async function issuePendingEventKit(id){
  const row = findById(pendingEventIssues, id);
  if(!row || !row.kitNumber){alert("Select a kit number first.");return;}
  const kit = atKit.find(x => x.kit_type === row.kitType && x.kit_number === row.kitNumber);
  if(!kit){alert("Kit item not found.");return;}
  const {error:updateError} = await supabaseClient.from("at_kit").update({status:"Issued", updated_at:todayISO()}).eq("id", kit.id);
  if(updateError){ console.error(updateError); alert("Could not update kit."); return; }
  const {error} = await supabaseClient.from("at_kit_issues").insert([{kit_id:kit.id,kit_type:kit.kit_type,kit_number:kit.kit_number,cadet_name:row.cadet,event_name:row.eventName,issued_by:"Staff",returned:false,notes:"Issued via event kit checker"}]);
  if(error){ console.error(error); alert("Could not save issue record."); return; }
  pendingEventIssues = withoutId(pendingEventIssues, id);
  saveLocal(); await refreshATIssueData(); renderPendingEventIssues();
}
function removePendingIssue(id){pendingEventIssues = withoutId(pendingEventIssues, id); saveLocal(); renderPendingEventIssues();}
async function loadATRequests(){
  const {data,error} = await supabaseClient.from("at_kit_requests").select("*").order("requested_at", {ascending:false});
  if(error){ console.error(error); return; }
  atRequests = data || []; renderATRequests();
}
function renderATRequests(){
  renderTableRows("atRequestsTable", atRequests, 7, "No AT requests found", x => {
    const kit = Array.isArray(x.requested_items) ? x.requested_items.join(", ") : x.kit_type;
    return `<tr><td>${escapeHtml(x.cadet_name)}</td><td>${escapeHtml(x.activity_name)}</td><td>${escapeHtml(kit)}</td><td>${escapeHtml(x.reason)}</td><td>${escapeHtml(x.status || "Pending")}</td><td>${formatDate(x.requested_at || x.created_at)}</td><td>${requestActionButtons(x.id, "updateATRequest")}</td></tr>`;
  });
}
async function updateATRequest(id, status){
  await updateRequestStatus("at_kit_requests", id, status, loadATRequests);
}
function populateCadetATEvents(){
  populateKitListSelect("cadetATEvent", "Select event / activity");
}
function loadCadetATChecklist(){
  const id = document.getElementById("cadetATEvent").value;
  const box = document.getElementById("cadetATChecklist");
  if(!id){box.innerHTML = "";return;}
  const items = kitListItems.filter(x => String(x.kit_list_id) === String(id));
  renderKitChecklist("cadetATChecklist", items, "cadet-at-check", "No kit list found for this event.");
}
async function submitATRequest(){
  const cadet = document.getElementById("cadetATName").value.trim();
  const eventId = document.getElementById("cadetATEvent").value;
  const notes = document.getElementById("cadetATNotes").value.trim();
  const list = findById(kitLists, eventId);
  const selected = getCheckedValues(".cadet-at-check:checked");
  if(!publicSupabaseClient){alert("Supabase is unavailable.");return;}
  if(!cadet || !eventId || !selected.length){alert("Enter your name, select an event and tick kit needed.");return;}
  const {error} = await publicSupabaseClient.rpc("submit_at_kit_request", {
    p_cadet_name:cadet,
    p_activity_name:list?.activity_name || "",
    p_requested_items:selected,
    p_reason:notes
  });
  if(error){ console.error(error); alert("Could not submit AT request."); return; }
  alert("AT kit request submitted.");
  setFieldValues({cadetATName:"", cadetATEvent:"", cadetATNotes:""});
  document.getElementById("cadetATChecklist").innerHTML = "";
}
async function loadServiceChecks(){
  const {data,error} = await supabaseClient.from("serviceability_checks").select("*").order("next_due_date");
  if(error){ console.error(error); serviceChecks = []; renderServiceability(); return; }
  serviceChecks = data || []; renderServiceability();
}
function populateServiceKitDropdown(){
  populateATKitSelect("serviceKit");
}
function populateATKitSelect(id, preserveValue=false){
  populateSelect(id, "Select AT kit item", atKit, x => x.id, x => `${x.kit_type} - ${x.kit_number}`, preserveValue);
}
async function addServiceCheck(){
  const kitId = document.getElementById("serviceKit").value;
  const last = document.getElementById("serviceLastCheck").value;
  const interval = Number(document.getElementById("serviceInterval").value || 365);
  const kit = findById(atKit, kitId);
  if(!kit || !last || interval < 1){alert("Select kit, last check date and interval.");return;}
  const next = new Date(last); next.setDate(next.getDate() + interval);
  const {error} = await supabaseClient.from("serviceability_checks").insert([{kit_id:kit.id,kit_type:kit.kit_type,kit_number:kit.kit_number,last_check_date:last,interval_days:interval,next_due_date:next.toISOString().slice(0,10)}]);
  if(error){ console.error(error); alert("Could not save serviceability check."); return; }
  setFieldValues({serviceKit:"", serviceLastCheck:"", serviceInterval:"365"});
  await loadServiceChecks();
}
function renderServiceability(){
  const today = new Date();
  renderTableRows("serviceTable", serviceChecks, 6, "No serviceability checks found", x => {
    const days = daysUntil(x.next_due_date, today);
    return `<tr class="${dueRowClass(days)}"><td>${escapeHtml(x.kit_type)}</td><td>${escapeHtml(x.kit_number)}</td><td>${escapeHtml(x.last_check_date)}</td><td>${escapeHtml(x.next_due_date)}</td><td>${days}</td><td><button class="danger" onclick="deleteServiceCheck('${x.id}')">Delete</button></td></tr>`;
  });
}
async function deleteServiceCheck(id){
  const {error} = await supabaseClient.from("serviceability_checks").delete().eq("id", id);
  if(error){ console.error(error); alert("Could not delete service check."); return; }
  await loadServiceChecks();
}
async function loadTempPasswords(showAlert=false){
  const {data,error} = await supabaseClient.rpc("list_temporary_credentials");
  if(error){ console.error(error); if(showAlert) alert("Could not load temporary access."); return; }
  tempPasswords = data || []; renderTempPasswords();
}
function renderTempPasswords(){
  renderTableRows("tempPasswordTable", tempPasswords, 5, "No temporary access found", x => `<tr><td>${escapeHtml(x.username)}</td><td>${escapeHtml(x.note)}</td><td>${formatDate(x.expires_at)}</td><td>${x.active ? "Yes" : "No"}</td><td>${x.active ? `<button class="danger" onclick="disableTempPassword('${x.id}')">Disable</button>` : "Disabled"}</td></tr>`);
}
async function createTempPassword(){
  const username = document.getElementById("tempUsername").value.trim();
  const password = document.getElementById("tempPassword").value;
  const note = document.getElementById("tempNote").value.trim();
  const expiry = document.getElementById("tempExpiry").value;
  if(username.length < 3 || password.length < 6 || !expiry){alert("Enter a username, a password of at least 6 characters, and an expiry date/time.");return;}
  const {error} = await supabaseClient.rpc("create_temporary_credential", {
    p_username:username,
    p_password:password,
    p_note:note,
    p_expires_at:new Date(expiry).toISOString()
  });
  if(error){ console.error(error); alert(error.message || "Could not create temporary access."); return; }
  setFieldValues({tempUsername:"", tempPassword:"", tempNote:"", tempExpiry:""});
  alert("Temporary access created.");
  await loadTempPasswords();
}
async function disableTempPassword(id){
  const {error} = await supabaseClient.rpc("disable_temporary_credential", {p_id:id});
  if(error){ console.error(error); alert("Could not disable temporary access."); return; }
  await loadTempPasswords();
}
function saveSerialRules(){
  localStorage.setItem("serialRules", JSON.stringify(serialRules));
}

function saveSerialRule(){
  const kitType = document.getElementById("serialKitType").value.trim();
  const prefix = document.getElementById("serialPrefix").value.trim();
  const nextNumber = Number(document.getElementById("serialNextNumber").value || 1);
  const padding = Number(document.getElementById("serialPadding").value || 3);

  if(!kitType || !prefix){
    alert("Enter the AT kit item type and prefix.");
    return;
  }

  const existing = serialRules.find(rule => rule.kitType.toLowerCase() === kitType.toLowerCase());

  if(existing){
    existing.kitType = kitType;
    existing.prefix = prefix;
    existing.nextNumber = isNaN(nextNumber) || nextNumber < 1 ? 1 : nextNumber;
    existing.padding = isNaN(padding) || padding < 1 ? 3 : padding;
  }else{
    serialRules.push({
      kitType,
      prefix,
      nextNumber:isNaN(nextNumber) || nextNumber < 1 ? 1 : nextNumber,
      padding:isNaN(padding) || padding < 1 ? 3 : padding
    });
  }

  saveSerialRules();

  document.getElementById("serialKitType").value = "";
  document.getElementById("serialPrefix").value = "";
  document.getElementById("serialNextNumber").value = "1";
  document.getElementById("serialPadding").value = "3";

  renderSerialRules();
  populateATBulkTypeDropdown();
  showNextATSerialPreview();
}

function renderSerialRules(){
  const rows = serialRules
    .slice()
    .sort((a,b) => a.kitType.localeCompare(b.kitType));
  renderTableRows("serialRulesTable", rows, 6, "No serial number rules created yet.", rule => `
    <tr>
      <td>${escapeHtml(rule.kitType)}</td>
      <td>${escapeHtml(rule.prefix)}</td>
      <td>${escapeHtml(rule.nextNumber)}</td>
      <td>${escapeHtml(rule.padding)}</td>
      <td>${escapeHtml(formatSerial(rule))}</td>
      <td><button class="danger" onclick="deleteSerialRule('${escapeHtml(rule.kitType)}')">Delete</button></td>
    </tr>
  `);
}

function deleteSerialRule(kitType){
  if(!confirm("Delete this serial number rule?")) return;
  serialRules = serialRules.filter(rule => rule.kitType !== kitType);
  saveSerialRules();
  renderSerialRules();
  populateATBulkTypeDropdown();
  showNextATSerialPreview();
}

function formatSerial(rule, offset=0){
  const number = Number(rule.nextNumber || 1) + offset;
  const padding = Number(rule.padding || 3);
  return `${rule.prefix}${String(number).padStart(padding, "0")}`;
}

function populateUniformBulkDropdowns(){
  const itemSelect = document.getElementById("uniformBulkItem");
  const boxSelect = document.getElementById("uniformBulkBox");
  if(!itemSelect || !boxSelect) return;

  const items = uniqueSorted(uniformStock.map(row => row.item));
  const boxes = uniqueSorted(uniformStock.map(row => row.box_number), (a,b) => String(a).localeCompare(String(b), undefined, {numeric:true}));
  populateSelect("uniformBulkItem", "Select uniform item", items, x => x, x => x, true);
  populateSelect("uniformBulkBox", "Select box number", boxes, x => x, x => x, true);
}

function addUniformBulkRow(){
  const item = document.getElementById("uniformBulkItem").value;
  const box = document.getElementById("uniformBulkBox").value;
  const quantity = Number(document.getElementById("uniformBulkQty").value || 1);

  if(!item || !box || quantity < 1){
    alert("Select an item, select a box, and enter a quantity.");
    return;
  }

  uniformBulkRows.push({id:Date.now()+Math.random(), item, box, quantity});
  document.getElementById("uniformBulkQty").value = "1";
  renderUniformBulkTable();
}

function renderUniformBulkTable(){
  renderTableRows("uniformBulkTable", uniformBulkRows, 4, "No uniform bulk rows added yet.", row => `
    <tr>
      <td>${escapeHtml(row.item)}</td>
      <td>${escapeHtml(row.box)}</td>
      <td>${escapeHtml(row.quantity)}</td>
      <td><button class="danger" onclick="removeUniformBulkRow('${row.id}')">Remove</button></td>
    </tr>
  `);
}

function removeUniformBulkRow(id){
  uniformBulkRows = withoutId(uniformBulkRows, id);
  renderUniformBulkTable();
}

function clearUniformBulkTable(){
  uniformBulkRows = [];
  renderUniformBulkTable();
}

async function saveUniformBulkTable(){
  if(!uniformBulkRows.length){
    alert("Add rows to the bulk table first.");
    return;
  }

  let updated = 0;
  let skipped = 0;

  for(const row of uniformBulkRows){
    const matches = uniformStock.filter(stock =>
      String(stock.item || "") === String(row.item) &&
      String(stock.box_number || "") === String(row.box)
    );

    if(!matches.length){
      skipped++;
      continue;
    }

    // If several sizes exist in the same box for the same item, use the first match.
    const stock = matches[0];
    const newQty = Number(stock.quantity || 0) + Number(row.quantity || 0);

    const {error} = await supabaseClient.from("uniform_stock").update({
      quantity:newQty,
      updated_at:todayISO()
    }).eq("id", stock.id);

    if(error){
      console.error(error);
      alert("Bulk uniform save failed on: " + row.item + " / " + row.box);
      return;
    }

    updated++;
  }

  uniformBulkRows = [];
  await loadUniformStock();
  renderUniformBulkTable();

  alert(`Bulk uniform update complete. Updated: ${updated}. Skipped: ${skipped}.`);
}

function populateATBulkTypeDropdown(){
  const rows = serialRules
    .slice()
    .sort((a,b) => a.kitType.localeCompare(b.kitType));
  populateSelect("atBulkType", "Select AT kit item", rows, rule => rule.kitType, rule => rule.kitType, true);
}

function showNextATSerialPreview(){
  const type = document.getElementById("atBulkType")?.value || "";
  const box = document.getElementById("atSerialPreview");
  if(!box) return;

  if(!type){
    box.innerHTML = "Select a kit item to preview the next identifying number.";
    return;
  }

  const rule = serialRules.find(rule => rule.kitType === type);
  if(!rule){
    box.innerHTML = "No serial rule found for this item. Create one on the AT Serial Numbers page first.";
    return;
  }

  const qty = Number(document.getElementById("atBulkQuantity")?.value || 1);
  const preview = [];
  for(let i=0; i<Math.min(qty, 10); i++){
    preview.push(formatSerial(rule, i));
  }

  box.innerHTML = `<strong>Next identifying number:</strong> ${escapeHtml(formatSerial(rule))}<br><strong>Preview:</strong> ${escapeHtml(preview.join(", "))}${qty > 10 ? " ..." : ""}`;
}

function addATBulkRows(){
  const type = document.getElementById("atBulkType").value;
  const size = document.getElementById("atBulkSize").value.trim();
  const notes = document.getElementById("atBulkNotes").value.trim();
  const quantity = Number(document.getElementById("atBulkQuantity").value || 1);

  if(!type || quantity < 1){
    alert("Select a kit item and enter a quantity.");
    return;
  }

  const rule = serialRules.find(rule => rule.kitType === type);
  if(!rule){
    alert("No serial number rule exists for this kit item. Create one on the AT Serial Numbers page first.");
    return;
  }

  for(let i=0; i<quantity; i++){
    atBulkRows.push({
      id:Date.now()+Math.random()+i,
      kit_type:type,
      kit_number:formatSerial(rule, i),
      size,
      notes
    });
  }

  document.getElementById("atBulkQuantity").value = "1";
  renderATBulkTable();
}

function renderATBulkTable(){
  renderTableRows("atBulkTable", atBulkRows, 5, "No AT bulk rows added yet.", row => `
    <tr>
      <td>${escapeHtml(row.kit_type)}</td>
      <td>${escapeHtml(row.kit_number)}</td>
      <td>${escapeHtml(row.size)}</td>
      <td>${escapeHtml(row.notes)}</td>
      <td><button class="danger" onclick="removeATBulkRow('${row.id}')">Remove</button></td>
    </tr>
  `);
}

function removeATBulkRow(id){
  atBulkRows = withoutId(atBulkRows, id);
  renderATBulkTable();
}

function clearATBulkTable(){
  atBulkRows = [];
  renderATBulkTable();
}

async function saveATBulkTable(){
  if(!atBulkRows.length){
    alert("Add rows to the AT bulk table first.");
    return;
  }

  const duplicate = atBulkRows.find(row => atKit.some(existing => existing.kit_number === row.kit_number));
  if(duplicate){
    alert("Identifying number already exists: " + duplicate.kit_number);
    return;
  }

  const records = atBulkRows.map(row => ({
    kit_type:row.kit_type,
    kit_number:row.kit_number,
    size:row.size,
    location:"",
    condition:"Good",
    notes:row.notes,
    status:"Available"
  }));

  const {error} = await supabaseClient.from("at_kit").insert(records);
  if(error){
    console.error(error);
    alert("Could not save AT bulk kit.");
    return;
  }

  // Advance serial numbers only after successful insert
  atBulkRows.forEach(row => {
    const rule = serialRules.find(rule => rule.kitType === row.kit_type);
    if(rule){
      rule.nextNumber = Number(rule.nextNumber || 1) + 1;
    }
  });

  saveSerialRules();
  atBulkRows = [];

  await loadATKit();
  renderATBulkTable();
  renderSerialRules();
  showNextATSerialPreview();

  alert("AT bulk kit saved successfully.");
}



function toggleMobileMenu(){ document.querySelector("nav")?.classList.toggle("open"); }
function setText(id, value){ const el = document.getElementById(id); if(el) el.textContent = value; }
function daysUntil(dateValue, fromDate=new Date()){ if(!dateValue) return 9999; return Math.ceil((new Date(dateValue) - fromDate) / DAY_MS); }
function dueRowClass(days){ return days <= 0 ? "out-row" : days <= 30 ? "low-row" : "good-row"; }

function renderMainDashboard(){
  setText("dashUniformRequests", uniformRequests.filter(x => (x.status || "Pending") === "Pending").length);
  setText("dashATRequests", atRequests.filter(x => (x.status || "Pending") === "Pending").length);
  setText("dashATOut", atIssues.filter(x => !x.returned).length);
  setText("dashLowStock", uniformStock.filter(x => Number(x.quantity || 0) <= Number(x.warning_level || 1)).length);
  setText("dashInspectionsDue", inspectionRecords.filter(x => daysUntil(x.next_due_date) <= 30).length);
  setText("dashEvents", kitEvents.length);
}

function createEvent(){
  const name = document.getElementById("eventNameInput").value.trim();
  const date = document.getElementById("eventDateInput").value;
  const location = document.getElementById("eventLocationInput").value.trim();
  if(!name){ alert("Enter an event name."); return; }
  kitEvents.push({id:Date.now()+Math.random(), name, date, location, cadets:[]});
  saveLocal();
  setFieldValues({eventNameInput:"", eventDateInput:"", eventLocationInput:""});
  populateEventDashboardSelect();
  renderMainDashboard();
  alert("Event created.");
}

function populateEventDashboardSelect(){
  populateSelect("eventDashboardSelect", "Select event", kitEvents, event => event.id, event => `${event.name} ${event.date ? "- " + event.date : ""}`, true);
}

function loadEventDashboard(){ renderEventDashboard(); }

function addCadetToEvent(){
  const eventId = document.getElementById("eventDashboardSelect").value;
  const cadet = document.getElementById("eventCadetInput").value.trim();
  if(!eventId || !cadet){ alert("Select an event and enter a cadet name."); return; }
  const event = findById(kitEvents, eventId); if(!event) return;
  if(!event.cadets.includes(cadet)) event.cadets.push(cadet);
  eventCadets[eventId] = event.cadets;
  saveLocal();
  document.getElementById("eventCadetInput").value = "";
  renderEventDashboard();
}

function renderEventDashboard(){
  const table = document.getElementById("eventCadetsDashboardTable"); if(!table) return;
  const eventId = document.getElementById("eventDashboardSelect")?.value || "";
  const event = findById(kitEvents, eventId);
  if(!event){
    table.innerHTML = `<tr><td colspan="4" class="no-data">Select an event.</td></tr>`;
    setText("eventCadetCount", 0); setText("eventIssuedCount", 0); setText("eventReturnedCount", 0); setText("eventOutstandingCount", 0);
    return;
  }
  const eventIssues = atIssues.filter(x => x.event_name === event.name);
  setText("eventCadetCount", event.cadets.length);
  setText("eventIssuedCount", eventIssues.length);
  setText("eventReturnedCount", eventIssues.filter(x => x.returned).length);
  setText("eventOutstandingCount", eventIssues.filter(x => !x.returned).length);
  renderTableRows("eventCadetsDashboardTable", event.cadets, 4, "No cadets added to this event.", cadet => {
    const cadetOutstanding = eventIssues.filter(x => x.cadet_name === cadet && !x.returned).map(x => `${x.kit_type} ${x.kit_number}`).join(", ");
    return `<tr><td>${escapeHtml(cadet)}</td><td><button onclick="startEventIssueForCadet('${event.id}', '${escapeHtml(cadet)}')">Issue Kit</button></td><td>${escapeHtml(cadetOutstanding || "None")}</td><td><button class="danger" onclick="removeCadetFromEvent('${event.id}', '${escapeHtml(cadet)}')">Remove</button></td></tr>`;
  });
}

function startEventIssueForCadet(eventId, cadet){
  const event = findById(kitEvents, eventId); if(!event) return;
  showStaffPage("atIssuePage");
  document.getElementById("atIssueCadet").value = cadet;
  document.getElementById("atIssueEvent").value = event.name;
}

function removeCadetFromEvent(eventId, cadet){
  const event = findById(kitEvents, eventId); if(!event) return;
  if(!confirm("Remove this cadet from the event?")) return;
  event.cadets = event.cadets.filter(x => x !== cadet);
  eventCadets[eventId] = event.cadets;
  saveLocal(); renderEventDashboard();
}

function renderMissingKitDashboard(){
  const outstandingIssues = atIssues.filter(issue => !issue.returned);
  const rows = filterBySearch(outstandingIssues, "missingKitSearch", ["cadet_name", "event_name", "kit_type", "kit_number"]);
  renderTableRows("missingKitTable", rows, 7, "No missing or outstanding kit.", x => {
    const daysOut = Math.max(0, Math.ceil((new Date() - new Date(x.issued_at || x.created_at)) / DAY_MS));
    return `<tr class="${daysOut > 30 ? "low-row" : ""}"><td>${escapeHtml(x.cadet_name)}</td><td>${escapeHtml(x.event_name)}</td><td>${escapeHtml(x.kit_type)}</td><td>${escapeHtml(x.kit_number)}</td><td>${formatDate(x.issued_at || x.created_at)}</td><td>${daysOut}</td><td><button onclick="returnATKit('${x.id}')">Mark Returned</button></td></tr>`;
  });
}

function renderBorrowStats(){
  const table = document.getElementById("borrowStatsTable"); if(!table) return;
  const stats = {};
  atIssues.forEach(issue => {
    const key = `${issue.kit_type || ""}|${issue.kit_number || ""}`;
    if(!stats[key]) stats[key] = {kit_type:issue.kit_type, kit_number:issue.kit_number, count:0, currentlyIssued:false, lastIssued:""};
    stats[key].count++;
    if(!issue.returned) stats[key].currentlyIssued = true;
    const issuedDate = issue.issued_at || issue.created_at || "";
    if(!stats[key].lastIssued || new Date(issuedDate) > new Date(stats[key].lastIssued)) stats[key].lastIssued = issuedDate;
  });
  const rows = Object.values(stats).sort((a,b) => b.count - a.count);
  renderTableRows("borrowStatsTable", rows, 5, "No borrowing data yet.", row => `<tr><td>${escapeHtml(row.kit_type)}</td><td>${escapeHtml(row.kit_number)}</td><td>${row.count}</td><td>${row.currentlyIssued ? "Yes" : "No"}</td><td>${formatDate(row.lastIssued)}</td></tr>`);
}

function populateInspectionKitDropdown(){
  populateATKitSelect("inspectionKitSelect", true);
}

function saveInspectionRecord(){
  const kitId = document.getElementById("inspectionKitSelect").value;
  const date = document.getElementById("inspectionDate").value;
  const interval = Number(document.getElementById("inspectionInterval").value || 365);
  const inspector = document.getElementById("inspectionInspector").value.trim();
  const condition = document.getElementById("inspectionCondition").value.trim();
  const kit = findById(atKit, kitId);
  if(!kit || !date){ alert("Select a kit item and inspection date."); return; }
  const next = new Date(date); next.setDate(next.getDate() + interval);
  inspectionRecords.push({id:Date.now()+Math.random(), kit_id:kit.id, kit_type:kit.kit_type, kit_number:kit.kit_number, last_check_date:date, next_due_date:next.toISOString().slice(0,10), inspector, condition});
  saveLocal();
  setFieldValues({inspectionKitSelect:"", inspectionDate:"", inspectionInterval:"365", inspectionInspector:"", inspectionCondition:""});
  renderInspectionSystem(); renderMainDashboard();
}

function renderInspectionSystem(){
  const rows = inspectionRecords.slice().sort((a,b) => new Date(a.next_due_date) - new Date(b.next_due_date));
  renderTableRows("inspectionTable", rows, 8, "No inspection records yet.", row => {
    const days = daysUntil(row.next_due_date);
    return `<tr class="${dueRowClass(days)}"><td>${escapeHtml(row.kit_type)}</td><td>${escapeHtml(row.kit_number)}</td><td>${escapeHtml(row.last_check_date)}</td><td>${escapeHtml(row.next_due_date)}</td><td>${days}</td><td>${escapeHtml(row.inspector)}</td><td>${escapeHtml(row.condition)}</td><td><button class="danger" onclick="deleteInspectionRecord('${row.id}')">Delete</button></td></tr>`;
  });
}

function deleteInspectionRecord(id){
  if(!confirm("Delete this inspection record?")) return;
  inspectionRecords = withoutId(inspectionRecords, id);
  saveLocal(); renderInspectionSystem(); renderMainDashboard();
}

function renderLowStockOrderingList(){
  const table = document.getElementById("lowStockTable");
  const output = document.getElementById("lowStockTextOutput");
  if(!table || !output) return;
  const rows = uniformStock.filter(x => Number(x.quantity || 0) <= Number(x.warning_level || 1)).sort((a,b) => String(a.item).localeCompare(String(b.item)) || String(a.size).localeCompare(String(b.size)));
  const lines = [];
  renderTableRows("lowStockTable", rows, 6, "No low stock items.", row => {
    const qty = Number(row.quantity || 0);
    const min = Number(row.warning_level || 1);
    const suggested = Math.max(1, (min * 2) - qty);
    lines.push(`${row.item} | Size: ${row.size} | Box: ${row.box_number || ""} | Current: ${qty} | Suggested order: ${suggested}`);
    return `<tr class="${qty <= 0 ? "out-row" : "low-row"}"><td>${escapeHtml(row.item)}</td><td>${escapeHtml(row.size)}</td><td>${escapeHtml(row.box_number)}</td><td>${qty}</td><td>${min}</td><td>${suggested}</td></tr>`;
  });
  output.value = lines.join("\\n");
}

function copyLowStockList(){
  const output = document.getElementById("lowStockTextOutput");
  if(!output || !output.value){ alert("Generate the low stock list first."); return; }
  output.select();
  document.execCommand("copy");
  alert("Low stock list copied.");
}


window.addEventListener("hashchange", () => {
  const staffApp = document.getElementById("staffApp");
  if(staffApp?.classList.contains("active")){
    showStaffPage(routeToPage(location.hash.replace("#", "")));
  }
});

document.addEventListener("DOMContentLoaded", () => {
  restoreStaffSession();
});
