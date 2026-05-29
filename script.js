const SUPABASE_URL = "https://oskorapwgvoecvtdtkwi.supabase.co";
const SUPABASE_KEY = "sb_publishable_Zm5qgcsjzsuzicBwa6Z0sA_qgn-Gm5R";

let supabaseClient = null;

if(window.supabase){
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}else{
  alert("Supabase did not load. Check your internet connection or script link.");
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
let borrowCounts = {};
let eventCadets = JSON.parse(localStorage.getItem("eventCadets") || "{}");
let eventIssueRows = JSON.parse(localStorage.getItem("eventIssueRows") || "[]");
let checkerData = JSON.parse(localStorage.getItem("checkerData") || "{}");
let selectedEventIssueListId = "";
let selectedCheckerListId = "";
let modalCadet = "";

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
  document.getElementById("homeScreen").classList.remove("hidden");
}

function openStaffLogin(){
  hideAll();
  document.getElementById("staffLoginScreen").classList.remove("hidden");
}

async function openCadetUniformPortal(){
  hideAll();
  document.getElementById("cadetUniformPortal").classList.remove("hidden");

  if(supabaseClient){
    await loadUniformStock();
    populateCadetUniformItems();
  }
}

async function openCadetATPortal(){
  hideAll();
  document.getElementById("cadetATPortal").classList.remove("hidden");

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

  if(entered !== STAFF_PASSWORD){
    alert("Incorrect password");
    return;
  }

  hideAll();
  document.getElementById("staffApp").classList.remove("hidden");

  if(supabaseClient){
    await loadAll();
  }

  showStaffPage("uniformStockPage");
}

async function openCadetATPortal(){
  hideAll();
  document.getElementById("cadetATPortal").classList.remove("hidden");
  await loadKitLists();
  populateCadetATEvents();
}

function logout(){
  backHome();
}

async function staffLogin(){
  const entered = document.getElementById("staffPasswordInput").value.trim();

  if(entered !== STAFF_PASSWORD){
    alert("Incorrect password");
    return;
  }

  hideAll();
  document.getElementById("staffApp").classList.remove("hidden");

  await loadAll();
  showStaffPage("uniformStockPage");
}

function showStaffPage(id){
  document.querySelectorAll(".staff-page").forEach(p => p.classList.remove("active-page"));
  document.getElementById(id)?.classList.add("active-page");

  if(id === "uniformStockPage") renderUniformStock();
  if(id === "uniformIssuedPage"){
    populateUniformIssueItems();
    renderUniformIssues();
  }
  if(id === "uniformRequestsPage") renderUniformRequests();
  if(id === "atStockPage") renderATKit();
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
    populateServiceKitItems();
    renderServiceability();
  }
  if(id === "atRequestsPage") renderATRequests();
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

  populateUniformIssueItems();
  populateATIssueTypes();
  populateKitListSelects();
  populateEventIssueLists();
  populateCheckerLists();
  populateServiceKitItems();
  populateCadetUniformItems();
  populateCadetATEvents();
}

/* UNIFORM STOCK */

async function loadUniformStock(){
  const {data,error} = await supabaseClient
    .from("uniform_stock")
    .select("*")
    .order("item",{ascending:true})
    .order("size",{ascending:true});

  if(error){
    console.error(error);
    alert("Error loading uniform stock");
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

  const q = (document.getElementById("uniformStockSearch")?.value || "").toLowerCase();

  const rows = uniformStock.filter(x =>
    [x.item,x.size,x.box_number].some(v =>
      String(v || "").toLowerCase().includes(q)
    )
  );

  table.innerHTML = "";

  if(!rows.length){
    table.innerHTML = `<tr><td colspan="6" class="no-data">No uniform stock found</td></tr>`;
    return;
  }

  rows.forEach(x => {
    const low = Number(x.quantity || 0) <= Number(x.warning_level || 1)
      ? "low-stock"
      : "";

    table.innerHTML += `
      <tr>
        <td>${escapeHtml(x.item)}</td>
        <td>${escapeHtml(x.size)}</td>
        <td>${escapeHtml(x.box_number)}</td>
        <td class="${low}">${escapeHtml(x.quantity || 0)}</td>
        <td>
          <button class="small-btn edit-btn" onclick="quickUniformStock('${x.id}',-1)">-1</button>
          <button class="small-btn edit-btn" onclick="quickUniformStock('${x.id}',1)">+1</button>
          <button class="small-btn edit-btn" onclick="setUniformStock('${x.id}')">Set</button>
        </td>
        <td>
          <button class="small-btn delete-btn" onclick="deleteUniformStock('${x.id}')">Delete</button>
        </td>
      </tr>
    `;
  });
}

async function addUniformStock(){
  const item = document.getElementById("newUniformItem").value.trim();
  const size = document.getElementById("newUniformSize").value.trim();
  const box = document.getElementById("newUniformBox").value.trim();
  const qty = Number(document.getElementById("newUniformQuantity").value || 0);
  const warning = Number(document.getElementById("newUniformWarning").value || 1);

  if(!item || !size){
    alert("Enter item and size");
    return;
  }

  const {error} = await supabaseClient
    .from("uniform_stock")
    .insert([{
      item,
      size,
      box_number:box,
      quantity:qty,
      warning_level:warning
    }]);

  if(error){
    console.error(error);
    alert("Could not add uniform stock");
    return;
  }

  ["newUniformItem","newUniformSize","newUniformBox","newUniformQuantity"].forEach(id => {
    document.getElementById(id).value = "";
  });

  document.getElementById("newUniformWarning").value = "1";

  await loadUniformStock();
}

async function quickUniformStock(id, change){
  const row = uniformStock.find(x => String(x.id) === String(id));
  if(!row) return;

  const qty = Math.max(0, Number(row.quantity || 0) + change);

  const {error} = await supabaseClient
    .from("uniform_stock")
    .update({
      quantity:qty,
      updated_at:todayISO()
    })
    .eq("id",id);

  if(error){
    console.error(error);
    alert("Could not update stock");
    return;
  }

  await loadUniformStock();
}
async function setUniformStock(id){
  const row = uniformStock.find(x => String(x.id) === String(id));
  if(!row) return;

  const value = prompt("Enter new stock quantity:", row.quantity || 0);
  if(value === null) return;

  const qty = Number(value);

  if(isNaN(qty) || qty < 0){
    alert("Enter a valid number");
    return;
  }

  const {error} = await supabaseClient
    .from("uniform_stock")
    .update({
      quantity:qty,
      updated_at:todayISO()
    })
    .eq("id",id);

  if(error){
    console.error(error);
    alert("Could not set stock");
    return;
  }

  await loadUniformStock();
}

async function deleteUniformStock(id){
  if(!confirm("Delete this uniform item?")) return;

  const {error} = await supabaseClient
    .from("uniform_stock")
    .delete()
    .eq("id",id);

  if(error){
    console.error(error);
    alert("Could not delete uniform stock");
    return;
  }

  await loadUniformStock();
}

function populateUniformIssueItems(){
  const select = document.getElementById("issueUniformItem");
  if(!select) return;

  const current = select.value;

  select.innerHTML = `<option value="">Select item</option>`;

  [...new Set(uniformStock.map(x => x.item))]
    .filter(Boolean)
    .sort()
    .forEach(item => {
      select.innerHTML += `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`;
    });

  select.value = current;
}

function populateUniformIssueSizes(){
  const item = document.getElementById("issueUniformItem").value;
  const select = document.getElementById("issueUniformSize");

  if(!select) return;

  select.innerHTML = `<option value="">Select size</option>`;

  [...new Set(
    uniformStock
      .filter(x => x.item === item)
      .map(x => x.size)
  )]
    .filter(Boolean)
    .sort()
    .forEach(size => {
      select.innerHTML += `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`;
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

  const matches = uniformStock.filter(x => x.item === item && x.size === size);
  const total = matches.reduce((sum,x) => sum + Number(x.quantity || 0),0);

  box.innerHTML = `
    <strong>Total available:</strong> ${total}<br>
    <strong>Boxes:</strong><br>
    ${matches.map(x => `${escapeHtml(x.box_number || "No box")} - Qty ${escapeHtml(x.quantity || 0)}`).join("<br>")}
  `;
}

async function issueUniform(){
  const cadet = document.getElementById("issueUniformCadet").value.trim();
  const item = document.getElementById("issueUniformItem").value;
  const size = document.getElementById("issueUniformSize").value;
  const qty = Number(document.getElementById("issueUniformQuantity").value || 1);

  if(!cadet || !item || !size || qty < 1){
    alert("Complete all uniform issue fields");
    return;
  }

  const matching = uniformStock
    .filter(x => x.item === item && x.size === size && Number(x.quantity || 0) > 0)
    .sort((a,b) => Number(b.quantity || 0) - Number(a.quantity || 0));

  let remaining = qty;
  const records = [];

  for(const stock of matching){
    if(remaining <= 0) break;

    const available = Number(stock.quantity || 0);
    const taken = Math.min(available, remaining);

    const {error:updateError} = await supabaseClient
      .from("uniform_stock")
      .update({
        quantity: available - taken,
        updated_at: todayISO()
      })
      .eq("id", stock.id);

    if(updateError){
      console.error(updateError);
      alert("Could not update uniform stock");
      return;
    }

    records.push({
      cadet_name: cadet,
      item: stock.item,
      size: stock.size,
      box_number: stock.box_number,
      quantity: taken,
      issued_by: "Staff",
      returned: false
    });

    remaining -= taken;
  }

  if(remaining > 0){
    alert("Not enough stock available. Some stock may already have been updated, please check.");
    await loadUniformStock();
    return;
  }

  const {error:insertError} = await supabaseClient
    .from("uniform_issues")
    .insert(records);

  if(insertError){
    console.error(insertError);
    alert("Uniform stock changed, but issue history did not save.");
    return;
  }

  alert("Uniform issued");

  document.getElementById("issueUniformCadet").value = "";
  document.getElementById("issueUniformItem").value = "";
  document.getElementById("issueUniformSize").innerHTML = `<option value="">Select size</option>`;
  document.getElementById("issueUniformQuantity").value = 1;

  await loadUniformStock();
  await loadUniformIssues();
}

async function loadUniformIssues(){
  const {data,error} = await supabaseClient
    .from("uniform_issues")
    .select("*")
    .order("issue_date",{ascending:false});

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

  const q = (document.getElementById("uniformIssuedSearch")?.value || "").toLowerCase();

  const rows = uniformIssues.filter(x =>
    [x.cadet_name,x.item,x.size,x.box_number].some(v =>
      String(v || "").toLowerCase().includes(q)
    )
  );

  table.innerHTML = "";

  if(!rows.length){
    table.innerHTML = `<tr><td colspan="6" class="no-data">No uniform issue records found</td></tr>`;
    return;
  }

  rows.forEach(x => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(x.cadet_name)}</td>
        <td>${escapeHtml(x.item)}</td>
        <td>${escapeHtml(x.size)}</td>
        <td>${escapeHtml(x.quantity)}</td>
        <td>${formatDate(x.issue_date || x.created_at)}</td>
        <td>${x.returned ? "Yes" : "No"}</td>
      </tr>
    `;
  });
}

/* UNIFORM REQUESTS */

async function loadUniformRequests(){
  const {data,error} = await supabaseClient
    .from("uniform_requests")
    .select("*")
    .order("requested_at",{ascending:false});

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

  if(!uniformRequests.length){
    table.innerHTML = `<tr><td colspan="6" class="no-data">No uniform requests found</td></tr>`;
    return;
  }

  uniformRequests.forEach(x => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(x.cadet_name)}</td>
        <td>${escapeHtml(x.item)}</td>
        <td>${escapeHtml(x.size)}</td>
        <td>${escapeHtml(x.reason)}</td>
        <td>${escapeHtml(x.status || "Pending")}</td>
        <td>${formatDate(x.requested_at || x.created_at)}</td>
      </tr>
    `;
  });
}

function populateCadetUniformItems(){
  const select = document.getElementById("cadetUniformItem");
  if(!select) return;

  select.innerHTML = `<option value="">Select Item</option>`;

  [...new Set(uniformStock.map(x => x.item))]
    .filter(Boolean)
    .sort()
    .forEach(item => {
      select.innerHTML += `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`;
    });
}
function populateCadetUniformSizes(){
  const item = document.getElementById("cadetUniformItem").value;
  const select = document.getElementById("cadetUniformSize");

  if(!select) return;

  select.innerHTML = `<option value="">Select Size</option>`;

  [...new Set(
    uniformStock
      .filter(x => x.item === item)
      .map(x => x.size)
  )]
    .filter(Boolean)
    .sort()
    .forEach(size => {
      select.innerHTML += `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`;
    });
}

async function submitCadetUniformRequest(){
  const cadet = document.getElementById("cadetUniformName").value.trim();
  const item = document.getElementById("cadetUniformItem").value;
  const size = document.getElementById("cadetUniformSize").value;
  const reason = document.getElementById("cadetUniformReason").value.trim();

  if(!cadet || !item || !size || !reason){
    alert("Complete all fields");
    return;
  }

  const {error} = await supabaseClient
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
    alert("Could not submit request");
    return;
  }

  alert("Uniform request submitted");

  document.getElementById("cadetUniformName").value = "";
  document.getElementById("cadetUniformReason").value = "";
  document.getElementById("cadetUniformItem").value = "";
  document.getElementById("cadetUniformSize").innerHTML = `<option value="">Select Size</option>`;
}

/* AT KIT */

async function loadATKit(){
  const {data,error} = await supabaseClient
    .from("at_kit")
    .select("*")
    .order("kit_type",{ascending:true})
    .order("kit_number",{ascending:true});

  if(error){
    console.error(error);
    alert("Error loading AT kit");
    return;
  }

  atKit = data || [];

  await buildBorrowCounts();

  renderATKit();
  populateATIssueTypes();
  populateServiceKitItems();
}

async function buildBorrowCounts(){
  const {data,error} = await supabaseClient
    .from("at_kit_issues")
    .select("kit_id,kit_type,kit_number");

  borrowCounts = {};

  if(error){
    console.error(error);
    return;
  }

  (data || []).forEach(x => {
    const key = x.kit_id
      ? `id-${x.kit_id}`
      : `${x.kit_type || ""}-${x.kit_number || ""}`;

    borrowCounts[key] = (borrowCounts[key] || 0) + 1;
  });
}

function getBorrowCount(item){
  return borrowCounts[`id-${item.id}`] ||
    borrowCounts[`${item.kit_type || ""}-${item.kit_number || ""}`] ||
    0;
}

function renderATKit(){
  const table = document.getElementById("atKitTable");
  if(!table) return;

  const q = (document.getElementById("atStockSearch")?.value || "").toLowerCase();

  const rows = atKit.filter(x =>
    [
      x.kit_type,
      x.kit_number,
      x.size,
      x.condition,
      x.status,
      x.location,
      x.notes
    ].some(v => String(v || "").toLowerCase().includes(q))
  );

  table.innerHTML = "";

  if(!rows.length){
    table.innerHTML = `<tr><td colspan="9" class="no-data">No AT kit found</td></tr>`;
    return;
  }

  rows.forEach(x => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(x.kit_type)}</td>
        <td>${escapeHtml(x.kit_number)}</td>
        <td>${escapeHtml(x.size)}</td>
        <td>${escapeHtml(x.condition)}</td>
        <td>${escapeHtml(x.status || "Available")}</td>
        <td>${escapeHtml(x.location)}</td>
        <td>${getBorrowCount(x)}</td>
        <td>${escapeHtml(x.notes)}</td>
        <td>
          <button class="small-btn delete-btn" onclick="deleteATKit('${x.id}')">Delete</button>
        </td>
      </tr>
    `;
  });
}

async function addATKit(){
  const row = {
    kit_type: document.getElementById("newATType").value.trim(),
    kit_number: document.getElementById("newATNumber").value.trim(),
    size: document.getElementById("newATSize").value.trim(),
    location: document.getElementById("newATLocation").value.trim(),
    condition: document.getElementById("newATCondition").value.trim() || "Good",
    notes: document.getElementById("newATNotes").value.trim(),
    status: "Available"
  };

  if(!row.kit_type || !row.kit_number){
    alert("Enter kit type and identifying number");
    return;
  }

  const {error} = await supabaseClient
    .from("at_kit")
    .insert([row]);

  if(error){
    console.error(error);
    alert("Could not add AT kit");
    return;
  }

  ["newATType","newATNumber","newATSize","newATLocation","newATNotes"].forEach(id => {
    document.getElementById(id).value = "";
  });

  document.getElementById("newATCondition").value = "Good";

  await loadATKit();
}
async function deleteATKit(id){
  if(!confirm("Delete this AT kit item?")) return;

  const {error} = await supabaseClient
    .from("at_kit")
    .delete()
    .eq("id",id);

  if(error){
    console.error(error);
    alert("Could not delete AT kit");
    return;
  }

  await loadATKit();
}

function populateATIssueTypes(){
  const select = document.getElementById("atIssueType");
  if(!select) return;

  const current = select.value;

  select.innerHTML = `<option value="">Select Kit Type</option>`;

  [...new Set(atKit.map(x => x.kit_type))]
    .filter(Boolean)
    .sort()
    .forEach(type => {
      select.innerHTML += `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`;
    });

  select.value = current;
}

function populateATIssueNumbers(){
  const type = document.getElementById("atIssueType").value;
  const select = document.getElementById("atIssueNumber");

  if(!select) return;

  select.innerHTML = `<option value="">Select Item Number</option>`;

  atKit
    .filter(x => x.kit_type === type && (x.status || "Available") === "Available")
    .sort((a,b) => String(a.kit_number || "").localeCompare(String(b.kit_number || "")))
    .forEach(item => {
      select.innerHTML += `
        <option value="${item.id}">
          ${escapeHtml(item.kit_number)}
          ${item.size ? " - " + escapeHtml(item.size) : ""}
        </option>
      `;
    });

  showATIssueInfo();
}

function showATIssueInfo(){
  const id = document.getElementById("atIssueNumber").value;
  const box = document.getElementById("atIssueInfo");

  if(!box) return;

  const item = atKit.find(x => String(x.id) === String(id));

  if(!item){
    box.innerHTML = "Select a kit item.";
    return;
  }

  box.innerHTML = `
    <strong>Type:</strong> ${escapeHtml(item.kit_type)}<br>
    <strong>Number:</strong> ${escapeHtml(item.kit_number)}<br>
    <strong>Size:</strong> ${escapeHtml(item.size)}<br>
    <strong>Condition:</strong> ${escapeHtml(item.condition)}<br>
    <strong>Location:</strong> ${escapeHtml(item.location)}<br>
    <strong>Borrowed:</strong> ${getBorrowCount(item)} time(s)
  `;
}

async function issueATKit(){
  const cadet = document.getElementById("atIssueCadet").value.trim();
  const id = document.getElementById("atIssueNumber").value;
  const notes = document.getElementById("atIssueNotes").value.trim();

  const item = atKit.find(x => String(x.id) === String(id));

  if(!cadet || !item){
    alert("Enter cadet name and select kit");
    return;
  }

  if((item.status || "Available") !== "Available"){
    alert("This kit is not available");
    return;
  }

  const {error:updateError} = await supabaseClient
    .from("at_kit")
    .update({
      status: "Issued",
      updated_at: todayISO()
    })
    .eq("id", item.id);

  if(updateError){
    console.error(updateError);
    alert("Could not update kit status");
    return;
  }

  const {error:insertError} = await supabaseClient
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
    alert("Kit status updated, but issue history did not save");
    return;
  }

  alert("AT kit issued");

  document.getElementById("atIssueCadet").value = "";
  document.getElementById("atIssueType").value = "";
  document.getElementById("atIssueNumber").innerHTML = `<option value="">Select Item Number</option>`;
  document.getElementById("atIssueNotes").value = "";

  await loadATKit();
  await loadATIssues();
}

async function loadATIssues(){
  const {data,error} = await supabaseClient
    .from("at_kit_issues")
    .select("*")
    .order("issued_at",{ascending:false});

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

  if(!atIssues.length){
    table.innerHTML = `<tr><td colspan="5" class="no-data">No AT kit issue records found</td></tr>`;
    return;
  }

  atIssues.forEach(x => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(x.cadet_name)}</td>
        <td>${escapeHtml(x.kit_type)}</td>
        <td>${escapeHtml(x.kit_number)}</td>
        <td>${formatDate(x.issued_at || x.created_at)}</td>
        <td>${x.returned ? "Yes" : `<button onclick="returnATKit('${x.id}')">Return</button>`}</td>
      </tr>
    `;
  });
}

async function returnATKit(issueId){
  const issue = atIssues.find(x => String(x.id) === String(issueId));

  if(!issue){
    alert("Issue record not found");
    return;
  }

  if(!confirm("Mark this kit as returned?")) return;

  const {error:updateIssueError} = await supabaseClient
    .from("at_kit_issues")
    .update({
      returned: true,
      return_date: todayISO()
    })
    .eq("id", issue.id);

  if(updateIssueError){
    console.error(updateIssueError);
    alert("Could not mark issue as returned");
    return;
  }

  if(issue.kit_id){
    const {error:updateKitError} = await supabaseClient
      .from("at_kit")
      .update({
        status: "Available",
        updated_at: todayISO()
      })
      .eq("id", issue.kit_id);

    if(updateKitError){
      console.error(updateKitError);
      alert("Issue returned, but kit status may not have updated");
    }
  }

  await loadATKit();
  await loadATIssues();
}
/* KIT LISTS */

async function loadKitLists(){
  const {data:lists,error:listError} = await supabaseClient
    .from("at_kit_lists")
    .select("*")
    .eq("active",true)
    .order("activity_name",{ascending:true});

  if(listError){
    console.error(listError);
    return;
  }

  const {data:items,error:itemError} = await supabaseClient
    .from("at_kit_list_items")
    .select("*")
    .order("display_order",{ascending:true});

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
  const select = document.getElementById("kitListDropdown");
  if(!select) return;

  const current = select.value;

  select.innerHTML = `<option value="">Select Kit List</option>`;

  kitLists.forEach(list => {
    select.innerHTML += `
      <option value="${list.id}">
        ${escapeHtml(list.activity_name)}
      </option>
    `;
  });

  select.value = current;
}

async function createKitList(){
  const name = document.getElementById("kitListName").value.trim();
  const notes = document.getElementById("kitListNotes").value.trim();

  if(!name){
    alert("Enter an activity or event name");
    return;
  }

  const {error} = await supabaseClient
    .from("at_kit_lists")
    .insert([{
      activity_name: name,
      notes,
      active: true
    }]);

  if(error){
    console.error(error);
    alert("Could not create kit list");
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
    alert("Select a kit list and enter an item");
    return;
  }

  const existing = kitListItems.filter(x => String(x.kit_list_id) === String(kitListId));

  const {error} = await supabaseClient
    .from("at_kit_list_items")
    .insert([{
      kit_list_id: kitListId,
      kit_type: item,
      required,
      display_order: existing.length + 1
    }]);

  if(error){
    console.error(error);
    alert("Could not add item to kit list");
    return;
  }

  document.getElementById("kitListItem").value = "";

  await loadKitLists();
}

function renderKitListItems(){
  const table = document.getElementById("kitListItemsTable");
  if(!table) return;

  table.innerHTML = "";

  if(!kitListItems.length){
    table.innerHTML = `<tr><td colspan="3" class="no-data">No kit list items found</td></tr>`;
    return;
  }

  kitListItems.forEach(item => {
    const list = kitLists.find(x => String(x.id) === String(item.kit_list_id));

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
  const select = document.getElementById("eventIssueDropdown");
  if(!select) return;

  const current = select.value;

  select.innerHTML = `<option value="">Select Event</option>`;

  kitLists.forEach(list => {
    select.innerHTML += `
      <option value="${list.id}">
        ${escapeHtml(list.activity_name)}
      </option>
    `;
  });

  select.value = current;
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

  if(!rows.length){
    table.innerHTML = `<tr><td colspan="5" class="no-data">No event issue records found</td></tr>`;
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

/* KIT CHECKER */

function populateCheckerLists(){
  const select = document.getElementById("kitCheckerEvent");
  if(!select) return;

  const current = select.value;

  select.innerHTML = `<option value="">Select Event</option>`;

  kitLists.forEach(list => {
    select.innerHTML += `
      <option value="${list.id}">
        ${escapeHtml(list.activity_name)}
      </option>
    `;
  });

  select.value = current;
}

function loadKitChecker(){
  selectedCheckerListId = document.getElementById("kitCheckerEvent")?.value || "";
  renderKitCheckerCadets();
  renderMultiIssueTable();
}

function loadKitCheckerEvent(){
  loadKitChecker();
}

function saveKitCheckerCadets(){
  const eventId = document.getElementById("kitCheckerEvent").value;
  const text = document.getElementById("kitCheckerCadets").value;

  if(!eventId){
    alert("Select an event first");
    return;
  }

  const cadets = text
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean);

  if(!cadets.length){
    alert("Enter at least one cadet");
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

  alert("Cadets saved");
}

function renderKitCheckerCadets(){
  const table = document.getElementById("kitCheckerCadetTable");
  if(!table) return;

  table.innerHTML = "";

  if(!selectedCheckerListId){
    table.innerHTML = `<tr><td colspan="2" class="no-data">Select an event</td></tr>`;
    return;
  }

  const cadets = eventCadets[selectedCheckerListId] || [];

  if(!cadets.length){
    table.innerHTML = `<tr><td colspan="2" class="no-data">No cadets saved for this event</td></tr>`;
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

  if(!modal || !title || !checklist) return;

  title.innerText = "Issue kit to " + cadet;
  checklist.innerHTML = "";

  const items = kitListItems
    .filter(x => String(x.kit_list_id) === String(selectedCheckerListId))
    .sort((a,b) => Number(a.display_order || 0) - Number(b.display_order || 0));

  if(!items.length){
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
  if(modal) modal.style.display = "none";
  modalCadet = "";
}

function confirmMultiIssueSelection(){
  const checked = Array
    .from(document.querySelectorAll(".modal-kit-check:checked"))
    .map(x => x.value);

  if(!checked.length){
    alert("Select at least one kit item");
    return;
  }

  const event = kitLists.find(x => String(x.id) === String(selectedCheckerListId));

  checked.forEach(kitType => {
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

  const rows = eventIssueRows.filter(row =>
    String(row.eventId) === String(selectedCheckerListId) &&
    !row.dateIssued
  );

  if(!selectedCheckerListId){
    table.innerHTML = `<tr><td colspan="6" class="no-data">Select an event</td></tr>`;
    return;
  }

  if(!rows.length){
    table.innerHTML = `<tr><td colspan="6" class="no-data">No kit selected for issue</td></tr>`;
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
    .filter(x => x.kit_type === type)
    .filter(x => (x.status || "Available") === "Available" || x.kit_number === selectedNumber)
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
  const row = eventIssueRows.find(x => String(x.id) === String(rowId));
  if(!row) return;

  row.itemNumber = number;
  saveLocal();
}

async function issueEventKit(rowId){
  const row = eventIssueRows.find(x => String(x.id) === String(rowId));

  if(!row){
    alert("Issue row not found");
    return;
  }

  if(!row.itemNumber){
    alert("Select the item number given");
    return;
  }

  const item = atKit.find(x =>
    x.kit_type === row.kitType &&
    x.kit_number === row.itemNumber
  );

  if(!item){
    alert("AT kit item not found");
    return;
  }

  if((item.status || "Available") !== "Available"){
    alert("This item is not available");
    return;
  }

  const {error:updateError} = await supabaseClient
    .from("at_kit")
    .update({
      status: "Issued",
      updated_at: todayISO()
    })
    .eq("id", item.id);

  if(updateError){
    console.error(updateError);
    alert("Could not update item status");
    return;
  }

  const {error:insertError} = await supabaseClient
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
    alert("Kit was marked issued but history did not save");
    return;
  }

  row.dateIssued = todayISO();

  saveLocal();

  await loadATKit();
  await loadATIssues();

  renderMultiIssueTable();
  renderEventIssueSheet();
}

function removeEventIssueRow(rowId){
  eventIssueRows = eventIssueRows.filter(x => String(x.id) !== String(rowId));
  saveLocal();
  renderMultiIssueTable();
  renderEventIssueSheet();
}
/* CADET AT REQUESTS */

function populateCadetATEvents(){
  const select = document.getElementById("cadetATEvent");
  if(!select) return;

  select.innerHTML = `<option value="">Select Event</option>`;

  kitLists.forEach(list => {
    select.innerHTML += `
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
    .filter(x => String(x.kit_list_id) === String(eventId))
    .sort((a,b) => Number(a.display_order || 0) - Number(b.display_order || 0));

  if(!items.length){
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
    alert("Enter your name and select an event");
    return;
  }

  const event = kitLists.find(x => String(x.id) === String(eventId));

  const selectedItems = Array
    .from(document.querySelectorAll(".cadet-at-kit-check:checked"))
    .map(x => x.value);

  if(!selectedItems.length){
    alert("Tick at least one item");
    return;
  }

  const {error} = await supabaseClient
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
    alert("Could not submit AT kit request");
    return;
  }

  alert("AT kit request submitted");

  document.getElementById("cadetATName").value = "";
  document.getElementById("cadetATEvent").value = "";
  document.getElementById("cadetATKitChecklist").innerHTML = "";
}

async function loadATRequests(){
  const {data,error} = await supabaseClient
    .from("at_kit_requests")
    .select("*")
    .order("requested_at",{ascending:false});

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

  if(!atRequests.length){
    table.innerHTML = `<tr><td colspan="4" class="no-data">No AT kit requests found</td></tr>`;
    return;
  }

  atRequests.forEach(x => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(x.cadet_name)}</td>
        <td>${escapeHtml(x.activity_name)}</td>
        <td>${escapeHtml(Array.isArray(x.requested_items) ? x.requested_items.join(", ") : x.kit_type)}</td>
        <td>${formatDate(x.requested_at || x.created_at)}</td>
      </tr>
    `;
  });
}

/* SERVICEABILITY CHECKS */

async function loadServiceChecks(){
  const {data,error} = await supabaseClient
    .from("serviceability_checks")
    .select("*")
    .order("next_due_date",{ascending:true});

  if(error){
    console.error(error);
    serviceChecks = [];
    renderServiceability();
    return;
  }

  serviceChecks = data || [];
  renderServiceability();
}

function populateServiceKitItems(){
  const select = document.getElementById("serviceItemNumber");
  if(!select) return;

  // This input is intentionally free text, but we add a datalist if possible.
}

async function addServiceabilityCheck(){
  const itemNumber = document.getElementById("serviceItemNumber").value.trim();
  const lastCheck = document.getElementById("serviceCheckDate").value;
  const interval = Number(document.getElementById("serviceInterval").value || 365);

  if(!itemNumber || !lastCheck || interval < 1){
    alert("Enter item number, last check date and interval");
    return;
  }

  const nextDue = new Date(lastCheck);
  nextDue.setDate(nextDue.getDate() + interval);

  const {error} = await supabaseClient
    .from("serviceability_checks")
    .insert([{
      item_number: itemNumber,
      last_check_date: lastCheck,
      interval_days: interval,
      next_due_date: nextDue.toISOString().slice(0,10)
    }]);

  if(error){
    console.error(error);
    alert("Could not save serviceability check. Check the database table exists.");
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

  if(!serviceChecks.length){
    table.innerHTML = `<tr><td colspan="4" class="no-data">No serviceability checks found</td></tr>`;
    return;
  }

  const today = new Date();

  serviceChecks.forEach(row => {
    const due = new Date(row.next_due_date);
    const diffMs = due - today;
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let statusClass = "";
    if(days <= 0) statusClass = "out-stock";
    else if(days <= 30) statusClass = "low-stock";
    else statusClass = "good-stock";

    table.innerHTML += `
      <tr class="${statusClass}">
        <td>${escapeHtml(row.item_number)}</td>
        <td>${escapeHtml(row.last_check_date)}</td>
        <td>${escapeHtml(row.next_due_date)}</td>
        <td>${days}</td>
      </tr>
    `;
  });
}
/* STARTUP */

document.addEventListener("DOMContentLoaded", () => {
  hideAll();
  document.getElementById("homeScreen").classList.remove("hidden");
});

  try{
    await loadKitLists();
    await loadUniformStock();
  }catch(error){
    console.error(error);
  }
});
