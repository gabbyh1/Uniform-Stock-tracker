const SUPABASE_URL = "https://oskorapwgvoecvtdtkwi.supabase.co";
const SUPABASE_KEY = "sb_publishable_Zm5qgcsjzsuzicBwa6Z0sA_qgn-Gm5R";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const STAFF_PASSWORD = "1384-Staff";

let loggedInMode = null;
let allStock = [];
let allIssueHistory = [];
let allRequests = [];
let allTempPasswords = [];

function hideAllScreens(){
  document.getElementById("homeScreen").style.display = "none";
  document.getElementById("staffLoginScreen").style.display = "none";
  document.getElementById("mainContent").style.display = "none";
  document.getElementById("cadetRequestPage").style.display = "none";
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

async function openCadetRequest(){
  hideAllScreens();
  document.getElementById("cadetRequestPage").style.display = "block";
  await loadStock();
}

function logout(){
  backHome();
}

async function staffLogin(){

  const passwordBox = document.getElementById("staffPasswordInput");

  if(!passwordBox){
    alert("Password box not found. Check index.html.");
    return;
  }

  const enteredPassword = passwordBox.value.trim();

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

  await loadStock();
  await loadIssueHistory();
  await loadRequests();
  await loadTemporaryPasswords();

  changePage();
}

function changePage(){
  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active-page");
  });

  const selected = document.getElementById("pageSelect").value;
  document.getElementById(selected).classList.add("active-page");
}

/* STOCK */

async function loadStock(){
  const { data, error } = await supabaseClient
    .from("uniform_stock")
    .select("*")
    .order("item", { ascending:true });

  if(error){
    console.log(error);
    alert("Error loading stock");
    return;
  }

  allStock = data || [];

  displayStock(allStock);
  populateItemDropdowns();
}

function displayStock(stock){
  const table = document.getElementById("stockTable");
  if(!table) return;

  table.innerHTML = "";

  if(!stock || stock.length === 0){
    table.innerHTML = `<tr><td colspan="4" class="no-data">No stock found</td></tr>`;
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

function searchStock(){
  const search = document.getElementById("searchInput").value.toLowerCase();

  const filtered = allStock.filter(item =>
    item.item?.toLowerCase().includes(search) ||
    item.size?.toLowerCase().includes(search) ||
    item.box_number?.toString().toLowerCase().includes(search)
  );

  displayStock(filtered);
}

/* DROPDOWNS */

function populateItemDropdowns(){
  const uniqueItems = [...new Set(allStock.map(x => x.item))]
    .filter(Boolean)
    .sort();

  const dropdownIds = ["issueItem", "requestItem"];

  dropdownIds.forEach(id => {
    const dropdown = document.getElementById(id);
    if(!dropdown) return;

    dropdown.innerHTML = `<option value="">Select Item</option>`;

    uniqueItems.forEach(item => {
      dropdown.innerHTML += `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`;
    });
  });
}

function updateIssueSizeDropdown(){
  const item = document.getElementById("issueItem").value;
  const sizeDropdown = document.getElementById("issueSize");

  sizeDropdown.innerHTML = `<option value="">Select Size</option>`;

  const sizes = [...new Set(allStock.filter(x => x.item === item).map(x => x.size))]
    .filter(Boolean)
    .sort();

  sizes.forEach(size => {
    sizeDropdown.innerHTML += `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`;
  });

  updateBoxInfo();
}

function updateRequestSizeDropdown(){
  const item = document.getElementById("requestItem").value;
  const sizeDropdown = document.getElementById("requestSize");

  sizeDropdown.innerHTML = `<option value="">Select Size</option>`;

  const sizes = [...new Set(allStock.filter(x => x.item === item).map(x => x.size))]
    .filter(Boolean)
    .sort();

  sizes.forEach(size => {
    sizeDropdown.innerHTML += `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`;
  });
}

function updateBoxInfo(){
  const item = document.getElementById("issueItem").value;
  const size = document.getElementById("issueSize").value;
  const box = document.getElementById("selectedStockInfo");

  if(!item || !size){
    box.innerHTML = "Select an item and size.";
    return;
  }

  const matches = allStock.filter(x => x.item === item && x.size === size);
  const total = matches.reduce((sum, x) => sum + Number(x.quantity || 0), 0);

  box.innerHTML = `
    <strong>Available:</strong> ${total}<br>
    <strong>Boxes:</strong><br>
    ${matches.map(x => `${escapeHtml(x.box_number || "No box")} - Qty ${x.quantity}`).join("<br>")}
  `;
}

/* ISSUE UNIFORM */

async function issueUniform(){
  if(!loggedInMode){
    alert("You do not have permission.");
    return;
  }

  const cadetName = document.getElementById("issueCadetName").value.trim();
  const item = document.getElementById("issueItem").value;
  const size = document.getElementById("issueSize").value;
  const qty = parseInt(document.getElementById("issueQty").value);

  if(!cadetName || !item || !size || !qty || qty < 1){
    alert("Complete all fields.");
    return;
  }

  const matchingStock = allStock
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
      alert("Error updating stock.");
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
    alert("Not enough stock available.");
    await loadStock();
    return;
  }

  const { error:insertError } = await supabaseClient
    .from("uniform_issues")
    .insert(issueRecords);

  if(insertError){
    alert("Stock updated but issue history failed.");
    return;
  }

  alert("Uniform issued successfully.");

  document.getElementById("issueCadetName").value = "";
  document.getElementById("issueItem").value = "";
  document.getElementById("issueSize").innerHTML = `<option value="">Select Size</option>`;
  document.getElementById("issueQty").value = 1;

  await loadStock();
  await loadIssueHistory();
}

/* ISSUE HISTORY */

async function loadIssueHistory(){
  const { data, error } = await supabaseClient
    .from("uniform_issues")
    .select("*")
    .order("issue_date", { ascending:false });

  if(error){
    console.log(error);
    return;
  }

  allIssueHistory = data || [];
  displayIssueHistory(allIssueHistory);
}

function displayIssueHistory(history){
  const table = document.getElementById("issueHistoryTable");
  if(!table) return;

  table.innerHTML = "";

  if(history.length === 0){
    table.innerHTML = `<tr><td colspan="7" class="no-data">No issue history found</td></tr>`;
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
        <td>${r.issue_date || ""}</td>
        <td>${r.returned ? "Yes" : "No"}</td>
      </tr>
    `;
  });
}

function searchIssueHistory(){
  const search = document.getElementById("historySearchInput").value.toLowerCase();

  const filtered = allIssueHistory.filter(r =>
    r.cadet_name?.toLowerCase().includes(search) ||
    r.item?.toLowerCase().includes(search) ||
    r.size?.toLowerCase().includes(search) ||
    r.box_number?.toString().toLowerCase().includes(search)
  );

  displayIssueHistory(filtered);
}

/* REQUESTS */

async function submitUniformRequest(){
  const cadetName = document.getElementById("requestCadetName").value.trim();
  const item = document.getElementById("requestItem").value;
  const size = document.getElementById("requestSize").value;
  const reason = document.getElementById("requestReason").value.trim();

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
    alert("Request failed.");
    return;
  }

  alert("Request submitted successfully.");

  document.getElementById("requestCadetName").value = "";
  document.getElementById("requestItem").value = "";
  document.getElementById("requestSize").innerHTML = `<option value="">Select Size</option>`;
  document.getElementById("requestReason").value = "";
}

async function loadRequests(){
  const { data, error } = await supabaseClient
    .from("uniform_requests")
    .select("*")
    .order("requested_at", { ascending:false });

  if(error){
    console.log(error);
    return;
  }

  allRequests = data || [];
  displayRequests();
}

function displayRequests(){
  const table = document.getElementById("requestsTable");
  if(!table) return;

  table.innerHTML = "";

  if(allRequests.length === 0){
    table.innerHTML = `<tr><td colspan="7" class="no-data">No requests found</td></tr>`;
    return;
  }

  allRequests.forEach(r => {
    table.innerHTML += `
      <tr>
        <td>${escapeHtml(r.cadet_name)}</td>
        <td>${escapeHtml(r.item)}</td>
        <td>${escapeHtml(r.size || "")}</td>
        <td>${escapeHtml(r.reason || "")}</td>
        <td>${escapeHtml(r.status)}</td>
        <td>${formatDate(r.requested_at)}</td>
        <td>
          <button class="small-btn approve-btn" onclick="updateRequestStatus(${r.id}, 'Approved')">Approve</button>
          <button class="small-btn reject-btn" onclick="updateRequestStatus(${r.id}, 'Rejected')">Reject</button>
        </td>
      </tr>
    `;
  });
}

async function updateRequestStatus(id, status){
  const { error } = await supabaseClient
    .from("uniform_requests")
    .update({
      status,
      reviewed_by: loggedInMode === "staff" ? "Staff Account" : "Temporary Access",
      reviewed_at:new Date().toISOString()
    })
    .eq("id", id);

  if(error){
    alert("Could not update request.");
    return;
  }

  await loadRequests();
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
