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

let allTempPasswords = [];

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
  populateKitCheckDropdown();
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
console.log("Loaded kit lists:", allATKitLists);
populateKitCheckDropdown();
  
  if(loggedInMode === "staff"){
    await loadTemporaryPasswords();
  }

  changePage();
}
147    changePage();
148 }
149
150 function populateKitCheckDropdown(){

151   const dropdown = document.getElementById("eventKitList");

152   if(!dropdown){
153     return;
154   }

155   dropdown.innerHTML = `<option value="">Select Kit List</option>`;

156   allATKitLists.forEach(list => {
157     dropdown.innerHTML += `
158       <option value="${list.id}">
159         ${escapeHtml(list.activity_name)}
160       </option>
161     `;
162   });
163 }

164 function changePage(){
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
/* UNIFORM */

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
        <td>${escapeHtml(item.item)}</td>
        <td>${escapeHtml(item.size || "")}</td>
        <td>${escapeHtml(item.box_number || "")}</td>
        <td class="${low}">${item.quantity}</td>
      </tr>
    `;
  });
}

function searchUniformStock(){
  const search = document.getElementById("uniformSearchInput").value.toLowerCase();

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
  const item = document.getElementById("uniformIssueItem").value;
  const sizeDropdown = document.getElementById("uniformIssueSize");

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
  const item = document.getElementById("uniformRequestItem").value;
  const sizeDropdown = document.getElementById("uniformRequestSize");

  sizeDropdown.innerHTML = `<option value="">Select Size</option>`;

  const sizes = [...new Set(allUniformStock.filter(x => x.item === item).map(x => x.size))]
    .filter(Boolean)
    .sort();

  sizes.forEach(size => {
    sizeDropdown.innerHTML += `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`;
  });
}

function updateUniformBoxInfo(){
  const item = document.getElementById("uniformIssueItem").value;
  const size = document.getElementById("uniformIssueSize").value;
  const box = document.getElementById("uniformSelectedStockInfo");

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

  if(history.length === 0){
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
  const search = document.getElementById("uniformHistorySearchInput").value.toLowerCase();

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

  if(allUniformRequests.length === 0){
    table.innerHTML = `<tr><td colspan="7" class="no-data">No uniform requests found</td></tr>`;
    return;
  }

  allUniformRequests.forEach(r => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(r.cadet_name)}</td>
        <td>${escapeHtml(r.item)}</td>
        <td>${escapeHtml(r.size || "")}</td>
        <td>${escapeHtml(r.reason || "")}</td>
        <td>${escapeHtml(r.status)}</td>
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
    alert("Could not update uniform request.");
    return;
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
  displayATKit(allATKit);
  populateATDropdowns();
}

function displayATKit(kit){
  const table = document.getElementById("atKitTable");
  if(!table) return;

  table.innerHTML = "";

  if(!kit || kit.length === 0){
    table.innerHTML = `<tr><td colspan="7" class="no-data">No AT kit found</td></tr>`;
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
      </tr>
    `;
  });
}

function searchATKit(){
  const search = document.getElementById("atSearchInput").value.toLowerCase();

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
  const kitType = document.getElementById("atIssueKitType").value;
  const numberDropdown = document.getElementById("atIssueKitNumber");

  numberDropdown.innerHTML = `<option value="">Select Kit Number</option>`;

  const availableKit = allATKit
    .filter(x => x.kit_type === kitType && x.status === "Available")
    .sort((a,b) => a.kit_number.localeCompare(b.kit_number));

  availableKit.forEach(item => {
    numberDropdown.innerHTML += `<option value="${item.id}">${escapeHtml(item.kit_number)}</option>`;
  });

  updateATKitInfo();
}

function updateATKitInfo(){
  const kitId = document.getElementById("atIssueKitNumber").value;
  const box = document.getElementById("atSelectedKitInfo");

  const item = allATKit.find(x => String(x.id) === String(kitId));

  if(!item){
    box.innerHTML = "Select an AT kit type and kit number.";
    return;
  }

  box.innerHTML = `
    <strong>Type:</strong> ${escapeHtml(item.kit_type)}<br>
    <strong>Number:</strong> ${escapeHtml(item.kit_number)}<br>
    <strong>Size:</strong> ${escapeHtml(item.size || "")}<br>
    <strong>Condition:</strong> ${escapeHtml(item.condition || "")}<br>
    <strong>Location:</strong> ${escapeHtml(item.location || "")}
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

function populateATReturnDropdown(){
  const dropdown = document.getElementById("atReturnKitNumber");
  if(!dropdown) return;

  dropdown.innerHTML = `<option value="">Select Issued Kit Number</option>`;

  allATIssueHistory
    .filter(x => !x.returned)
    .sort((a,b) => a.kit_number.localeCompare(b.kit_number))
    .forEach(issue => {
      dropdown.innerHTML += `<option value="${issue.id}">${escapeHtml(issue.kit_number)} - ${escapeHtml(issue.cadet_name)}</option>`;
    });
}

function updateATReturnInfo(){
  const issueId = document.getElementById("atReturnKitNumber").value;
  const box = document.getElementById("atReturnInfo");

  const issue = allATIssueHistory.find(x => String(x.id) === String(issueId));

  if(!issue){
    box.innerHTML = "Select issued kit to return.";
    return;
  }

  box.innerHTML = `
    <strong>Cadet:</strong> ${escapeHtml(issue.cadet_name)}<br>
    <strong>Type:</strong> ${escapeHtml(issue.kit_type)}<br>
    <strong>Number:</strong> ${escapeHtml(issue.kit_number)}<br>
    <strong>Issued:</strong> ${formatDate(issue.issue_date)}
  `;
}

async function returnATKit(){
  if(!loggedInMode){
    alert("You do not have permission.");
    return;
  }

  const issueId = document.getElementById("atReturnKitNumber").value;
  const condition = document.getElementById("atReturnCondition").value.trim();
  const notes = document.getElementById("atReturnNotes").value.trim();

  const issue = allATIssueHistory.find(x => String(x.id) === String(issueId));

  if(!issue){
    alert("Select issued kit to return.");
    return;
  }

  const { error:updateIssueError } = await supabaseClient
    .from("at_kit_issues")
    .update({
      returned:true,
      return_date:new Date().toISOString(),
      return_condition:condition,
      notes
    })
    .eq("id", issue.id);

  if(updateIssueError){
    alert("Could not update issue history.");
    return;
  }

  const { error:updateKitError } = await supabaseClient
    .from("at_kit")
    .update({
      status:"Available",
      condition:condition,
      updated_at:new Date().toISOString()
    })
    .eq("id", issue.kit_id);

  if(updateKitError){
    alert("Return recorded but kit status did not update.");
    return;
  }

  alert("AT kit returned.");

  document.getElementById("atReturnKitNumber").value = "";
  document.getElementById("atReturnCondition").value = "Good";
  document.getElementById("atReturnNotes").value = "";

  await loadATKit();
  await loadATIssueHistory();
}

async function loadATIssueHistory(){
  const { data, error } = await supabaseClient
    .from("at_kit_issues")
    .select("*")
    .order("issue_date", { ascending:false });

  if(error){
    console.log(error);
    return;
  }

  allATIssueHistory = data || [];
  displayATIssueHistory(allATIssueHistory);
  populateATReturnDropdown();
}

function displayATIssueHistory(history){
  const table = document.getElementById("atIssueHistoryTable");
  if(!table) return;

  table.innerHTML = "";

  if(history.length === 0){
    table.innerHTML = `<tr><td colspan="7" class="no-data">No AT issue history found</td></tr>`;
    return;
  }

  history.forEach(r => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(r.cadet_name || "")}</td>
        <td>${escapeHtml(r.kit_type || "")}</td>
        <td>${escapeHtml(r.kit_number || "")}</td>
        <td>${formatDate(r.issue_date)}</td>
        <td>${r.returned ? "Yes" : "No"}</td>
        <td>${formatDate(r.return_date)}</td>
        <td>${escapeHtml(r.return_condition || "")}</td>
      </tr>
    `;
  });
}

function searchATIssueHistory(){
  const search = document.getElementById("atHistorySearchInput").value.toLowerCase();

  const filtered = allATIssueHistory.filter(r =>
    r.cadet_name?.toLowerCase().includes(search) ||
    r.kit_type?.toLowerCase().includes(search) ||
    r.kit_number?.toLowerCase().includes(search)
  );

  displayATIssueHistory(filtered);
}  await loadUniformRequests();
}}
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

}

function populateATKitListDropdowns(){
  const staffDropdown = document.getElementById("kitListSelect");
  const cadetDropdown = document.getElementById("atRequestActivity");

  if(staffDropdown){
    staffDropdown.innerHTML = `<option value="">Select Kit List</option>`;

    allATKitLists.forEach(list => {
      staffDropdown.innerHTML += `<option value="${list.id}">${escapeHtml(list.activity_name)}</option>`;
    });
  }

  if(cadetDropdown){
    cadetDropdown.innerHTML = `<option value="">Select Activity</option>`;

    allATKitLists.forEach(list => {
      cadetDropdown.innerHTML += `<option value="${list.id}">${escapeHtml(list.activity_name)}</option>`;
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
    required: required,
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
        <td>${escapeHtml(item.kit_type)}</td>
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
  const kitListId = document.getElementById("atRequestActivity").value;
  const box = document.getElementById("atChecklistBox");

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
        <input type="checkbox" class="at-kit-checkbox" value="${escapeHtml(item.kit_type)}">
        ${escapeHtml(item.kit_type)}
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
}

async function loadATRequests(){
  const { data, error } = await supabaseClient
    .from("at_kit_requests")
    .select("*")
    .order("requested_at", { ascending:false });

  if(error){
    console.log(error);
    return;
  }

  allATRequests = data || [];
  displayATRequests();
}

function displayATRequests(){
  const table = document.getElementById("atRequestsTable");
  if(!table) return;

  table.innerHTML = "";

  if(allATRequests.length === 0){
    table.innerHTML = `<tr><td colspan="6" class="no-data">No AT requests found</td></tr>`;
    return;
  }

  allATRequests.forEach(r => {
    let itemsText = "";

    if(Array.isArray(r.requested_items)){
      itemsText = r.requested_items.map(item => escapeHtml(item)).join("<br>");
    } else {
      itemsText = escapeHtml(r.kit_type || "");
    }

    table.innerHTML += `
      <tr>
        <td>${escapeHtml(r.cadet_name)}</td>
        <td>
          <strong>${escapeHtml(r.activity_name || "AT Kit")}</strong><br>
          ${itemsText}
        </td>
        <td>${escapeHtml(r.reason || "")}</td>
        <td>${escapeHtml(r.status)}</td>
        <td>${formatDate(r.requested_at)}</td>
        <td>
          <button class="small-btn approve-btn" onclick="updateATRequestStatus(${r.id}, 'Approved')">Approve</button>
          <button class="small-btn reject-btn" onclick="updateATRequestStatus(${r.id}, 'Rejected')">Reject</button>
        </td>
      </tr>
    `;
  });
}

async function updateATRequestStatus(id, status){
  const { error } = await supabaseClient
    .from("at_kit_requests")
    .update({
      status,
      reviewed_by: loggedInMode === "staff" ? "Staff Account" : "Temporary Access",
      reviewed_at:new Date().toISOString()
    })
    .eq("id", id);

  if(error){
    alert("Could not update AT request.");
    return;
  }

  await loadATRequests();
}

/* TEMP PASSWORDS */

async function createTempPassword(){
  if(loggedInMode !== "staff"){
    alert("Only the staff account can create temporary passwords.");
    return;
  }

  const password = document.getElementById("tempPassword").value.trim();
  const note = document.getElementById("tempNote").value.trim();
  const expiresAt = document.getElementById("tempExpiry").value;

  if(!password || !expiresAt){
    alert("Enter a password and expiry date/time.");
    return;
  }

  const { error } = await supabaseClient
    .from("temporary_passwords")
    .insert([{
      password,
      note,
      expires_at:expiresAt,
      active:true
    }]);

  if(error){
    alert("Could not create temporary password.");
    return;
  }

  alert("Temporary password created.");

  document.getElementById("tempPassword").value = "";
  document.getElementById("tempNote").value = "";
  document.getElementById("tempExpiry").value = "";

  await loadTemporaryPasswords();
}

async function loadTemporaryPasswords(){
  if(loggedInMode !== "staff"){
    return;
  }

  const { data, error } = await supabaseClient
    .from("temporary_passwords")
    .select("*")
    .order("created_at", { ascending:false });

  if(error){
    console.log(error);
    return;
  }

  allTempPasswords = data || [];
  displayTemporaryPasswords();
}

function displayTemporaryPasswords(){
  const table = document.getElementById("tempPasswordsTable");
  if(!table) return;

  table.innerHTML = "";

  if(allTempPasswords.length === 0){
    table.innerHTML = `<tr><td colspan="5" class="no-data">No temporary passwords found</td></tr>`;
    return;
  }

  allTempPasswords.forEach(p => {
    const expired = new Date(p.expires_at) < new Date();

    table.innerHTML += `
      <tr>
        <td>${escapeHtml(p.password)}</td>
        <td>${escapeHtml(p.note || "")}</td>
        <td>${formatDate(p.expires_at)} ${expired ? "(Expired)" : ""}</td>
        <td>${p.active ? "Yes" : "No"}</td>
        <td>
          <button class="small-btn disable-btn" onclick="disableTempPassword(${p.id})">Disable</button>
        </td>
      </tr>
    `;
  });
}

async function disableTempPassword(id){
  if(loggedInMode !== "staff"){
    alert("Only staff can disable temporary passwords.");
    return;
  }

  const { error } = await supabaseClient
    .from("temporary_passwords")
    .update({ active:false })
    .eq("id", id);

  if(error){
    alert("Could not disable password.");
    return;
  }

  await loadTemporaryPasswords();
}

/* HELPERS */

function formatDate(value){
  if(!value) return "";
  return new Date(value).toLocaleString("en-GB");
}

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

let currentKitCheckEvent = null;

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

  alert("Event created. Now add cadets.");
}

async function addCadetsToEvent(){

  if(!currentKitCheckEvent){
    alert("Create an event first.");
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

  let rows = [];

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

  alert("Checklist created.");

  document.getElementById("cadetBulkList").value = "";

  await loadKitCheckTable();
}

async function loadKitCheckTable(){

  if(!currentKitCheckEvent){
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

  document.getElementById("kitCheckTable").innerHTML = html;
}

async function updateKitCheckResult(id, brought){

  const { error } = await supabaseClient
    .from("at_kit_check_results")
    .update({
      brought: brought,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if(error){
    console.log(error);
    alert("Could not save tick box.");
  }
}

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
