const SUPABASE_URL = "https://oskorapwgvoecvtdtkwi.supabase.co";
const SUPABASE_KEY = "sb_publishable_Zm5qgcsjzsuzicBwa6Z0sA_qgn-Gm5R";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const PASSWORD = "1384-Uniform";

let allStock = [];
let allIssueHistory = [];

/* LOGIN */

function checkPassword(){

  const entered = document.getElementById("passwordInput").value;

  if(entered === PASSWORD){

    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("mainContent").style.display = "block";

    loadStock();
    loadIssueHistory();

  } else {

    alert("Incorrect password");

  }
}

/* PAGE SWITCHING */

function changePage(){

  const selectedPage = document.getElementById("pageSelect").value;

  const pages = document.querySelectorAll(".page");

  pages.forEach(page => {
    page.classList.remove("active-page");
  });

  document.getElementById(selectedPage).classList.add("active-page");

  if(selectedPage === "stockPage"){
    loadStock();
  }

  if(selectedPage === "historyPage"){
    loadIssueHistory();
  }
}

/* STOCK */

async function loadStock(){

  const { data, error } = await supabaseClient
    .from("uniform_stock")
    .select("*")
    .order("item", { ascending:true });

  if(error){
    console.log(error);
    alert("Error loading stock. Check Supabase permissions.");
    return;
  }

  allStock = data || [];

  displayStock(allStock);
  populateItemDropdown();
  updateBoxInfo();
}

function displayStock(stock){

  const table = document.getElementById("stockTable");

  table.innerHTML = "";

  if(!stock || stock.length === 0){
    table.innerHTML = `
      <tr>
        <td colspan="4" class="no-data">No stock found</td>
      </tr>
    `;
    return;
  }

  stock.forEach(item => {

    let qtyClass = "";

    if(Number(item.quantity) <= Number(item.warning_level || 1)){
      qtyClass = "low-stock";
    }

    table.innerHTML += `
      <tr>
        <td>${escapeHtml(item.item)}</td>
        <td>${escapeHtml(item.size || "")}</td>
        <td>${escapeHtml(item.box_number || "")}</td>
        <td class="${qtyClass}">${item.quantity}</td>
      </tr>
    `;
  });
}

function searchStock(){

  const search = document.getElementById("searchInput").value.toLowerCase();

  const filtered = allStock.filter(item => {

    return (
      item.item?.toLowerCase().includes(search) ||
      item.size?.toLowerCase().includes(search) ||
      item.box_number?.toString().toLowerCase().includes(search)
    );
  });

  displayStock(filtered);
}

/* ISSUE UNIFORM */

function populateItemDropdown(){

  const itemDropdown = document.getElementById("issueItem");

  const currentlySelected = itemDropdown.value;

  itemDropdown.innerHTML = `<option value="">Select Item Type</option>`;

  const uniqueItems = [...new Set(allStock.map(stock => stock.item))]
    .filter(Boolean)
    .sort();

  uniqueItems.forEach(item => {
    itemDropdown.innerHTML += `
      <option value="${escapeHtml(item)}">${escapeHtml(item)}</option>
    `;
  });

  if(uniqueItems.includes(currentlySelected)){
    itemDropdown.value = currentlySelected;
  }
}

function updateSizeDropdown(){

  const selectedItem = document.getElementById("issueItem").value;
  const sizeDropdown = document.getElementById("issueSize");

  sizeDropdown.innerHTML = `<option value="">Select Size</option>`;

  if(!selectedItem){
    updateBoxInfo();
    return;
  }

  const sizes = allStock
    .filter(stock => stock.item === selectedItem)
    .map(stock => stock.size)
    .filter(Boolean);

  const uniqueSizes = [...new Set(sizes)].sort();

  uniqueSizes.forEach(size => {
    sizeDropdown.innerHTML += `
      <option value="${escapeHtml(size)}">${escapeHtml(size)}</option>
    `;
  });

  updateBoxInfo();
}

function updateBoxInfo(){

  const selectedItem = document.getElementById("issueItem")?.value || "";
  const selectedSize = document.getElementById("issueSize")?.value || "";
  const infoBox = document.getElementById("selectedStockInfo");

  if(!infoBox){
    return;
  }

  if(!selectedItem || !selectedSize){
    infoBox.innerHTML = "Select an item and size to see available stock.";
    return;
  }

  const matches = allStock.filter(stock =>
    stock.item === selectedItem &&
    stock.size === selectedSize
  );

  if(matches.length === 0){
    infoBox.innerHTML = "No matching stock found.";
    return;
  }

  const totalQty = matches.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const boxes = matches
    .map(item => `${escapeHtml(item.box_number || "No box")} - Qty ${item.quantity}`)
    .join("<br>");

  infoBox.innerHTML = `
    <strong>Available stock:</strong> ${totalQty}<br>
    <strong>Box location:</strong><br>
    ${boxes}
  `;
}

async function issueUniform(){

  const cadet = document.getElementById("cadetName").value.trim();
  const item = document.getElementById("issueItem").value;
  const size = document.getElementById("issueSize").value;
  const qty = parseInt(document.getElementById("issueQty").value);

  if(!cadet || !item || !size || !qty || qty < 1){
    alert("Please complete cadet name, item, size and quantity.");
    return;
  }

  const matchingStock = allStock
    .filter(stock =>
      stock.item === item &&
      stock.size === size &&
      Number(stock.quantity) > 0
    )
    .sort((a, b) => Number(b.quantity) - Number(a.quantity));

  if(matchingStock.length === 0){
    alert("No stock available for this item and size.");
    return;
  }

  let remainingToIssue = qty;
  let issueRecords = [];

  for(const stockLine of matchingStock){

    if(remainingToIssue <= 0){
      break;
    }

    const available = Number(stockLine.quantity);
    const amountFromThisBox = Math.min(available, remainingToIssue);
    const newQty = available - amountFromThisBox;

    const { error: updateError } = await supabaseClient
      .from("uniform_stock")
      .update({
        quantity: newQty,
        updated_at: new Date().toISOString()
      })
      .eq("id", stockLine.id);

    if(updateError){
      console.log(updateError);
      alert("Error updating stock. Check update permissions in Supabase.");
      return;
    }

    issueRecords.push({
      cadet_name: cadet,
      item: stockLine.item,
      size: stockLine.size,
      box_number: stockLine.box_number,
      quantity: amountFromThisBox,
      returned: false
    });

    remainingToIssue -= amountFromThisBox;
  }

  if(remainingToIssue > 0){
    alert("Not enough stock available.");
    await loadStock();
    return;
  }

  const { error: insertError } = await supabaseClient
    .from("uniform_issues")
    .insert(issueRecords);

  if(insertError){
    console.log(insertError);
    alert("Stock reduced, but issue history did not save. Check insert permissions.");
    return;
  }

  alert("Uniform issued successfully.");

  document.getElementById("cadetName").value = "";
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
    alert("Error loading issue history.");
    return;
  }

  allIssueHistory = data || [];
  displayIssueHistory(allIssueHistory);
}

function displayIssueHistory(history){

  const table = document.getElementById("issueHistoryTable");

  table.innerHTML = "";

  if(!history || history.length === 0){
    table.innerHTML = `
      <tr>
        <td colspan="7" class="no-data">No issue history found</td>
      </tr>
    `;
    return;
  }

  history.forEach(record => {

    table.innerHTML += `
      <tr>
        <td>${escapeHtml(record.cadet_name || "")}</td>
        <td>${escapeHtml(record.item || "")}</td>
        <td>${escapeHtml(record.size || "")}</td>
        <td>${escapeHtml(record.box_number || "")}</td>
        <td>${record.quantity || ""}</td>
        <td>${record.issue_date || ""}</td>
        <td>${record.returned ? "Yes" : "No"}</td>
      </tr>
    `;
  });
}

function searchIssueHistory(){

  const search = document.getElementById("historySearchInput").value.toLowerCase();

  const filtered = allIssueHistory.filter(record => {

    return (
      record.cadet_name?.toLowerCase().includes(search) ||
      record.item?.toLowerCase().includes(search) ||
      record.size?.toLowerCase().includes(search) ||
      record.box_number?.toString().toLowerCase().includes(search)
    );
  });

  displayIssueHistory(filtered);
}

/* SECURITY HELPER */

function escapeHtml(value){
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}