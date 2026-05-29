const SUPABASE_URL = "https://oskorapwgvoecvtdtkwi.supabase.co";
const SUPABASE_KEY = "sb_publishable_Zm5qgcsjzsuzicBwa6Z0sA_qgn-Gm5R";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const STAFF_PASSWORD = "1384-Staff";

let loggedInMode = null;

let allUniformStock = [];
let allUniformIssueHistory = [];
let allUniformRequests = [];

let allATKit = [];
let allATIssueHistory = [];
let allATRequests = [];
let allATKitLists = [];
let allATKitListItems = [];
let allATBorrowCounts = {};

let allTempPasswords = [];

let currentKitCheckEvent = null;

function hideAllScreens(){
  document.getElementById("homeScreen").style.display = "none";
  document.getElementById("staffLoginScreen").style.display = "none";
  document.getElementById("mainContent").style.display = "none";
  document.getElementById("uniformRequestPage").style.display = "none";
  document.getElementById("atRequestPage").style.display = "none";
}

function backHome(){
  loggedInMode = null;
  hideAllScreens();
  document.getElementById("homeScreen").style.display = "flex";
}

function openStaffLogin(){
  hideAllScreens();
  document.getElementById("staffLoginScreen").style.display = "flex";
}

async function openUniformRequest(){
  hideAllScreens();
  document.getElementById("uniformRequestPage").style.display = "block";
  await loadUniformStock();
}

async function openATRequest(){
  hideAllScreens();
  document.getElementById("atRequestPage").style.display = "block";
  await loadATKit();
  await loadATKitLists();
}

function logout(){
  backHome();
}

async function staffLogin(){
  const enteredPassword = document.getElementById("staffPasswordInput").value.trim();

  if(enteredPassword === STAFF_PASSWORD){
    loggedInMode = "staff";
    await openFullSite("Staff Account");
    return;
  }

  try{
    const { data, error } = await supabaseClient
      .from("temporary_passwords")
      .select("*")
      .eq("password", enteredPassword)
      .eq("active", true);

    if(error){
      console.log(error);
    }

    if(data && data.length > 0){
      const validPassword = data.find(p => new Date(p.expires_at) > new Date());

      if(validPassword){
        loggedInMode = "temporary";
        await openFullSite("Temporary Full Access");
        return;
      }
    }
  }catch(err){
    console.log(err);
  }

  alert("Incorrect password");
}

async function openFullSite(label){
  hideAllScreens();

  document.getElementById("mainContent").style.display = "block";
  document.getElementById("loggedInAs").innerText = `Logged in as: ${label}`;

  const pageSelect = document.getElementById("pageSelect");

  if(loggedInMode === "staff"){
    pageSelect.innerHTML = `
      <option value="uniformStockPage">Uniform - Current Stock</option>
      <option value="uniformIssuePage">Uniform - Issue Kit</option>
      <option value="uniformHistoryPage">Uniform - Issue History</option>
      <option value="uniformRequestsPage">Uniform - Requests</option>
      <option value="atStockPage">AT Kit - Current Kit</option>
      <option value="atIssuePage">AT Kit - Issue Kit</option>
      <option value="atReturnPage">AT Kit - Return Kit</option>
      <option value="atHistoryPage">AT Kit - Issue History</option>
      <option value="atRequestsPage">AT Kit - Requests</option>
      <option value="atKitListsPage">AT Kit - Kit Lists</option>
      <option value="kitCheckPage">AT Kit - Event Kit Check</option>
      <option value="tempPasswordPage">Temporary Passwords</option>
    `;
  } else {
    pageSelect.innerHTML = `
      <option value="uniformStockPage">Uniform - Current Stock</option>
      <option value="uniformIssuePage">Uniform - Issue Kit</option>
      <option value="uniformHistoryPage">Uniform - Issue History</option>
      <option value="uniformRequestsPage">Uniform - Requests</option>
      <option value="atStockPage">AT Kit - Current Kit</option>
      <option value="atIssuePage">AT Kit - Issue Kit</option>
      <option value="atReturnPage">AT Kit - Return Kit</option>
      <option value="atHistoryPage">AT Kit - Issue History</option>
      <option value="kitCheckPage">AT Kit - Event Kit Check</option>
      <option value="atRequestsPage">AT Kit - Requests</option>
    `;
  }

  pageSelect.value = "uniformStockPage";

  await loadUniformStock();
  await loadUniformIssueHistory();
  await loadUniformRequests();
  await loadATKit();
  await loadATIssueHistory();
  await loadATRequests();
  await loadATKitLists();

  if(loggedInMode === "staff"){
    await loadTemporaryPasswords();
  }

  changePage();
}

function changePage(){
  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active-page");
  });

  const selected = document.getElementById("pageSelect").value;

  if(loggedInMode !== "staff" && selected === "tempPasswordPage"){
    alert("Only the staff account can access temporary passwords.");
    document.getElementById("pageSelect").value = "uniformStockPage";
    document.getElementById("uniformStockPage").classList.add("active-page");
    return;
  }

  document.getElementById(selected).classList.add("active-page");

  if(selected === "kitCheckPage"){
    loadKitCheckEvents();
  }
}

/* UNIFORM STOCK */

async function loadUniformStock(){
  const { data, error } = await supabaseClient
    .from("uniform_stock")
    .select("*")
    .order("item", { ascending:true });

  if(error){
    console.log(error);
    alert("Error loading uniform stock");
    return;
  }

  allUniformStock = data || [];
  displayUniformStock(allUniformStock);
  populateUniformDropdowns();
}

function displayUniformStock(stock){
  const table = document.getElementById("uniformStockTable");
  if(!table) return;

  table.innerHTML = "";

  if(!stock || stock.length === 0){
    table.innerHTML = `<tr><td colspan="4" class="no-data">No uniform stock found</td></tr>`;
    return;
  }

  stock.forEach(item => {
    const low = Number(item.quantity) <= Number(item.warning_level || 1) ? "low-stock" : "";

    table.innerHTML += `
      <tr>
        <td>${escapeHtml(item.item || "")}</td>
        <td>${escapeHtml(item.size || "")}</td>
        <td>${escapeHtml(item.box_number || "")}</td>
        <td class="${low}">${item.quantity || 0}</td>
      </tr>
    `;
  });
}

function searchUniformStock(){
  const input = document.getElementById("uniformSearchInput");
  if(!input) return;

  const search = input.value.toLowerCase();

  const filtered = allUniformStock.filter(item =>
    item.item?.toLowerCase().includes(search) ||
    item.size?.toLowerCase().includes(search) ||
    item.box_number?.toString().toLowerCase().includes(search)
  );

  displayUniformStock(filtered);
}

function populateUniformDropdowns(){
  const uniqueItems = [...new Set(allUniformStock.map(x => x.item))]
    .filter(Boolean)
    .sort();

  ["uniformIssueItem", "uniformRequestItem"].forEach(id => {
    const dropdown = document.getElementById(id);
    if(!dropdown) return;

    dropdown.innerHTML = `<option value="">Select Item</option>`;

    uniqueItems.forEach(item => {
      dropdown.innerHTML += `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`;
    });
  });
}

function updateUniformIssueSizeDropdown(){
  const itemDropdown = document.getElementById("uniformIssueItem");
  const sizeDropdown = document.getElementById("uniformIssueSize");

  if(!itemDropdown || !sizeDropdown) return;

  const item = itemDropdown.value;

  sizeDropdown.innerHTML = `<option value="">Select Size</option>`;

  const sizes = [...new Set(allUniformStock.filter(x => x.item === item).map(x => x.size))]
    .filter(Boolean)
    .sort();

  sizes.forEach(size => {
    sizeDropdown.innerHTML += `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`;
  });

  updateUniformBoxInfo();
}

function updateUniformRequestSizeDropdown(){
  const itemDropdown = document.getElementById("uniformRequestItem");
  const sizeDropdown = document.getElementById("uniformRequestSize");

  if(!itemDropdown || !sizeDropdown) return;

  const item = itemDropdown.value;

  sizeDropdown.innerHTML = `<option value="">Select Size</option>`;

  const sizes = [...new Set(allUniformStock.filter(x => x.item === item).map(x => x.size))]
    .filter(Boolean)
    .sort();

  sizes.forEach(size => {
    sizeDropdown.innerHTML += `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`;
  });
}

function updateUniformBoxInfo(){
  const itemDropdown = document.getElementById("uniformIssueItem");
  const sizeDropdown = document.getElementById("uniformIssueSize");
  const box = document.getElementById("uniformSelectedStockInfo");

  if(!itemDropdown || !sizeDropdown || !box) return;

  const item = itemDropdown.value;
  const size = sizeDropdown.value;

  if(!item || !size){
    box.innerHTML = "Select an item and size.";
    return;
  }

  const matches = allUniformStock.filter(x => x.item === item && x.size === size);
  const total = matches.reduce((sum, x) => sum + Number(x.quantity || 0), 0);

  box.innerHTML = `
    <strong>Available:</strong> ${total}<br>
    <strong>Boxes:</strong><br>
    ${matches.map(x => `${escapeHtml(x.box_number || "No box")} - Qty ${x.quantity}`).join("<br>")}
  `;
}

/* UNIFORM ISSUE / HISTORY / REQUESTS */

async function issueUniform(){
  if(!loggedInMode){
    alert("You do not have permission.");
    return;
  }

  const cadetName = document.getElementById("uniformIssueCadetName").value.trim();
  const item = document.getElementById("uniformIssueItem").value;
  const size = document.getElementById("uniformIssueSize").value;
  const qty = parseInt(document.getElementById("uniformIssueQty").value);

  if(!cadetName || !item || !size || !qty || qty < 1){
    alert("Complete all fields.");
    return;
  }

  const matchingStock = allUniformStock
    .filter(x => x.item === item && x.size === size && Number(x.quantity) > 0)
    .sort((a,b) => Number(b.quantity) - Number(a.quantity));

  let remaining = qty;
  const issueRecords = [];

  for(const stockLine of matchingStock){
    if(remaining <= 0) break;

    const available = Number(stockLine.quantity);
    const taken = Math.min(available, remaining);
    const newQty = available - taken;

    const { error:updateError } = await supabaseClient
      .from("uniform_stock")
      .update({
        quantity:newQty,
        updated_at:new Date().toISOString()
      })
      .eq("id", stockLine.id);

    if(updateError){
      console.log(updateError);
      alert("Error updating uniform stock.");
      return;
    }

    issueRecords.push({
      cadet_name:cadetName,
      item:stockLine.item,
      size:stockLine.size,
      box_number:stockLine.box_number,
      quantity:taken,
      issued_by: loggedInMode === "staff" ? "Staff Account" : "Temporary Access",
      returned:false
    });

    remaining -= taken;
  }

  if(remaining > 0){
    alert("Not enough uniform stock available.");
    await loadUniformStock();
    return;
  }

  const { error:insertError } = await supabaseClient
    .from("uniform_issues")
    .insert(issueRecords);

  if(insertError){
    console.log(insertError);
    alert("Stock updated but uniform issue history failed.");
    return;
  }

  alert("Uniform issued successfully.");

  document.getElementById("uniformIssueCadetName").value = "";
  document.getElementById("uniformIssueItem").value = "";
  document.getElementById("uniformIssueSize").innerHTML = `<option value="">Select Size</option>`;
  document.getElementById("uniformIssueQty").value = 1;

  await loadUniformStock();
  await loadUniformIssueHistory();
}

async function loadUniformIssueHistory(){
  const { data, error } = await supabaseClient
    .from("uniform_issues")
    .select("*")
    .order("issue_date", { ascending:false });

  if(error){
    console.log(error);
    return;
  }

  allUniformIssueHistory = data || [];
  displayUniformIssueHistory(allUniformIssueHistory);
}

function displayUniformIssueHistory(history){
  const table = document.getElementById("uniformIssueHistoryTable");
  if(!table) return;

  table.innerHTML = "";

  if(!history || history.length === 0){
    table.innerHTML = `<tr><td colspan="7" class="no-data">No uniform issue history found</td></tr>`;
    return;
  }

  history.forEach(r => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(r.cadet_name || "")}</td>
        <td>${escapeHtml(r.item || "")}</td>
        <td>${escapeHtml(r.size || "")}</td>
        <td>${escapeHtml(r.box_number || "")}</td>
        <td>${r.quantity || ""}</td>
        <td>${formatDate(r.issue_date)}</td>
        <td>${r.returned ? "Yes" : "No"}</td>
      </tr>
    `;
  });
}

function searchUniformIssueHistory(){
  const input = document.getElementById("uniformHistorySearchInput");
  if(!input) return;

  const search = input.value.toLowerCase();

  const filtered = allUniformIssueHistory.filter(r =>
    r.cadet_name?.toLowerCase().includes(search) ||
    r.item?.toLowerCase().includes(search) ||
    r.size?.toLowerCase().includes(search) ||
    r.box_number?.toString().toLowerCase().includes(search)
  );

  displayUniformIssueHistory(filtered);
}

async function submitUniformRequest(){
  const cadetName = document.getElementById("uniformRequestCadetName").value.trim();
  const item = document.getElementById("uniformRequestItem").value;
  const size = document.getElementById("uniformRequestSize").value;
  const reason = document.getElementById("uniformRequestReason").value.trim();

  if(!cadetName || !item || !size){
    alert("Please complete your name, item and size.");
    return;
  }

  const { error } = await supabaseClient
    .from("uniform_requests")
    .insert([{
      cadet_name:cadetName,
      item,
      size,
      reason,
      status:"Pending"
    }]);

  if(error){
    console.log(error);
    alert("Uniform request failed.");
    return;
  }

  alert("Uniform request submitted successfully.");

  document.getElementById("uniformRequestCadetName").value = "";
  document.getElementById("uniformRequestItem").value = "";
  document.getElementById("uniformRequestSize").innerHTML = `<option value="">Select Size</option>`;
  document.getElementById("uniformRequestReason").value = "";
}

async function loadUniformRequests(){
  const { data, error } = await supabaseClient
    .from("uniform_requests")
    .select("*")
    .order("requested_at", { ascending:false });

  if(error){
    console.log(error);
    return;
  }

  allUniformRequests = data || [];
  displayUniformRequests();
}

function displayUniformRequests(){
  const table = document.getElementById("uniformRequestsTable");
  if(!table) return;

  table.innerHTML = "";

  if(!allUniformRequests || allUniformRequests.length === 0){
    table.innerHTML = `<tr><td colspan="7" class="no-data">No uniform requests found</td></tr>`;
    return;
  }

  allUniformRequests.forEach(r => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(r.cadet_name || "")}</td>
        <td>${escapeHtml(r.item || "")}</td>
        <td>${escapeHtml(r.size || "")}</td>
        <td>${escapeHtml(r.reason || "")}</td>
        <td>${escapeHtml(r.status || "")}</td>
        <td>${formatDate(r.requested_at)}</td>
        <td>
          <button class="small-btn approve-btn" onclick="updateUniformRequestStatus(${r.id}, 'Approved')">Approve</button>
          <button class="small-btn reject-btn" onclick="updateUniformRequestStatus(${r.id}, 'Rejected')">Reject</button>
        </td>
      </tr>
    `;
  });
}

async function updateUniformRequestStatus(id, status){
  const { error } = await supabaseClient
    .from("uniform_requests")
    .update({
      status,
      reviewed_by: loggedInMode === "staff" ? "Staff Account" : "Temporary Access",
      reviewed_at:new Date().toISOString()
    })
    .eq("id", id);

  if(error){
    console.log(error);
    alert("Could not update uniform request.");
    return;
  }

  await loadUniformRequests();
}

/* AT KIT STOCK */

async function loadATKit(){
  const { data, error } = await supabaseClient
    .from("at_kit")
    .select("*")
    .order("kit_type", { ascending:true });

  if(error){
    console.log(error);
    return;
  }

  allATKit = data || [];
  await loadATBorrowCounts();
  displayATKit(allATKit);
  populateATDropdowns();
}

async function loadATBorrowCounts(){
  const { data, error } = await supabaseClient
    .from("at_kit_issues")
    .select("kit_id, kit_type, kit_number");

  if(error){
    console.log(error);
    allATBorrowCounts = {};
    return;
  }

  allATBorrowCounts = {};

  (data || []).forEach(record => {
    const key = record.kit_id
      ? `id-${record.kit_id}`
      : `${record.kit_type || ""}-${record.kit_number || ""}`;

    allATBorrowCounts[key] = (allATBorrowCounts[key] || 0) + 1;
  });
}

function getATBorrowCount(item){
  const keyById = `id-${item.id}`;
  const keyByName = `${item.kit_type || ""}-${item.kit_number || ""}`;

  return allATBorrowCounts[keyById] || allATBorrowCounts[keyByName] || 0;
}

function displayATKit(kit){
  const table = document.getElementById("atKitTable");
  if(!table) return;

  table.innerHTML = "";

  if(!kit || kit.length === 0){
    table.innerHTML = `<tr><td colspan="8" class="no-data">No AT kit found</td></tr>`;
    return;
  }

  kit.forEach(item => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(item.kit_type || "")}</td>
        <td>${escapeHtml(item.kit_number || "")}</td>
        <td>${escapeHtml(item.size || "")}</td>
        <td>${escapeHtml(item.condition || "")}</td>
        <td>${escapeHtml(item.status || "")}</td>
        <td>${escapeHtml(item.location || "")}</td>
        <td>${escapeHtml(item.notes || "")}</td>
        <td>${getATBorrowCount(item)}</td>
      </tr>
    `;
  });
}

async function loadUniformRequests(){
  const { data, error } = await supabaseClient
    .from("uniform_requests")
    .select("*")
    .order("requested_at", { ascending:false });

  if(error){
    console.log(error);
    return;
  }

  allUniformRequests = data || [];
  displayUniformRequests();
}

function displayUniformRequests(){
  const table = document.getElementById("uniformRequestsTable");
  if(!table) return;

  table.innerHTML = "";

  if(!allUniformRequests || allUniformRequests.length === 0){
    table.innerHTML = `<tr><td colspan="7" class="no-data">No uniform requests found</td></tr>`;
    return;
  }

  allUniformRequests.forEach(r => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(r.cadet_name || "")}</td>
        <td>${escapeHtml(r.item || "")}</td>
        <td>${escapeHtml(r.size || "")}</td>
        <td>${escapeHtml(r.reason || "")}</td>
        <td>${escapeHtml(r.status || "")}</td>
        <td>${formatDate(r.requested_at)}</td>
        <td>
          <button class="small-btn approve-btn" onclick="updateUniformRequestStatus(${r.id}, 'Approved')">Approve</button>
          <button class="small-btn reject-btn" onclick="updateUniformRequestStatus(${r.id}, 'Rejected')">Reject</button>
        </td>
      </tr>
    `;
  });
}

async function updateUniformRequestStatus(id, status){
  const { error } = await supabaseClient
    .from("uniform_requests")
    .update({
      status,
      reviewed_by: loggedInMode === "staff" ? "Staff Account" : "Temporary Access",
      reviewed_at:new Date().toISOString()
    })
    .eq("id", id);

  if(error){
    console.log(error);
    alert("Could not update uniform request.");
    return;
  }

  await loadUniformRequests();
}

/* AT KIT STOCK */

async function loadATKit(){
  const { data, error } = await supabaseClient
    .from("at_kit")
    .select("*")
    .order("kit_type", { ascending:true });

  if(error){
    console.log(error);
    return;
  }

  allATKit = data || [];
  await loadATBorrowCounts();
  displayATKit(allATKit);
  populateATDropdowns();
}

async function loadATBorrowCounts(){
  const { data, error } = await supabaseClient
    .from("at_kit_issues")
    .select("kit_id, kit_type, kit_number");

  if(error){
    console.log(error);
    allATBorrowCounts = {};
    return;
  }

  allATBorrowCounts = {};

  (data || []).forEach(record => {
    const key = record.kit_id
      ? `id-${record.kit_id}`
      : `${record.kit_type || ""}-${record.kit_number || ""}`;

    allATBorrowCounts[key] = (allATBorrowCounts[key] || 0) + 1;
  });
}

function getATBorrowCount(item){
  const keyById = `id-${item.id}`;
  const keyByName = `${item.kit_type || ""}-${item.kit_number || ""}`;

  return allATBorrowCounts[keyById] || allATBorrowCounts[keyByName] || 0;
}

function displayATKit(kit){
  const table = document.getElementById("atKitTable");
  if(!table) return;

  table.innerHTML = "";

  if(!kit || kit.length === 0){
    table.innerHTML = `<tr><td colspan="8" class="no-data">No AT kit found</td></tr>`;
    return;
  }

  kit.forEach(item => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(item.kit_type || "")}</td>
        <td>${escapeHtml(item.kit_number || "")}</td>
        <td>${escapeHtml(item.size || "")}</td>
        <td>${escapeHtml(item.condition || "")}</td>
        <td>${escapeHtml(item.status || "")}</td>
        <td>${escapeHtml(item.location || "")}</td>
        <td>${escapeHtml(item.notes || "")}</td>
        <td>${getATBorrowCount(item)}</td>
      </tr>
    `;
  });
}

function searchATKit(){
  const input = document.getElementById("atSearchInput");
  if(!input) return;

  const search = input.value.toLowerCase();

  const filtered = allATKit.filter(item =>
    item.kit_type?.toLowerCase().includes(search) ||
    item.kit_number?.toLowerCase().includes(search) ||
    item.status?.toLowerCase().includes(search) ||
    item.location?.toLowerCase().includes(search)
  );

  displayATKit(filtered);
}

async function addATKit(){
  if(loggedInMode !== "staff"){
    alert("Only staff can add AT kit.");
    return;
  }

  const kitType = document.getElementById("newATType").value.trim();
  const kitNumber = document.getElementById("newATNumber").value.trim();
  const size = document.getElementById("newATSize").value.trim();
  const location = document.getElementById("newATLocation").value.trim();
  const description = document.getElementById("newATDescription").value.trim();
  const condition = document.getElementById("newATCondition").value.trim() || "Good";
  const notes = document.getElementById("newATNotes").value.trim();

  if(!kitType || !kitNumber){
    alert("Kit type and kit number are required.");
    return;
  }

  const { error } = await supabaseClient
    .from("at_kit")
    .insert([{
      kit_type:kitType,
      kit_number:kitNumber,
      size,
      location,
      description,
      condition,
      notes,
      status:"Available"
    }]);

  if(error){
    console.log(error);
    alert("Could not add AT kit. Check the kit number is not already used.");
    return;
  }

  alert("AT kit added.");

  document.getElementById("newATType").value = "";
  document.getElementById("newATNumber").value = "";
  document.getElementById("newATSize").value = "";
  document.getElementById("newATLocation").value = "";
  document.getElementById("newATDescription").value = "";
  document.getElementById("newATCondition").value = "Good";
  document.getElementById("newATNotes").value = "";

  await loadATKit();
}

function populateATDropdowns(){
  const kitTypes = [...new Set(allATKit.map(x => x.kit_type))]
    .filter(Boolean)
    .sort();

  const issueDropdown = document.getElementById("atIssueKitType");

  if(issueDropdown){
    issueDropdown.innerHTML = `<option value="">Select Kit Type</option>`;

    kitTypes.forEach(type => {
      issueDropdown.innerHTML += `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`;
    });
  }

  populateATReturnDropdown();
}

function updateATNumberDropdown(){
  const kitTypeDropdown = document.getElementById("atIssueKitType");
  const numberDropdown = document.getElementById("atIssueKitNumber");

  if(!kitTypeDropdown || !numberDropdown) return;

  const kitType = kitTypeDropdown.value;

  numberDropdown.innerHTML = `<option value="">Select Kit Number</option>`;

  const availableKit = allATKit
    .filter(x => x.kit_type === kitType && x.status === "Available")
    .sort((a,b) => String(a.kit_number || "").localeCompare(String(b.kit_number || "")));

  availableKit.forEach(item => {
    numberDropdown.innerHTML += `<option value="${item.id}">${escapeHtml(item.kit_number || "")}</option>`;
  });

  updateATKitInfo();
}

function updateATKitInfo(){
  const numberDropdown = document.getElementById("atIssueKitNumber");
  const box = document.getElementById("atSelectedKitInfo");

  if(!numberDropdown || !box) return;

  const kitId = numberDropdown.value;
  const item = allATKit.find(x => String(x.id) === String(kitId));

  if(!item){
    box.innerHTML = "Select an AT kit type and kit number.";
    return;
  }

  box.innerHTML = `
    <strong>Type:</strong> ${escapeHtml(item.kit_type || "")}<br>
    <strong>Number:</strong> ${escapeHtml(item.kit_number || "")}<br>
    <strong>Size:</strong> ${escapeHtml(item.size || "")}<br>
    <strong>Condition:</strong> ${escapeHtml(item.condition || "")}<br>
    <strong>Location:</strong> ${escapeHtml(item.location || "")}<br>
    <strong>Borrowed before:</strong> ${getATBorrowCount(item)} time(s)
  `;
}

/* AT ISSUE / RETURN */

async function issueATKit(){
  if(!loggedInMode){
    alert("You do not have permission.");
    return;
  }

  const cadetName = document.getElementById("atIssueCadetName").value.trim();
  const kitId = document.getElementById("atIssueKitNumber").value;
  const notes = document.getElementById("atIssueNotes").value.trim();

  const item = allATKit.find(x => String(x.id) === String(kitId));

  if(!cadetName || !item){
    alert("Complete cadet name and select kit.");
    return;
  }

  if(item.status !== "Available"){
    alert("This kit is not available.");
    return;
  }

  const { error:updateError } = await supabaseClient
    .from("at_kit")
    .update({
      status:"Issued",
      updated_at:new Date().toISOString()
    })
    .eq("id", item.id);

  if(updateError){
    console.log(updateError);
    alert("Could not update AT kit status.");
    return;
  }

  const { error:insertError } = await supabaseClient
    .from("at_kit_issues")
    .insert([{
      kit_id:item.id,
      kit_type:item.kit_type,
      kit_number:item.kit_number,
      cadet_name:cadetName,
      issued_by: loggedInMode === "staff" ? "Staff Account" : "Temporary Access",
      returned:false,
      notes
    }]);

  if(insertError){
    console.log(insertError);
    alert("Kit marked as issued but history did not save.");
    return;
  }

  alert("AT kit issued.");

  document.getElementById("atIssueCadetName").value = "";
  document.getElementById("atIssueKitType").value = "";
  document.getElementById("atIssueKitNumber").innerHTML = `<option value="">Select Kit Number</option>`;
  document.getElementById("atIssueNotes").value = "";

  await loadATKit();
  await loadATIssueHistory();
}

/* AT KIT LISTS */

async function loadATKitLists(){
  const { data: lists, error: listError } = await supabaseClient
    .from("at_kit_lists")
    .select("*")
    .eq("active", true)
    .order("activity_name", { ascending:true });

  if(listError){
    console.log(listError);
    return;
  }

  const { data: items, error: itemError } = await supabaseClient
    .from("at_kit_list_items")
    .select("*")
    .order("display_order", { ascending:true });

  if(itemError){
    console.log(itemError);
    return;
  }

  allATKitLists = lists || [];
  allATKitListItems = items || [];

  populateATKitListDropdowns();
  populateKitCheckDropdown();
  await loadKitCheckEvents();
}

function populateATKitListDropdowns(){
  const staffDropdown = document.getElementById("kitListSelect");
  const cadetDropdown = document.getElementById("atRequestActivity");

  if(staffDropdown){
    staffDropdown.innerHTML = `<option value="">Select Kit List</option>`;

    allATKitLists.forEach(list => {
      staffDropdown.innerHTML += `
        <option value="${list.id}">
          ${escapeHtml(list.activity_name || "Unnamed Kit List")}
        </option>
      `;
    });
  }

  if(cadetDropdown){
    cadetDropdown.innerHTML = `<option value="">Select Activity</option>`;

    allATKitLists.forEach(list => {
      cadetDropdown.innerHTML += `
        <option value="${list.id}">
          ${escapeHtml(list.activity_name || "Unnamed Kit List")}
        </option>
      `;
    });
  }
}

async function createATKitList(){
  if(loggedInMode !== "staff"){
    alert("Only staff can create kit lists.");
    return;
  }

  const activityName = document.getElementById("newKitListName").value.trim();
  const notes = document.getElementById("newKitListNotes").value.trim();

  if(!activityName){
    alert("Enter an activity name.");
    return;
  }

  const { error } = await supabaseClient
    .from("at_kit_lists")
    .insert([{
      activity_name: activityName,
      notes,
      active: true
    }]);

  if(error){
    console.log(error);
    alert("Could not create kit list. It may already exist.");
    return;
  }

  alert("Kit list created.");

  document.getElementById("newKitListName").value = "";
  document.getElementById("newKitListNotes").value = "";

  await loadATKitLists();
}

async function addItemToKitList(){
  if(loggedInMode !== "staff"){
    alert("Only staff can edit kit lists.");
    return;
  }

  const kitListId = document.getElementById("kitListSelect").value;
  const item = document.getElementById("newKitListItem").value.trim();
  const required = document.getElementById("newKitListRequired").value === "true";

  if(!kitListId || !item){
    alert("Select a kit list and enter an item.");
    return;
  }

  const currentItems = allATKitListItems.filter(x => String(x.kit_list_id) === String(kitListId));

  const { error } = await supabaseClient
    .from("at_kit_list_items")
    .insert([{
      kit_list_id: kitListId,
      kit_type: item,
      required,
      display_order: currentItems.length + 1
    }]);

  if(error){
    console.log(error);
    alert("Could not add item.");
    return;
  }

  document.getElementById("newKitListItem").value = "";

  await loadATKitLists();
  loadSelectedKitListItems();
}

async function bulkAddItemsToKitList(){
  if(loggedInMode !== "staff"){
    alert("Only staff can edit kit lists.");
    return;
  }

  const kitListId = document.getElementById("kitListSelect").value;
  const bulkText = document.getElementById("bulkKitListItems").value.trim();
  const required = document.getElementById("newKitListRequired").value === "true";

  if(!kitListId){
    alert("Select a kit list first.");
    return;
  }

  if(!bulkText){
    alert("Paste at least one item.");
    return;
  }

  const items = bulkText
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(item => item.length > 0);

  if(items.length === 0){
    alert("No valid items found.");
    return;
  }

  const existingItems = allATKitListItems
    .filter(x => String(x.kit_list_id) === String(kitListId));

  const startOrder = existingItems.length + 1;

  const rows = items.map((item, index) => ({
    kit_list_id: kitListId,
    kit_type: item,
    required,
    display_order: startOrder + index
  }));

  const { error } = await supabaseClient
    .from("at_kit_list_items")
    .insert(rows);

  if(error){
    console.log(error);
    alert("Could not bulk add items.");
    return;
  }

  alert(`${items.length} kit items added.`);

  document.getElementById("bulkKitListItems").value = "";

  await loadATKitLists();
  loadSelectedKitListItems();
}

function loadSelectedKitListItems(){
  const kitListId = document.getElementById("kitListSelect").value;
  const table = document.getElementById("kitListItemsTable");

  if(!table){
    return;
  }

  table.innerHTML = "";

  if(!kitListId){
    table.innerHTML = `<tr><td colspan="3" class="no-data">Select a kit list</td></tr>`;
    return;
  }

  const items = allATKitListItems
    .filter(x => String(x.kit_list_id) === String(kitListId))
    .sort((a,b) => Number(a.display_order || 0) - Number(b.display_order || 0));

  if(items.length === 0){
    table.innerHTML = `<tr><td colspan="3" class="no-data">No items in this kit list</td></tr>`;
    return;
  }

  items.forEach(item => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(item.kit_type || "")}</td>
        <td>${item.required ? "Required" : "Optional"}</td>
        <td>
          <button class="small-btn reject-btn" onclick="deleteKitListItem(${item.id})">Delete</button>
        </td>
      </tr>
    `;
  });
}

async function deleteKitListItem(id){
  if(loggedInMode !== "staff"){
    alert("Only staff can edit kit lists.");
    return;
  }

  const { error } = await supabaseClient
    .from("at_kit_list_items")
    .delete()
    .eq("id", id);

  if(error){
    console.log(error);
    alert("Could not delete item.");
    return;
  }

  await loadATKitLists();
  loadSelectedKitListItems();
}

/* AT REQUESTS */

function loadATRequestChecklist(){
  const activityDropdown = document.getElementById("atRequestActivity");
  const box = document.getElementById("atChecklistBox");

  if(!activityDropdown || !box) return;

  const kitListId = activityDropdown.value;

  if(!kitListId){
    box.innerHTML = "Select an activity to see the kit list.";
    return;
  }

  const items = allATKitListItems
    .filter(x => String(x.kit_list_id) === String(kitListId))
    .sort((a,b) => Number(a.display_order || 0) - Number(b.display_order || 0));

  if(items.length === 0){
    box.innerHTML = "No kit list has been added for this activity yet.";
    return;
  }

  let html = `<strong>Tick the items you need to borrow:</strong><br><br>`;

  items.forEach(item => {
    html += `
      <label class="checkbox-row">
        <input type="checkbox" class="at-kit-checkbox" value="${escapeHtml(item.kit_type || "")}">
        ${escapeHtml(item.kit_type || "")}
        ${item.required ? "<span class='required-tag'>Required</span>" : "<span class='optional-tag'>Optional</span>"}
      </label>
    `;
  });

  box.innerHTML = html;
}

async function submitATRequest(){
  const cadetName = document.getElementById("atRequestCadetName").value.trim();
  const kitListId = document.getElementById("atRequestActivity").value;
  const eventDate = document.getElementById("atRequestEventDate").value;
  const reason = document.getElementById("atRequestReason").value.trim();

  if(!cadetName || !kitListId){
    alert("Please complete your name and select an activity.");
    return;
  }

  const selectedList = allATKitLists.find(x => String(x.id) === String(kitListId));

  if(!selectedList){
    alert("Activity not found.");
    return;
  }

  const selectedItems = Array
    .from(document.querySelectorAll(".at-kit-checkbox:checked"))
    .map(box => box.value);

  if(selectedItems.length === 0){
    alert("Please tick at least one item.");
    return;
  }

  const { error } = await supabaseClient
    .from("at_kit_requests")
    .insert([{
      cadet_name: cadetName,
      activity_name: selectedList.activity_name,
      kit_type: selectedItems.join(", "),
      requested_items: selectedItems,
      event_date: eventDate || null,
      reason,
      status: "Pending"
    }]);

  if(error){
    console.log(error);
    alert("AT kit request failed.");
    return;
  }

  alert("AT kit request submitted successfully.");

  document.getElementById("atRequestCadetName").value = "";
  document.getElementById("atRequestActivity").value = "";
  document.getElementById("atRequestEventDate").value = "";
  document.getElementById("atRequestReason").value = "";
  document.getElementById("atChecklistBox").innerHTML = "Select an activity to see the kit list.";

  await loadATRequests();
}

async function bulkAddItemsToKitList(){
  if(loggedInMode !== "staff"){
    alert("Only staff can edit kit lists.");
    return;
  }

  const kitListId = document.getElementById("kitListSelect").value;
  const bulkText = document.getElementById("bulkKitListItems").value.trim();
  const required = document.getElementById("newKitListRequired").value === "true";

  if(!kitListId){
    alert("Select a kit list first.");
    return;
  }

  if(!bulkText){
    alert("Paste at least one item.");
    return;
  }

  const items = bulkText
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(item => item.length > 0);

  if(items.length === 0){
    alert("No valid items found.");
    return;
  }

  const existingItems = allATKitListItems
    .filter(x => String(x.kit_list_id) === String(kitListId));

  const startOrder = existingItems.length + 1;

  const rows = items.map((item, index) => ({
    kit_list_id: kitListId,
    kit_type: item,
    required,
    display_order: startOrder + index
  }));

  const { error } = await supabaseClient
    .from("at_kit_list_items")
    .insert(rows);

  if(error){
    console.log(error);
    alert("Could not bulk add items.");
    return;
  }

  alert(`${items.length} kit items added.`);

  document.getElementById("bulkKitListItems").value = "";

  await loadATKitLists();
  loadSelectedKitListItems();
}

function loadSelectedKitListItems(){
  const kitListId = document.getElementById("kitListSelect").value;
  const table = document.getElementById("kitListItemsTable");

  if(!table){
    return;
  }

  table.innerHTML = "";

  if(!kitListId){
    table.innerHTML = `<tr><td colspan="3" class="no-data">Select a kit list</td></tr>`;
    return;
  }

  const items = allATKitListItems
    .filter(x => String(x.kit_list_id) === String(kitListId))
    .sort((a,b) => Number(a.display_order || 0) - Number(b.display_order || 0));

  if(items.length === 0){
    table.innerHTML = `<tr><td colspan="3" class="no-data">No items in this kit list</td></tr>`;
    return;
  }

  items.forEach(item => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(item.kit_type || "")}</td>
        <td>${item.required ? "Required" : "Optional"}</td>
        <td>
          <button class="small-btn reject-btn" onclick="deleteKitListItem(${item.id})">Delete</button>
        </td>
      </tr>
    `;
  });
}

async function deleteKitListItem(id){
  if(loggedInMode !== "staff"){
    alert("Only staff can edit kit lists.");
    return;
  }

  const { error } = await supabaseClient
    .from("at_kit_list_items")
    .delete()
    .eq("id", id);

  if(error){
    console.log(error);
    alert("Could not delete item.");
    return;
  }

  await loadATKitLists();
  loadSelectedKitListItems();
}

/* AT REQUESTS */

function loadATRequestChecklist(){
  const activityDropdown = document.getElementById("atRequestActivity");
  const box = document.getElementById("atChecklistBox");

  if(!activityDropdown || !box) return;

  const kitListId = activityDropdown.value;

  if(!kitListId){
    box.innerHTML = "Select an activity to see the kit list.";
    return;
  }

  const items = allATKitListItems
    .filter(x => String(x.kit_list_id) === String(kitListId))
    .sort((a,b) => Number(a.display_order || 0) - Number(b.display_order || 0));

  if(items.length === 0){
    box.innerHTML = "No kit list has been added for this activity yet.";
    return;
  }

  let html = `<strong>Tick the items you need to borrow:</strong><br><br>`;

  items.forEach(item => {
    html += `
      <label class="checkbox-row">
        <input type="checkbox" class="at-kit-checkbox" value="${escapeHtml(item.kit_type || "")}">
        ${escapeHtml(item.kit_type || "")}
        ${item.required ? "<span class='required-tag'>Required</span>" : "<span class='optional-tag'>Optional</span>"}
      </label>
    `;
  });

  box.innerHTML = html;
}

async function submitATRequest(){
  const cadetName = document.getElementById("atRequestCadetName").value.trim();
  const kitListId = document.getElementById("atRequestActivity").value;
  const eventDate = document.getElementById("atRequestEventDate").value;
  const reason = document.getElementById("atRequestReason").value.trim();

  if(!cadetName || !kitListId){
    alert("Please complete your name and select an activity.");
    return;
  }

  const selectedList = allATKitLists.find(x => String(x.id) === String(kitListId));

  if(!selectedList){
    alert("Activity not found.");
    return;
  }

  const selectedItems = Array
    .from(document.querySelectorAll(".at-kit-checkbox:checked"))
    .map(box => box.value);

  if(selectedItems.length === 0){
    alert("Please tick at least one item.");
    return;
  }

  const { error } = await supabaseClient
    .from("at_kit_requests")
    .insert([{
      cadet_name: cadetName,
      activity_name: selectedList.activity_name,
      kit_type: selectedItems.join(", "),
      requested_items: selectedItems,
      event_date: eventDate || null,
      reason,
      status: "Pending"
    }]);

  if(error){
    console.log(error);
    alert("AT kit request failed.");
    return;
  }

  alert("AT kit request submitted successfully.");

  document.getElementById("atRequestCadetName").value = "";
  document.getElementById("atRequestActivity").value = "";
  document.getElementById("atRequestEventDate").value = "";
  document.getElementById("atRequestReason").value = "";
  document.getElementById("atChecklistBox").innerHTML = "Select an activity to see the kit list.";

  await loadATRequests();
}

/* EVENT KIT CHECK */

function populateKitCheckDropdown(){
  const dropdown = document.getElementById("eventKitList");

  if(!dropdown){
    return;
  }

  dropdown.innerHTML = `<option value="">Select Kit List</option>`;

  allATKitLists.forEach(list => {
    dropdown.innerHTML += `
      <option value="${list.id}">
        ${escapeHtml(list.activity_name || list.name || list.event_name || list.kit_list_name || "Unnamed Kit List")}
      </option>
    `;
  });
}

async function loadKitCheckEvents(){
  const dropdown = document.getElementById("existingKitCheckEvent");

  if(!dropdown){
    return;
  }

  const { data, error } = await supabaseClient
    .from("at_kit_check_events")
    .select("*")
    .order("event_date", { ascending:false });

  if(error){
    console.log(error);
    alert("Could not load kit check events.");
    return;
  }

  dropdown.innerHTML = `<option value="">Select Existing Event</option>`;

  (data || []).forEach(event => {
    dropdown.innerHTML += `
      <option value="${event.id}">
        ${escapeHtml(event.event_name || "Unnamed Event")}
        ${event.event_date ? " - " + event.event_date : ""}
      </option>
    `;
  });
}

async function createKitCheckEvent(){
  const eventName = document.getElementById("eventName").value.trim();
  const kitListId = document.getElementById("eventKitList").value;
  const eventDate = document.getElementById("eventDate").value;

  if(!eventName || !kitListId){
    alert("Complete event name and kit list.");
    return;
  }

  const { data, error } = await supabaseClient
    .from("at_kit_check_events")
    .insert([{
      event_name: eventName,
      kit_list_id: kitListId,
      event_date: eventDate || null
    }])
    .select();

  if(error){
    console.log(error);
    alert("Could not create event.");
    return;
  }

  currentKitCheckEvent = data[0];

  await loadKitCheckEvents();

  const existingDropdown = document.getElementById("existingKitCheckEvent");
  if(existingDropdown){
    existingDropdown.value = currentKitCheckEvent.id;
  }

  alert("Event created. Now add cadets.");

  await loadKitCheckTable();
}

async function openSelectedKitCheckEvent(){
  const dropdown = document.getElementById("existingKitCheckEvent");

  if(!dropdown || !dropdown.value){
    currentKitCheckEvent = null;
    document.getElementById("kitCheckTable").innerHTML = "";
    return;
  }

  const { data, error } = await supabaseClient
    .from("at_kit_check_events")
    .select("*")
    .eq("id", dropdown.value)
    .single();

  if(error){
    console.log(error);
    alert("Could not open this event.");
    return;
  }

  currentKitCheckEvent = data;

  const eventName = document.getElementById("eventName");
  const eventDate = document.getElementById("eventDate");
  const eventKitList = document.getElementById("eventKitList");

  if(eventName) eventName.value = data.event_name || "";
  if(eventDate) eventDate.value = data.event_date || "";
  if(eventKitList) eventKitList.value = data.kit_list_id || "";

  await loadKitCheckTable();
}

async function addCadetsToEvent(){
  if(!currentKitCheckEvent){
    alert("Create or open an event first.");
    return;
  }

  const text = document.getElementById("cadetBulkList").value;

  const cadets = text
    .split(/\r?\n/)
    .map(name => name.trim())
    .filter(name => name.length > 0);

  if(cadets.length === 0){
    alert("Enter at least one cadet.");
    return;
  }

  const kitItems = allATKitListItems.filter(
    item => String(item.kit_list_id) === String(currentKitCheckEvent.kit_list_id)
  );

  if(kitItems.length === 0){
    alert("This kit list has no items.");
    return;
  }

  const rows = [];

  cadets.forEach(cadet => {
    kitItems.forEach(item => {
      rows.push({
        event_id: currentKitCheckEvent.id,
        cadet_name: cadet,
        kit_item: item.kit_type,
        brought: false
      });
    });
  });

  const { error } = await supabaseClient
    .from("at_kit_check_results")
    .insert(rows);

  if(error){
    console.log(error);
    alert("Could not create checklist.");
    return;
  }

  alert("Cadets added. All boxes have started unticked.");

  document.getElementById("cadetBulkList").value = "";

  await loadKitCheckTable();
}

async function loadKitCheckTable(){
  const tableBox = document.getElementById("kitCheckTable");

  if(!tableBox){
    return;
  }

  if(!currentKitCheckEvent){
    tableBox.innerHTML = "";
    return;
  }

  const { data, error } = await supabaseClient
    .from("at_kit_check_results")
    .select("*")
    .eq("event_id", currentKitCheckEvent.id)
    .order("cadet_name");

  if(error){
    console.log(error);
    alert("Could not load checklist.");
    return;
  }

  const results = data || [];

  if(results.length === 0){
    tableBox.innerHTML = `
      <div class="no-data">No cadets added to this event yet.</div>
    `;
    return;
  }

  const cadets = [...new Set(results.map(r => r.cadet_name))];
  const items = [...new Set(results.map(r => r.kit_item))];

  let html = `
    <table>
      <thead>
        <tr>
          <th>Cadet</th>
          ${items.map(item => `<th>${escapeHtml(item)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
  `;

  cadets.forEach(cadet => {
    html += `<tr><td><strong>${escapeHtml(cadet)}</strong></td>`;

    items.forEach(item => {
      const record = results.find(r => r.cadet_name === cadet && r.kit_item === item);

      html += `
        <td>
          <input 
            type="checkbox" 
            ${record?.brought ? "checked" : ""} 
            onchange="updateKitCheckResult(${record.id}, this.checked)">
        </td>
      `;
    });

    html += `</tr>`;
  });

  html += `
      </tbody>
    </table>
  `;

  tableBox.innerHTML = html;
}

async function updateKitCheckResult(id, brought){
  const { error } = await supabaseClient
    .from("at_kit_check_results")
    .update({
      brought,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if(error){
    console.log(error);
    alert("Could not save tick box.");
  }
}

async function deleteCurrentKitCheckEvent(){
  if(!currentKitCheckEvent){
    alert("Open or create an event first.");
    return;
  }

  const confirmDelete = confirm(
    "Are you sure you want to delete this event kit check? This will permanently delete the checklist for this event."
  );

  if(!confirmDelete){
    return;
  }

  const { error:resultsError } = await supabaseClient
    .from("at_kit_check_results")
    .delete()
    .eq("event_id", currentKitCheckEvent.id);

  if(resultsError){
    console.log(resultsError);
    alert("Could not delete checklist results.");
    return;
  }

  const { error:eventError } = await supabaseClient
    .from("at_kit_check_events")
    .delete()
    .eq("id", currentKitCheckEvent.id);

  if(eventError){
    console.log(eventError);
    alert("Could not delete event.");
    return;
  }

  alert("Event kit check deleted.");

  currentKitCheckEvent = null;

  const tableBox = document.getElementById("kitCheckTable");
  const cadetBulkList = document.getElementById("cadetBulkList");
  const eventName = document.getElementById("eventName");
  const eventDate = document.getElementById("eventDate");
  const eventKitList = document.getElementById("eventKitList");
  const existingDropdown = document.getElementById("existingKitCheckEvent");

  if(tableBox) tableBox.innerHTML = "";
  if(cadetBulkList) cadetBulkList.value = "";
  if(eventName) eventName.value = "";
  if(eventDate) eventDate.value = "";
  if(eventKitList) eventKitList.value = "";
  if(existingDropdown) existingDropdown.value = "";

  await loadKitCheckEvents();
}
