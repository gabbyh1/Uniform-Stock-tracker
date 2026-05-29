const SUPABASE_URL = "https://oskorapwgvoecvtdtkwi.supabase.co";
const SUPABASE_KEY = "sb_publishable_Zm5qgcsjzsuzicBwa6Z0sA_qgn-Gm5R";

let supabaseClient = null;

if(window.supabase){
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}else{
  alert("Supabase did not load. Check your internet connection.");
}

const STAFF_PASSWORD = "1384-Staff";

let uniformStock = [];
let uniformIssues = [];
let uniformRequests = [];

let atKit = [];
let atIssues = [];
let atRequests = [];

let kitLists = [];
let kitListItems = [];

let serviceChecks = [];
let temporaryPasswords = [];

let borrowCounts = {};

let eventCadets = JSON.parse(localStorage.getItem("eventCadets") || "{}");
let eventIssueRows = JSON.parse(localStorage.getItem("eventIssueRows") || "[]");
let checkerData = JSON.parse(localStorage.getItem("checkerData") || "{}");

let selectedEventIssueListId = "";
let selectedCheckerListId = "";
let modalCadet = "";

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function formatDate(value){
  if(!value) return "";

  try{
    return new Date(value).toLocaleString("en-GB");
  }catch{
    return value;
  }
}

function todayISO(){
  return new Date().toISOString();
}

function saveLocal(){
  localStorage.setItem("eventCadets", JSON.stringify(eventCadets));
  localStorage.setItem("eventIssueRows", JSON.stringify(eventIssueRows));
  localStorage.setItem("checkerData", JSON.stringify(checkerData));
}

function hideAll(){
  [
    "homeScreen",
    "staffLoginScreen",
    "staffApp",
    "cadetUniformPortal",
    "cadetATPortal",
    "kitIssueModal"
  ].forEach(id => {
    const element = document.getElementById(id);

    if(element){
      element.classList.add("hidden");
      element.style.display = "";
    }
  });
}

function backHome(){
  hideAll();

  const home = document.getElementById("homeScreen");

  if(home){
    home.classList.remove("hidden");
  }
}

function openStaffLogin(){
  hideAll();

  const screen = document.getElementById("staffLoginScreen");

  if(screen){
    screen.classList.remove("hidden");
  }
}

async function openCadetUniformPortal(){
  hideAll();

  const portal = document.getElementById("cadetUniformPortal");

  if(portal){
    portal.classList.remove("hidden");
  }

  if(supabaseClient){
    await loadUniformStock();
    populateCadetUniformItems();
  }
}

async function openCadetATPortal(){
  hideAll();

  const portal = document.getElementById("cadetATPortal");

  if(portal){
    portal.classList.remove("hidden");
  }

  if(supabaseClient){
    await loadKitLists();
    populateCadetATEvents();
  }
}

function logout(){
  backHome();
}

async function staffLogin(){
  const entered = document.getElementById("staffPasswordInput").value.trim();

  if(entered === STAFF_PASSWORD){
    await openStaffApp("Staff Account");
    return;
  }

  if(!supabaseClient){
    alert("Database not connected.");
    return;
  }

  const { data, error } = await supabaseClient
    .from("temporary_passwords")
    .select("*")
    .eq("password", entered)
    .eq("active", true);

  if(error){
    console.error(error);
    alert("Could not check temporary passwords.");
    return;
  }

  const now = new Date();

  const validPassword = (data || []).find(row =>
    row.expires_at &&
    new Date(row.expires_at) > now
  );

  if(validPassword){
    await openStaffApp("Temporary Access");
    return;
  }

  alert("Incorrect or expired password");
}

async function openStaffApp(label){
  hideAll();

  const app = document.getElementById("staffApp");

  if(app){
    app.classList.remove("hidden");
  }

  const labelBox = document.getElementById("loggedInLabel");

  if(labelBox){
    labelBox.innerText = label;
  }

  if(supabaseClient){
    await loadAll();
  }

  showStaffPage("uniformStockPage");
}

async function loadAll(){
  await loadUniformStock();
  await loadUniformIssues();
  await loadUniformRequests();

  await loadATKit();
  await loadATIssues();
  await loadATRequests();

  await loadKitLists();
  await loadServiceChecks();
  await loadTemporaryPasswords();

  populateUniformIssueItems();
  populateATIssueTypes();
  populateKitListSelects();
  populateEventIssueLists();
  populateCheckerLists();
  populateCadetUniformItems();
  populateCadetATEvents();
}

function showStaffPage(id){
  document.querySelectorAll(".staff-page").forEach(page => {
    page.classList.remove("active-page");
  });

  const page = document.getElementById(id);

  if(page){
    page.classList.add("active-page");
  }

  if(id === "uniformStockPage"){
    renderUniformStock();
  }

  if(id === "uniformIssuedPage"){
    populateUniformIssueItems();
    renderUniformIssues();
  }

  if(id === "uniformRequestsPage"){
    renderUniformRequests();
  }

  if(id === "atStockPage"){
    renderATKit();
  }

  if(id === "atIssuePage"){
    populateATIssueTypes();
    renderATIssues();
  }

  if(id === "kitListPage"){
    populateKitListSelects();
    renderKitListItems();
  }

  if(id === "eventIssuePage"){
    populateEventIssueLists();
    loadEventIssueSheet();
  }

  if(id === "kitCheckerPage"){
    populateCheckerLists();
    loadKitChecker();
  }

  if(id === "serviceabilityPage"){
    renderServiceability();
  }

  if(id === "atRequestsPage"){
    renderATRequests();
  }

  if(id === "tempPasswordPage"){
    loadTemporaryPasswords();
  }
}
/* UNIFORM STOCK */

async function loadUniformStock(){
  if(!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("uniform_stock")
    .select("*")
    .order("item", { ascending:true })
    .order("size", { ascending:true });

  if(error){
    console.error(error);
    alert("Error loading uniform stock.");
    return;
  }

  uniformStock = data || [];
  renderUniformStock();
  populateUniformIssueItems();
  populateCadetUniformItems();
}

function renderUniformStock(){
  const table = document.getElementById("uniformStockTable");
  if(!table) return;

  const search = (document.getElementById("uniformStockSearch")?.value || "").toLowerCase();

  const rows = uniformStock.filter(item =>
    String(item.item || "").toLowerCase().includes(search) ||
    String(item.size || "").toLowerCase().includes(search) ||
    String(item.box_number || "").toLowerCase().includes(search)
  );

  table.innerHTML = "";

  if(rows.length === 0){
    table.innerHTML = `
      <tr>
        <td colspan="6" class="no-data">No uniform stock found</td>
      </tr>
    `;
    return;
  }

  rows.forEach(item => {
    const quantity = Number(item.quantity || 0);
    const warning = Number(item.warning_level || 1);

    let rowClass = "";

    if(quantity <= 0){
      rowClass = "out-stock";
    }else if(quantity <= warning){
      rowClass = "low-stock";
    }

    table.innerHTML += `
      <tr class="${rowClass}">
        <td>${escapeHtml(item.item)}</td>
        <td>${escapeHtml(item.size)}</td>
        <td>${escapeHtml(item.box_number)}</td>
        <td>${escapeHtml(quantity)}</td>
        <td>
          <button class="small-btn edit-btn" onclick="quickUniformStock('${item.id}', -1)">-1</button>
          <button class="small-btn edit-btn" onclick="quickUniformStock('${item.id}', 1)">+1</button>
          <button class="small-btn edit-btn" onclick="setUniformStock('${item.id}')">Set</button>
        </td>
        <td>
          <button class="small-btn delete-btn" onclick="deleteUniformStock('${item.id}')">Delete</button>
        </td>
      </tr>
    `;
  });
}

async function addUniformStock(){
  const item = document.getElementById("newUniformItem").value.trim();
  const size = document.getElementById("newUniformSize").value.trim();
  const box = document.getElementById("newUniformBox").value.trim();
  const quantity = Number(document.getElementById("newUniformQuantity").value || 0);
  const warning = Number(document.getElementById("newUniformWarning").value || 1);

  if(!item || !size){
    alert("Enter the uniform item and size.");
    return;
  }

  const { error } = await supabaseClient
    .from("uniform_stock")
    .insert([{
      item,
      size,
      box_number: box,
      quantity,
      warning_level: warning
    }]);

  if(error){
    console.error(error);
    alert("Could not add uniform stock.");
    return;
  }

  document.getElementById("newUniformItem").value = "";
  document.getElementById("newUniformSize").value = "";
  document.getElementById("newUniformBox").value = "";
  document.getElementById("newUniformQuantity").value = "";
  document.getElementById("newUniformWarning").value = "1";

  await loadUniformStock();
}

async function quickUniformStock(id, change){
  const item = uniformStock.find(row => String(row.id) === String(id));

  if(!item){
    alert("Stock item not found.");
    return;
  }

  let newQuantity = Number(item.quantity || 0) + change;

  if(newQuantity < 0){
    newQuantity = 0;
  }

  const { error } = await supabaseClient
    .from("uniform_stock")
    .update({
      quantity: newQuantity,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if(error){
    console.error(error);
    alert("Could not update stock.");
    return;
  }

  await loadUniformStock();
}

async function setUniformStock(id){
  const item = uniformStock.find(row => String(row.id) === String(id));

  if(!item){
    alert("Stock item not found.");
    return;
  }

  const value = prompt("Enter new stock quantity:", item.quantity || 0);

  if(value === null){
    return;
  }

  const number = Number(value);

  if(isNaN(number) || number < 0){
    alert("Enter a valid number.");
    return;
  }

  const { error } = await supabaseClient
    .from("uniform_stock")
    .update({
      quantity: number,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if(error){
    console.error(error);
    alert("Could not set stock.");
    return;
  }

  await loadUniformStock();
}

async function deleteUniformStock(id){
  if(!confirm("Delete this uniform stock item?")){
    return;
  }

  const { error } = await supabaseClient
    .from("uniform_stock")
    .delete()
    .eq("id", id);

  if(error){
    console.error(error);
    alert("Could not delete uniform stock.");
    return;
  }

  await loadUniformStock();
}

function populateUniformIssueItems(){
  const dropdown = document.getElementById("issueUniformItem");
  if(!dropdown) return;

  const currentValue = dropdown.value;

  dropdown.innerHTML = `<option value="">Select item</option>`;

  const items = [...new Set(uniformStock.map(row => row.item))]
    .filter(Boolean)
    .sort();

  items.forEach(item => {
    dropdown.innerHTML += `
      <option value="${escapeHtml(item)}">${escapeHtml(item)}</option>
    `;
  });

  dropdown.value = currentValue;
}

function populateUniformIssueSizes(){
  const item = document.getElementById("issueUniformItem").value;
  const dropdown = document.getElementById("issueUniformSize");

  if(!dropdown) return;

  dropdown.innerHTML = `<option value="">Select size</option>`;

  const sizes = [...new Set(
    uniformStock
      .filter(row => row.item === item)
      .map(row => row.size)
  )]
    .filter(Boolean)
    .sort();

  sizes.forEach(size => {
    dropdown.innerHTML += `
      <option value="${escapeHtml(size)}">${escapeHtml(size)}</option>
    `;
  });

  showUniformIssueInfo();
}

function showUniformIssueInfo(){
  const item = document.getElementById("issueUniformItem").value;
  const size = document.getElementById("issueUniformSize").value;
  const box = document.getElementById("uniformIssueInfo");

  if(!box) return;

  if(!item || !size){
    box.innerHTML = "Select an item and size.";
    return;
  }

  const matches = uniformStock.filter(row =>
    row.item === item &&
    row.size === size
  );

  const total = matches.reduce((sum, row) => {
    return sum + Number(row.quantity || 0);
  }, 0);

  box.innerHTML = `
    <strong>Total Available:</strong> ${total}<br>
    <strong>Boxes:</strong><br>
    ${matches.map(row => `${escapeHtml(row.box_number || "No box")} - Qty ${escapeHtml(row.quantity || 0)}`).join("<br>")}
  `;
}
/* UNIFORM STOCK */

async function loadUniformStock(){
  if(!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("uniform_stock")
    .select("*")
    .order("item", { ascending:true })
    .order("size", { ascending:true });

  if(error){
    console.error(error);
    alert("Error loading uniform stock.");
    return;
  }

  uniformStock = data || [];
  renderUniformStock();
  populateUniformIssueItems();
  populateCadetUniformItems();
}

function renderUniformStock(){
  const table = document.getElementById("uniformStockTable");
  if(!table) return;

  const search = (document.getElementById("uniformStockSearch")?.value || "").toLowerCase();

  const rows = uniformStock.filter(item =>
    String(item.item || "").toLowerCase().includes(search) ||
    String(item.size || "").toLowerCase().includes(search) ||
    String(item.box_number || "").toLowerCase().includes(search)
  );

  table.innerHTML = "";

  if(rows.length === 0){
    table.innerHTML = `
      <tr>
        <td colspan="6" class="no-data">No uniform stock found</td>
      </tr>
    `;
    return;
  }

  rows.forEach(item => {
    const quantity = Number(item.quantity || 0);
    const warning = Number(item.warning_level || 1);

    let rowClass = "";

    if(quantity <= 0){
      rowClass = "out-stock";
    }else if(quantity <= warning){
      rowClass = "low-stock";
    }

    table.innerHTML += `
      <tr class="${rowClass}">
        <td>${escapeHtml(item.item)}</td>
        <td>${escapeHtml(item.size)}</td>
        <td>${escapeHtml(item.box_number)}</td>
        <td>${escapeHtml(quantity)}</td>
        <td>
          <button class="small-btn edit-btn" onclick="quickUniformStock('${item.id}', -1)">-1</button>
          <button class="small-btn edit-btn" onclick="quickUniformStock('${item.id}', 1)">+1</button>
          <button class="small-btn edit-btn" onclick="setUniformStock('${item.id}')">Set</button>
        </td>
        <td>
          <button class="small-btn delete-btn" onclick="deleteUniformStock('${item.id}')">Delete</button>
        </td>
      </tr>
    `;
  });
}

async function addUniformStock(){
  const item = document.getElementById("newUniformItem").value.trim();
  const size = document.getElementById("newUniformSize").value.trim();
  const box = document.getElementById("newUniformBox").value.trim();
  const quantity = Number(document.getElementById("newUniformQuantity").value || 0);
  const warning = Number(document.getElementById("newUniformWarning").value || 1);

  if(!item || !size){
    alert("Enter the uniform item and size.");
    return;
  }

  const { error } = await supabaseClient
    .from("uniform_stock")
    .insert([{
      item,
      size,
      box_number: box,
      quantity,
      warning_level: warning
    }]);

  if(error){
    console.error(error);
    alert("Could not add uniform stock.");
    return;
  }

  document.getElementById("newUniformItem").value = "";
  document.getElementById("newUniformSize").value = "";
  document.getElementById("newUniformBox").value = "";
  document.getElementById("newUniformQuantity").value = "";
  document.getElementById("newUniformWarning").value = "1";

  await loadUniformStock();
}

async function quickUniformStock(id, change){
  const item = uniformStock.find(row => String(row.id) === String(id));

  if(!item){
    alert("Stock item not found.");
    return;
  }

  let newQuantity = Number(item.quantity || 0) + change;

  if(newQuantity < 0){
    newQuantity = 0;
  }

  const { error } = await supabaseClient
    .from("uniform_stock")
    .update({
      quantity: newQuantity,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if(error){
    console.error(error);
    alert("Could not update stock.");
    return;
  }

  await loadUniformStock();
}

async function setUniformStock(id){
  const item = uniformStock.find(row => String(row.id) === String(id));

  if(!item){
    alert("Stock item not found.");
    return;
  }

  const value = prompt("Enter new stock quantity:", item.quantity || 0);

  if(value === null){
    return;
  }

  const number = Number(value);

  if(isNaN(number) || number < 0){
    alert("Enter a valid number.");
    return;
  }

  const { error } = await supabaseClient
    .from("uniform_stock")
    .update({
      quantity: number,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if(error){
    console.error(error);
    alert("Could not set stock.");
    return;
  }

  await loadUniformStock();
}

async function deleteUniformStock(id){
  if(!confirm("Delete this uniform stock item?")){
    return;
  }

  const { error } = await supabaseClient
    .from("uniform_stock")
    .delete()
    .eq("id", id);

  if(error){
    console.error(error);
    alert("Could not delete uniform stock.");
    return;
  }

  await loadUniformStock();
}

function populateUniformIssueItems(){
  const dropdown = document.getElementById("issueUniformItem");
  if(!dropdown) return;

  const currentValue = dropdown.value;

  dropdown.innerHTML = `<option value="">Select item</option>`;

  const items = [...new Set(uniformStock.map(row => row.item))]
    .filter(Boolean)
    .sort();

  items.forEach(item => {
    dropdown.innerHTML += `
      <option value="${escapeHtml(item)}">${escapeHtml(item)}</option>
    `;
  });

  dropdown.value = currentValue;
}

function populateUniformIssueSizes(){
  const item = document.getElementById("issueUniformItem").value;
  const dropdown = document.getElementById("issueUniformSize");

  if(!dropdown) return;

  dropdown.innerHTML = `<option value="">Select size</option>`;

  const sizes = [...new Set(
    uniformStock
      .filter(row => row.item === item)
      .map(row => row.size)
  )]
    .filter(Boolean)
    .sort();

  sizes.forEach(size => {
    dropdown.innerHTML += `
      <option value="${escapeHtml(size)}">${escapeHtml(size)}</option>
    `;
  });

  showUniformIssueInfo();
}

function showUniformIssueInfo(){
  const item = document.getElementById("issueUniformItem").value;
  const size = document.getElementById("issueUniformSize").value;
  const box = document.getElementById("uniformIssueInfo");

  if(!box) return;

  if(!item || !size){
    box.innerHTML = "Select an item and size.";
    return;
  }

  const matches = uniformStock.filter(row =>
    row.item === item &&
    row.size === size
  );

  const total = matches.reduce((sum, row) => {
    return sum + Number(row.quantity || 0);
  }, 0);

  box.innerHTML = `
    <strong>Total Available:</strong> ${total}<br>
    <strong>Boxes:</strong><br>
    ${matches.map(row => `${escapeHtml(row.box_number || "No box")} - Qty ${escapeHtml(row.quantity || 0)}`).join("<br>")}
  `;
}

/* UNIFORM ISSUE */

async function issueUniform(){
  const cadet = document.getElementById("issueUniformCadet").value.trim();
  const item = document.getElementById("issueUniformItem").value;
  const size = document.getElementById("issueUniformSize").value;
  const quantity = Number(document.getElementById("issueUniformQuantity").value || 1);

  if(!cadet || !item || !size || quantity < 1){
    alert("Complete all uniform issue fields.");
    return;
  }

  const matchingStock = uniformStock
    .filter(row =>
      row.item === item &&
      row.size === size &&
      Number(row.quantity || 0) > 0
    )
    .sort((a,b) => Number(b.quantity || 0) - Number(a.quantity || 0));

  let remaining = quantity;
  const issueRecords = [];

  for(const stockLine of matchingStock){
    if(remaining <= 0){
      break;
    }

    const available = Number(stockLine.quantity || 0);
    const taken = Math.min(available, remaining);
    const newQuantity = available - taken;

    const { error:updateError } = await supabaseClient
      .from("uniform_stock")
      .update({
        quantity: newQuantity,
        updated_at: new Date().toISOString()
      })
      .eq("id", stockLine.id);

    if(updateError){
      console.error(updateError);
      alert("Could not update uniform stock.");
      return;
    }

    issueRecords.push({
      cadet_name: cadet,
      item: stockLine.item,
      size: stockLine.size,
      box_number: stockLine.box_number,
      quantity: taken,
      issued_by: "Staff",
      returned: false
    });

    remaining -= taken;
  }

  if(remaining > 0){
    alert("Not enough stock available. Please check the stock table.");
    await loadUniformStock();
    return;
  }

  const { error:insertError } = await supabaseClient
    .from("uniform_issues")
    .insert(issueRecords);

  if(insertError){
    console.error(insertError);
    alert("Stock changed, but issue history did not save.");
    return;
  }

  alert("Uniform issued.");

  document.getElementById("issueUniformCadet").value = "";
  document.getElementById("issueUniformItem").value = "";
  document.getElementById("issueUniformSize").innerHTML = `<option value="">Select size</option>`;
  document.getElementById("issueUniformQuantity").value = "1";
  document.getElementById("uniformIssueInfo").innerHTML = "Select an item and size.";

  await loadUniformStock();
  await loadUniformIssues();
}

async function loadUniformIssues(){
  if(!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("uniform_issues")
    .select("*")
    .order("issue_date", { ascending:false });

  if(error){
    console.error(error);
    return;
  }

  uniformIssues = data || [];
  renderUniformIssues();
}

function renderUniformIssues(){
  const table = document.getElementById("uniformIssuedTable");
  if(!table) return;

  const search = (document.getElementById("uniformIssuedSearch")?.value || "").toLowerCase();

  const rows = uniformIssues.filter(row =>
    String(row.cadet_name || "").toLowerCase().includes(search) ||
    String(row.item || "").toLowerCase().includes(search) ||
    String(row.size || "").toLowerCase().includes(search) ||
    String(row.box_number || "").toLowerCase().includes(search)
  );

  table.innerHTML = "";

  if(rows.length === 0){
    table.innerHTML = `
      <tr>
        <td colspan="6" class="no-data">No uniform issue records found</td>
      </tr>
    `;
    return;
  }

  rows.forEach(row => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(row.cadet_name)}</td>
        <td>${escapeHtml(row.item)}</td>
        <td>${escapeHtml(row.size)}</td>
        <td>${escapeHtml(row.quantity)}</td>
        <td>${formatDate(row.issue_date || row.created_at)}</td>
        <td>${row.returned ? "Yes" : "No"}</td>
      </tr>
    `;
  });
}

/* UNIFORM REQUESTS */

async function loadUniformRequests(){
  if(!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("uniform_requests")
    .select("*")
    .order("requested_at", { ascending:false });

  if(error){
    console.error(error);
    return;
  }

  uniformRequests = data || [];
  renderUniformRequests();
}

function renderUniformRequests(){
  const table = document.getElementById("uniformRequestsTable");
  if(!table) return;

  table.innerHTML = "";

  if(uniformRequests.length === 0){
    table.innerHTML = `
      <tr>
        <td colspan="6" class="no-data">No uniform requests found</td>
      </tr>
    `;
    return;
  }

  uniformRequests.forEach(row => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(row.cadet_name)}</td>
        <td>${escapeHtml(row.item)}</td>
        <td>${escapeHtml(row.size)}</td>
        <td>${escapeHtml(row.reason)}</td>
        <td>${escapeHtml(row.status || "Pending")}</td>
        <td>${formatDate(row.requested_at || row.created_at)}</td>
      </tr>
    `;
  });
}

function populateCadetUniformItems(){
  const dropdown = document.getElementById("cadetUniformItem");
  if(!dropdown) return;

  dropdown.innerHTML = `<option value="">Select Item</option>`;

  const items = [...new Set(uniformStock.map(row => row.item))]
    .filter(Boolean)
    .sort();

  items.forEach(item => {
    dropdown.innerHTML += `
      <option value="${escapeHtml(item)}">${escapeHtml(item)}</option>
    `;
  });
}

function populateCadetUniformSizes(){
  const item = document.getElementById("cadetUniformItem").value;
  const dropdown = document.getElementById("cadetUniformSize");

  if(!dropdown) return;

  dropdown.innerHTML = `<option value="">Select Size</option>`;

  const sizes = [...new Set(
    uniformStock
      .filter(row => row.item === item)
      .map(row => row.size)
  )]
    .filter(Boolean)
    .sort();

  sizes.forEach(size => {
    dropdown.innerHTML += `
      <option value="${escapeHtml(size)}">${escapeHtml(size)}</option>
    `;
  });
}

async function submitCadetUniformRequest(){
  const cadet = document.getElementById("cadetUniformName").value.trim();
  const item = document.getElementById("cadetUniformItem").value;
  const size = document.getElementById("cadetUniformSize").value;
  const reason = document.getElementById("cadetUniformReason").value.trim();

  if(!cadet || !item || !size || !reason){
    alert("Complete all fields.");
    return;
  }

  const { error } = await supabaseClient
    .from("uniform_requests")
    .insert([{
      cadet_name: cadet,
      item,
      size,
      reason,
      status: "Pending"
    }]);

  if(error){
    console.error(error);
    alert("Could not submit uniform request.");
    return;
  }

  alert("Uniform request submitted.");

  document.getElementById("cadetUniformName").value = "";
  document.getElementById("cadetUniformItem").value = "";
  document.getElementById("cadetUniformSize").innerHTML = `<option value="">Select Size</option>`;
  document.getElementById("cadetUniformReason").value = "";

  await loadUniformRequests();
}
async function issueATKit(){
  const cadet = document.getElementById("atIssueCadet").value.trim();
  const id = document.getElementById("atIssueNumber").value;
  const notes = document.getElementById("atIssueNotes").value.trim();

  const item = atKit.find(row => String(row.id) === String(id));

  if(!cadet || !item){
    alert("Enter cadet name and select kit.");
    return;
  }

  if((item.status || "Available") !== "Available"){
    alert("This kit item is not available.");
    return;
  }

  const { error:updateError } = await supabaseClient
    .from("at_kit")
    .update({
      status: "Issued",
      updated_at: new Date().toISOString()
    })
    .eq("id", item.id);

  if(updateError){
    console.error(updateError);
    alert("Could not update AT kit status.");
    return;
  }

  const { error:insertError } = await supabaseClient
    .from("at_kit_issues")
    .insert([{
      kit_id: item.id,
      kit_type: item.kit_type,
      kit_number: item.kit_number,
      cadet_name: cadet,
      issued_by: "Staff",
      returned: false,
      notes
    }]);

  if(insertError){
    console.error(insertError);
    alert("Kit status updated, but issue history did not save.");
    return;
  }

  alert("AT kit issued.");

  document.getElementById("atIssueCadet").value = "";
  document.getElementById("atIssueType").value = "";
  document.getElementById("atIssueNumber").innerHTML = `<option value="">Select Item Number</option>`;
  document.getElementById("atIssueNotes").value = "";
  document.getElementById("atIssueInfo").innerHTML = "Select a kit item.";

  await loadATKit();
  await loadATIssues();
}

async function loadATIssues(){
  if(!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("at_kit_issues")
    .select("*")
    .order("issued_at", { ascending:false });

  if(error){
    console.error(error);
    return;
  }

  atIssues = data || [];
  renderATIssues();
}

function renderATIssues(){
  const table = document.getElementById("atIssueTable");
  if(!table) return;

  table.innerHTML = "";

  if(atIssues.length === 0){
    table.innerHTML = `
      <tr>
        <td colspan="5" class="no-data">No AT kit issue records found</td>
      </tr>
    `;
    return;
  }

  atIssues.forEach(row => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(row.cadet_name)}</td>
        <td>${escapeHtml(row.kit_type)}</td>
        <td>${escapeHtml(row.kit_number)}</td>
        <td>${formatDate(row.issued_at || row.created_at)}</td>
        <td>
          ${
            row.returned
              ? "Yes"
              : `<button onclick="returnATKit('${row.id}')">Return</button>`
          }
        </td>
      </tr>
    `;
  });
}

async function returnATKit(issueId){
  const issue = atIssues.find(row => String(row.id) === String(issueId));

  if(!issue){
    alert("Issue record not found.");
    return;
  }

  if(!confirm("Mark this kit as returned?")){
    return;
  }

  const { error:issueError } = await supabaseClient
    .from("at_kit_issues")
    .update({
      returned: true,
      return_date: new Date().toISOString()
    })
    .eq("id", issue.id);

  if(issueError){
    console.error(issueError);
    alert("Could not mark issue as returned.");
    return;
  }

  if(issue.kit_id){
    const { error:kitError } = await supabaseClient
      .from("at_kit")
      .update({
        status: "Available",
        updated_at: new Date().toISOString()
      })
      .eq("id", issue.kit_id);

    if(kitError){
      console.error(kitError);
      alert("Issue returned, but kit status may not have updated.");
    }
  }

  await loadATKit();
  await loadATIssues();
}

/* KIT LIST CREATOR */

async function loadKitLists(){
  if(!supabaseClient) return;

  const { data:lists, error:listError } = await supabaseClient
    .from("at_kit_lists")
    .select("*")
    .eq("active", true)
    .order("activity_name", { ascending:true });

  if(listError){
    console.error(listError);
    return;
  }

  const { data:items, error:itemError } = await supabaseClient
    .from("at_kit_list_items")
    .select("*")
    .order("display_order", { ascending:true });

  if(itemError){
    console.error(itemError);
    return;
  }

  kitLists = lists || [];
  kitListItems = items || [];

  populateKitListSelects();
  populateEventIssueLists();
  populateCheckerLists();
  populateCadetATEvents();
  renderKitListItems();
}

function populateKitListSelects(){
  const dropdown = document.getElementById("kitListDropdown");
  if(!dropdown) return;

  const currentValue = dropdown.value;

  dropdown.innerHTML = `<option value="">Select Kit List</option>`;

  kitLists.forEach(list => {
    dropdown.innerHTML += `
      <option value="${list.id}">
        ${escapeHtml(list.activity_name)}
      </option>
    `;
  });

  dropdown.value = currentValue;
}

async function createKitList(){
  const name = document.getElementById("kitListName").value.trim();
  const notes = document.getElementById("kitListNotes").value.trim();

  if(!name){
    alert("Enter an activity / event name.");
    return;
  }

  const { error } = await supabaseClient
    .from("at_kit_lists")
    .insert([{
      activity_name: name,
      notes,
      active: true
    }]);

  if(error){
    console.error(error);
    alert("Could not create kit list.");
    return;
  }

  document.getElementById("kitListName").value = "";
  document.getElementById("kitListNotes").value = "";

  await loadKitLists();
}

async function addItemToKitList(){
  const kitListId = document.getElementById("kitListDropdown").value;
  const item = document.getElementById("kitListItem").value.trim();
  const required = document.getElementById("kitListRequired").value === "true";

  if(!kitListId || !item){
    alert("Select a kit list and enter an item.");
    return;
  }

  const existingItems = kitListItems.filter(row =>
    String(row.kit_list_id) === String(kitListId)
  );

  const { error } = await supabaseClient
    .from("at_kit_list_items")
    .insert([{
      kit_list_id: kitListId,
      kit_type: item,
      required,
      display_order: existingItems.length + 1
    }]);

  if(error){
    console.error(error);
    alert("Could not add item to kit list.");
    return;
  }

  document.getElementById("kitListItem").value = "";

  await loadKitLists();
}

function renderKitListItems(){
  const table = document.getElementById("kitListItemsTable");
  if(!table) return;

  table.innerHTML = "";

  if(kitListItems.length === 0){
    table.innerHTML = `
      <tr>
        <td colspan="3" class="no-data">No kit list items found</td>
      </tr>
    `;
    return;
  }

  kitListItems.forEach(item => {
    const list = kitLists.find(row =>
      String(row.id) === String(item.kit_list_id)
    );

    table.innerHTML += `
      <tr>
        <td>${escapeHtml(list?.activity_name || "Unknown")}</td>
        <td>${escapeHtml(item.kit_type)}</td>
        <td>${item.required ? "Required" : "Optional"}</td>
      </tr>
    `;
  });
}
/* EVENT ISSUE SHEET */

function populateEventIssueLists(){
  const dropdown = document.getElementById("eventIssueDropdown");
  if(!dropdown) return;

  const currentValue = dropdown.value;

  dropdown.innerHTML = `<option value="">Select Event</option>`;

  kitLists.forEach(list => {
    dropdown.innerHTML += `
      <option value="${list.id}">
        ${escapeHtml(list.activity_name)}
      </option>
    `;
  });

  dropdown.value = currentValue;
}

function loadEventIssueSheet(){
  selectedEventIssueListId = document.getElementById("eventIssueDropdown")?.value || "";
  renderEventIssueSheet();
}

function renderEventIssueSheet(){
  const table = document.getElementById("eventIssueTable");
  if(!table) return;

  table.innerHTML = "";

  const rows = eventIssueRows.filter(row =>
    !selectedEventIssueListId ||
    String(row.eventId) === String(selectedEventIssueListId)
  );

  if(rows.length === 0){
    table.innerHTML = `
      <tr>
        <td colspan="5" class="no-data">No event issue records found</td>
      </tr>
    `;
    return;
  }

  rows.forEach(row => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(row.eventName)}</td>
        <td>${escapeHtml(row.cadet)}</td>
        <td>${escapeHtml(row.kitType)}</td>
        <td>${escapeHtml(row.itemNumber)}</td>
        <td>${formatDate(row.dateIssued)}</td>
      </tr>
    `;
  });
}

/* KIT CHECKER / MULTI ISSUE */

function populateCheckerLists(){
  const dropdown = document.getElementById("kitCheckerEvent");
  if(!dropdown) return;

  const currentValue = dropdown.value;

  dropdown.innerHTML = `<option value="">Select Event</option>`;

  kitLists.forEach(list => {
    dropdown.innerHTML += `
      <option value="${list.id}">
        ${escapeHtml(list.activity_name)}
      </option>
    `;
  });

  dropdown.value = currentValue;
}

function loadKitCheckerEvent(){
  loadKitChecker();
}

function loadKitChecker(){
  selectedCheckerListId = document.getElementById("kitCheckerEvent")?.value || "";

  renderKitCheckerCadets();
  renderMultiIssueTable();
}

function saveKitCheckerCadets(){
  const eventId = document.getElementById("kitCheckerEvent").value;
  const text = document.getElementById("kitCheckerCadets").value;

  if(!eventId){
    alert("Select an event first.");
    return;
  }

  const cadets = text
    .split(/\r?\n/)
    .map(name => name.trim())
    .filter(Boolean);

  if(cadets.length === 0){
    alert("Enter at least one cadet.");
    return;
  }

  eventCadets[eventId] = cadets;

  if(!checkerData[eventId]){
    checkerData[eventId] = {};
  }

  cadets.forEach(cadet => {
    if(!checkerData[eventId][cadet]){
      checkerData[eventId][cadet] = {};
    }
  });

  saveLocal();
  renderKitCheckerCadets();

  alert("Cadets saved.");
}

function renderKitCheckerCadets(){
  const table = document.getElementById("kitCheckerCadetTable");
  if(!table) return;

  table.innerHTML = "";

  if(!selectedCheckerListId){
    table.innerHTML = `
      <tr>
        <td colspan="2" class="no-data">Select an event</td>
      </tr>
    `;
    return;
  }

  const cadets = eventCadets[selectedCheckerListId] || [];

  if(cadets.length === 0){
    table.innerHTML = `
      <tr>
        <td colspan="2" class="no-data">No cadets saved for this event</td>
      </tr>
    `;
    return;
  }

  cadets.forEach(cadet => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(cadet)}</td>
        <td>
          <button onclick="openKitIssueModal('${escapeHtml(cadet)}')">
            Select Kit
          </button>
        </td>
      </tr>
    `;
  });
}

function openKitIssueModal(cadet){
  modalCadet = cadet;

  const modal = document.getElementById("kitIssueModal");
  const title = document.getElementById("modalCadetName");
  const checklist = document.getElementById("modalKitChecklist");

  if(!modal || !title || !checklist){
    return;
  }

  title.innerText = "Issue kit to " + cadet;
  checklist.innerHTML = "";

  const items = kitListItems
    .filter(item => String(item.kit_list_id) === String(selectedCheckerListId))
    .sort((a,b) => Number(a.display_order || 0) - Number(b.display_order || 0));

  if(items.length === 0){
    checklist.innerHTML = `<p>No kit items found for this event.</p>`;
  }

  items.forEach(item => {
    checklist.innerHTML += `
      <label>
        <input type="checkbox" class="modal-kit-check" value="${escapeHtml(item.kit_type)}">
        ${escapeHtml(item.kit_type)}
        ${item.required ? " (Required)" : " (Optional)"}
      </label>
      <br>
    `;
  });

  modal.style.display = "block";
}

function closeKitIssueModal(){
  const modal = document.getElementById("kitIssueModal");

  if(modal){
    modal.style.display = "none";
  }

  modalCadet = "";
}

function confirmMultiIssueSelection(){
  const checkedItems = Array
    .from(document.querySelectorAll(".modal-kit-check:checked"))
    .map(box => box.value);

  if(checkedItems.length === 0){
    alert("Select at least one kit item.");
    return;
  }

  const event = kitLists.find(list =>
    String(list.id) === String(selectedCheckerListId)
  );

  checkedItems.forEach(kitType => {
    eventIssueRows.push({
      id: Date.now() + Math.random(),
      eventId: selectedCheckerListId,
      eventName: event?.activity_name || "Unknown Event",
      cadet: modalCadet,
      kitType,
      itemNumber: "",
      dateIssued: ""
    });
  });

  saveLocal();
  closeKitIssueModal();
  renderMultiIssueTable();
  renderEventIssueSheet();
}
function renderMultiIssueTable(){
  const table = document.getElementById("multiIssueTable");
  if(!table) return;

  table.innerHTML = "";

  if(!selectedCheckerListId){
    table.innerHTML = `
      <tr>
        <td colspan="6" class="no-data">Select an event</td>
      </tr>
    `;
    return;
  }

  const rows = eventIssueRows.filter(row =>
    String(row.eventId) === String(selectedCheckerListId) &&
    !row.dateIssued
  );

  if(rows.length === 0){
    table.innerHTML = `
      <tr>
        <td colspan="6" class="no-data">No kit selected for issue</td>
      </tr>
    `;
    return;
  }

  rows.forEach(row => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(row.eventName)}</td>
        <td>${escapeHtml(row.cadet)}</td>
        <td>${escapeHtml(row.kitType)}</td>
        <td>
          <select onchange="setEventIssueItemNumber('${row.id}', this.value)">
            <option value="">Select item number</option>
            ${getAvailableATItemOptions(row.kitType, row.itemNumber)}
          </select>
        </td>
        <td>
          <button onclick="issueEventKit('${row.id}')">
            Issue
          </button>
        </td>
        <td>
          <button onclick="removeEventIssueRow('${row.id}')">
            Remove
          </button>
        </td>
      </tr>
    `;
  });
}

function getAvailableATItemOptions(type, selectedNumber){
  let html = "";

  atKit
    .filter(item => item.kit_type === type)
    .filter(item =>
      (item.status || "Available") === "Available" ||
      item.kit_number === selectedNumber
    )
    .sort((a,b) => String(a.kit_number || "").localeCompare(String(b.kit_number || "")))
    .forEach(item => {
      html += `
        <option value="${escapeHtml(item.kit_number)}" ${item.kit_number === selectedNumber ? "selected" : ""}>
          ${escapeHtml(item.kit_number)}
          ${item.size ? " - " + escapeHtml(item.size) : ""}
        </option>
      `;
    });

  return html;
}

function setEventIssueItemNumber(rowId, number){
  const row = eventIssueRows.find(item =>
    String(item.id) === String(rowId)
  );

  if(!row){
    return;
  }

  row.itemNumber = number;
  saveLocal();
}

async function issueEventKit(rowId){
  const row = eventIssueRows.find(item =>
    String(item.id) === String(rowId)
  );

  if(!row){
    alert("Issue row not found.");
    return;
  }

  if(!row.itemNumber){
    alert("Select the item number given.");
    return;
  }

  const item = atKit.find(kit =>
    kit.kit_type === row.kitType &&
    kit.kit_number === row.itemNumber
  );

  if(!item){
    alert("AT kit item not found.");
    return;
  }

  if((item.status || "Available") !== "Available"){
    alert("This item is not available.");
    return;
  }

  const { error:updateError } = await supabaseClient
    .from("at_kit")
    .update({
      status: "Issued",
      updated_at: new Date().toISOString()
    })
    .eq("id", item.id);

  if(updateError){
    console.error(updateError);
    alert("Could not update item status.");
    return;
  }

  const { error:insertError } = await supabaseClient
    .from("at_kit_issues")
    .insert([{
      kit_id: item.id,
      kit_type: item.kit_type,
      kit_number: item.kit_number,
      cadet_name: row.cadet,
      issued_by: "Staff",
      returned: false,
      notes: "Issued for event: " + row.eventName
    }]);

  if(insertError){
    console.error(insertError);
    alert("Kit was marked issued but history did not save.");
    return;
  }

  row.dateIssued = new Date().toISOString();

  saveLocal();

  await loadATKit();
  await loadATIssues();

  renderMultiIssueTable();
  renderEventIssueSheet();
}

function removeEventIssueRow(rowId){
  eventIssueRows = eventIssueRows.filter(row =>
    String(row.id) !== String(rowId)
  );

  saveLocal();
  renderMultiIssueTable();
  renderEventIssueSheet();
}

/* CADET AT REQUESTS */

function populateCadetATEvents(){
  const dropdown = document.getElementById("cadetATEvent");
  if(!dropdown) return;

  dropdown.innerHTML = `<option value="">Select Event</option>`;

  kitLists.forEach(list => {
    dropdown.innerHTML += `
      <option value="${list.id}">
        ${escapeHtml(list.activity_name)}
      </option>
    `;
  });
}

function loadCadetATKitList(){
  const eventId = document.getElementById("cadetATEvent").value;
  const box = document.getElementById("cadetATKitChecklist");

  if(!box) return;

  box.innerHTML = "";

  if(!eventId){
    box.innerHTML = `<p>Select an event to see the kit list.</p>`;
    return;
  }

  const items = kitListItems
    .filter(item => String(item.kit_list_id) === String(eventId))
    .sort((a,b) => Number(a.display_order || 0) - Number(b.display_order || 0));

  if(items.length === 0){
    box.innerHTML = `<p>No kit list has been created for this event.</p>`;
    return;
  }

  items.forEach(item => {
    box.innerHTML += `
      <label class="checkbox-row">
        <input
          type="checkbox"
          class="cadet-at-kit-check"
          value="${escapeHtml(item.kit_type)}"
        >
        ${escapeHtml(item.kit_type)}
        ${item.required ? "<strong> Required</strong>" : " Optional"}
      </label>
    `;
  });
}
async function submitCadetATRequest(){
  const cadet = document.getElementById("cadetATName").value.trim();
  const eventId = document.getElementById("cadetATEvent").value;

  if(!cadet || !eventId){
    alert("Enter your name and select an event.");
    return;
  }

  const event = kitLists.find(list =>
    String(list.id) === String(eventId)
  );

  const selectedItems = Array
    .from(document.querySelectorAll(".cadet-at-kit-check:checked"))
    .map(box => box.value);

  if(selectedItems.length === 0){
    alert("Tick at least one item.");
    return;
  }

  const { error } = await supabaseClient
    .from("at_kit_requests")
    .insert([{
      cadet_name: cadet,
      activity_name: event?.activity_name || "Unknown Event",
      kit_type: selectedItems.join(", "),
      requested_items: selectedItems,
      reason: "Cadet AT kit request",
      status: "Pending"
    }]);

  if(error){
    console.error(error);
    alert("Could not submit AT kit request.");
    return;
  }

  alert("AT kit request submitted.");

  document.getElementById("cadetATName").value = "";
  document.getElementById("cadetATEvent").value = "";
  document.getElementById("cadetATKitChecklist").innerHTML = "";

  await loadATRequests();
}

async function loadATRequests(){
  if(!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("at_kit_requests")
    .select("*")
    .order("requested_at", { ascending:false });

  if(error){
    console.error(error);
    return;
  }

  atRequests = data || [];
  renderATRequests();
}

function renderATRequests(){
  const table = document.getElementById("atRequestsTable");
  if(!table) return;

  table.innerHTML = "";

  if(atRequests.length === 0){
    table.innerHTML = `
      <tr>
        <td colspan="4" class="no-data">No AT kit requests found</td>
      </tr>
    `;
    return;
  }

  atRequests.forEach(row => {
    const kitRequested = Array.isArray(row.requested_items)
      ? row.requested_items.join(", ")
      : row.kit_type;

    table.innerHTML += `
      <tr>
        <td>${escapeHtml(row.cadet_name)}</td>
        <td>${escapeHtml(row.activity_name)}</td>
        <td>${escapeHtml(kitRequested)}</td>
        <td>${formatDate(row.requested_at || row.created_at)}</td>
      </tr>
    `;
  });
}

/* SERVICEABILITY CHECKS */

async function loadServiceChecks(){
  if(!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("serviceability_checks")
    .select("*")
    .order("next_due_date", { ascending:true });

  if(error){
    console.error(error);
    serviceChecks = [];
    renderServiceability();
    return;
  }

  serviceChecks = data || [];
  renderServiceability();
}

async function addServiceabilityCheck(){
  const itemNumber = document.getElementById("serviceItemNumber").value.trim();
  const lastCheck = document.getElementById("serviceCheckDate").value;
  const interval = Number(document.getElementById("serviceInterval").value || 365);

  if(!itemNumber || !lastCheck || interval < 1){
    alert("Enter item number, last check date and interval.");
    return;
  }

  const nextDue = new Date(lastCheck);
  nextDue.setDate(nextDue.getDate() + interval);

  const { error } = await supabaseClient
    .from("serviceability_checks")
    .insert([{
      item_number: itemNumber,
      last_check_date: lastCheck,
      interval_days: interval,
      next_due_date: nextDue.toISOString().slice(0,10)
    }]);

  if(error){
    console.error(error);
    alert("Could not save serviceability check. Check the serviceability_checks database table exists.");
    return;
  }

  document.getElementById("serviceItemNumber").value = "";
  document.getElementById("serviceCheckDate").value = "";
  document.getElementById("serviceInterval").value = "365";

  await loadServiceChecks();
}

function renderServiceability(){
  const table = document.getElementById("serviceabilityTable");
  if(!table) return;

  table.innerHTML = "";

  if(serviceChecks.length === 0){
    table.innerHTML = `
      <tr>
        <td colspan="4" class="no-data">No serviceability checks found</td>
      </tr>
    `;
    return;
  }

  const today = new Date();

  serviceChecks.forEach(row => {
    const dueDate = new Date(row.next_due_date);
    const difference = dueDate - today;
    const daysRemaining = Math.ceil(difference / (1000 * 60 * 60 * 24));

    let rowClass = "good-stock";

    if(daysRemaining <= 0){
      rowClass = "out-stock";
    }else if(daysRemaining <= 30){
      rowClass = "low-stock";
    }

    table.innerHTML += `
      <tr class="${rowClass}">
        <td>${escapeHtml(row.item_number)}</td>
        <td>${escapeHtml(row.last_check_date)}</td>
        <td>${escapeHtml(row.next_due_date)}</td>
        <td>${daysRemaining}</td>
      </tr>
    `;
  });
}
/* TEMPORARY PASSWORDS */

async function loadTemporaryPasswords(){
  if(!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("temporary_passwords")
    .select("*")
    .order("expires_at", { ascending:false });

  if(error){
    console.error(error);
    alert("Could not load temporary passwords.");
    return;
  }

  temporaryPasswords = data || [];
  renderTemporaryPasswords();
}

function renderTemporaryPasswords(){
  const table = document.getElementById("temporaryPasswordsTable");
  if(!table) return;

  table.innerHTML = "";

  if(temporaryPasswords.length === 0){
    table.innerHTML = `
      <tr>
        <td colspan="5" class="no-data">No temporary passwords created</td>
      </tr>
    `;
    return;
  }

  temporaryPasswords.forEach(row => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(row.password)}</td>
        <td>${escapeHtml(row.note || "")}</td>
        <td>${formatDate(row.expires_at)}</td>
        <td>${row.active ? "Yes" : "No"}</td>
        <td>
          ${
            row.active
              ? `<button class="small-btn delete-btn" onclick="disableTemporaryPassword('${row.id}')">Disable</button>`
              : "Disabled"
          }
        </td>
      </tr>
    `;
  });
}

async function createTemporaryPassword(){
  const password = document.getElementById("tempPasswordValue").value.trim();
  const note = document.getElementById("tempPasswordName").value.trim();
  const expiry = document.getElementById("tempPasswordExpiry").value;

  if(!password || !expiry){
    alert("Enter a temporary password and expiry date/time.");
    return;
  }

  const { error } = await supabaseClient
    .from("temporary_passwords")
    .insert([{
      password,
      note,
      expires_at: new Date(expiry).toISOString(),
      active: true
    }]);

  if(error){
    console.error(error);
    alert("Could not create temporary password. Check your temporary_passwords table.");
    return;
  }

  document.getElementById("tempPasswordValue").value = "";
  document.getElementById("tempPasswordName").value = "";
  document.getElementById("tempPasswordExpiry").value = "";

  await loadTemporaryPasswords();

  alert("Temporary password created.");
}

async function disableTemporaryPassword(id){
  const { error } = await supabaseClient
    .from("temporary_passwords")
    .update({
      active: false
    })
    .eq("id", id);

  if(error){
    console.error(error);
    alert("Could not disable temporary password.");
    return;
  }

  await loadTemporaryPasswords();
}

/* STARTUP */

document.addEventListener("DOMContentLoaded", () => {
  hideAll();

  const home = document.getElementById("homeScreen");

  if(home){
    home.classList.remove("hidden");
  }
});
