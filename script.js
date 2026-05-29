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
}
