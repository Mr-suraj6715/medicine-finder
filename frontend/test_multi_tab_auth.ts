/**
 * Comprehensive Multi-Tab Authentication & Role-Switching Test Suite
 * Simulates multiple browser tabs with isolated sessionStorage and shared localStorage.
 */
import {
  saveAuthSession,
  getStoredUser,
  getAuthToken,
  clearAuthSession,
  normalizeRole,
  isTokenExpired,
  AuthUser
} from "./src/lib/auth";

class MockStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length() {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] || null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

// Global shared localStorage (shared across all tabs on the domain)
const sharedLocalStorage = new MockStorage();
let mockDocumentCookie = "";

// Helper to create simulated tab environments
function createTabContext(name: string, initialPath = "/") {
  const tabSessionStorage = new MockStorage();

  const activate = () => {
    (global as any).window = {
      location: {
        pathname: initialPath,
        replace: (url: string) => {
          (global as any).window.location.pathname = url;
        }
      }
    };
    (global as any).sessionStorage = tabSessionStorage;
    (global as any).localStorage = sharedLocalStorage;
    (global as any).document = {
      get cookie() {
        return mockDocumentCookie;
      },
      set cookie(val: string) {
        mockDocumentCookie = val;
      }
    };
  };

  const setPath = (path: string) => {
    (global as any).window.location.pathname = path;
  };

  return { name, activate, setPath, tabSessionStorage };
}

// Generate realistic JWT strings with header.payload.signature
function createMockJwt(userId: string, email: string, role: string, expSeconds = 3600): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    sub: email,
    email,
    userId,
    role,
    name: email.split("@")[0],
    exp: now + expSeconds
  })).toString("base64url");
  const signature = Buffer.from("mock_signature_hash").toString("base64url");
  return `${header}.${payload}.${signature}`;
}

async function runTestSuite() {
  console.log("=================================================================");
  console.log("  RUNNING MULTI-TAB AUTHENTICATION & ROLE-SWITCHING TEST SUITE   ");
  console.log("=================================================================\n");

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      testsPassed++;
    } else {
      console.error(`  [FAIL] ${testName} - ${detail || "Assertion failed"}`);
      testsFailed++;
    }
  }

  // Define test accounts
  const customerUser: AuthUser = {
    id: "user_cust_001",
    email: "customer@medifind.test",
    name: "Customer Aarav",
    role: "user"
  };
  const customerToken = createMockJwt(customerUser.id, customerUser.email, customerUser.role);

  const shopUser: AuthUser = {
    id: "user_shop_002",
    email: "shopkeeper@medifind.test",
    name: "Shopkeeper Mehta",
    role: "shop_owner"
  };
  const shopToken = createMockJwt(shopUser.id, shopUser.email, shopUser.role);

  const riderUser: AuthUser = {
    id: "user_rider_003",
    email: "rider@medifind.test",
    name: "Rider Kumar",
    role: "rider"
  };
  const riderToken = createMockJwt(riderUser.id, riderUser.email, riderUser.role);

  // Initialize simulated tabs
  const tab1 = createTabContext("Tab 1 (Customer)", "/dashboard/user");
  const tab2 = createTabContext("Tab 2 (Shopkeeper)", "/dashboard/shop");
  const tab3 = createTabContext("Tab 3 (Rider)", "/dashboard/rider");

  console.log("--- TEST 1: Tab 1 Customer Login ---");
  tab1.activate();
  saveAuthSession(customerUser, customerToken);
  const t1User = getStoredUser("user");
  assert(t1User !== null && t1User.role === "user" && t1User.email === customerUser.email, "Tab 1 logs in as Customer with correct role");

  console.log("\n--- TEST 2: Tab 2 Shopkeeper Login (Does NOT overwrite Tab 1) ---");
  tab2.activate();
  saveAuthSession(shopUser, shopToken);
  const t2User = getStoredUser("shop_owner");
  assert(t2User !== null && t2User.role === "shop_owner" && t2User.email === shopUser.email, "Tab 2 logs in as Shopkeeper with correct role");

  // Re-check Tab 1 WITHOUT refreshing yet
  tab1.activate();
  const t1PreRefresh = getStoredUser();
  assert(t1PreRefresh !== null && t1PreRefresh.role === "user", "Tab 1 active session is preserved while Tab 2 is active");

  console.log("\n--- TEST 3: Tab 1 Customer Page Refresh ---");
  // Simulate page refresh on Tab 1: React state resets, components remount and call getStoredUser
  tab1.activate();
  const t1PostRefresh = getStoredUser();
  assert(
    t1PostRefresh !== null &&
    t1PostRefresh.role === "user" &&
    t1PostRefresh.email === customerUser.email,
    "Tab 1 on refresh stays Customer (NEVER silently converted to Shopkeeper)"
  );
  assert(t1PostRefresh?.role !== "shop_owner", "Tab 1 never assumes Tab 2's Shopkeeper role on refresh");

  console.log("\n--- TEST 4: Tab 2 Shopkeeper Page Refresh ---");
  // Simulate page refresh on Tab 2
  tab2.activate();
  const t2PostRefresh = getStoredUser();
  assert(
    t2PostRefresh !== null &&
    t2PostRefresh.role === "shop_owner" &&
    t2PostRefresh.email === shopUser.email,
    "Tab 2 on refresh stays Shopkeeper (NEVER converted to Customer)"
  );

  console.log("\n--- TEST 5: Tab 3 Rider Login & Independent Operation ---");
  tab3.activate();
  saveAuthSession(riderUser, riderToken);
  const t3User = getStoredUser("rider");
  assert(t3User !== null && t3User.role === "rider", "Tab 3 logs in as Rider");

  // Verify Tab 1, Tab 2, and Tab 3 all coexist
  tab1.activate();
  assert(getStoredUser()?.role === "user", "Tab 1 remains Customer while Tab 3 is active");
  tab2.activate();
  assert(getStoredUser()?.role === "shop_owner", "Tab 2 remains Shopkeeper while Tab 3 is active");
  tab3.activate();
  assert(getStoredUser()?.role === "rider", "Tab 3 remains Rider across context switches");

  console.log("\n--- TEST 6: Tab-Isolated Logout ---");
  // Customer logs out in Tab 1
  tab1.activate();
  clearAuthSession("user");
  assert(getStoredUser() === null, "Tab 1 session is cleared after logout");

  // Shopkeeper in Tab 2 and Rider in Tab 3 MUST still be logged in!
  tab2.activate();
  assert(getStoredUser()?.role === "shop_owner", "Tab 2 Shopkeeper remains active after Tab 1 logout");
  tab3.activate();
  assert(getStoredUser()?.role === "rider", "Tab 3 Rider remains active after Tab 1 logout");

  console.log("\n--- TEST 7: Fresh Tab Hydration for Target Dashboard ---");
  // User opens a brand new tab directly to /dashboard/shop where sessionStorage is empty
  const tab4 = createTabContext("Tab 4 (Fresh Shop Tab)", "/dashboard/shop");
  tab4.activate();
  // sessionStorage is empty in tab4 initially
  assert(tab4.tabSessionStorage.getItem("medifind_token") === null, "Tab 4 starts with empty sessionStorage");
  const tab4User = getStoredUser("shop_owner");
  assert(tab4User !== null && tab4User.role === "shop_owner", "Tab 4 hydrates Shopkeeper session from role-scoped storage for /dashboard/shop");
  assert(tab4.tabSessionStorage.getItem("medifind_token") === shopToken, "Tab 4 session token is now isolated in tab4 sessionStorage");

  console.log("\n--- TEST 8: Token Expiration Handling ---");
  const expiredToken = createMockJwt("user_exp_009", "expired@medifind.test", "user", -100);
  const tab5 = createTabContext("Tab 5 (Expired Token Tab)", "/dashboard/user");
  tab5.activate();
  saveAuthSession({ id: "user_exp_009", email: "expired@medifind.test", name: "Expired User", role: "user" }, expiredToken);
  assert(isTokenExpired(expiredToken), "isTokenExpired correctly detects expired JWT");
  const expiredUser = getStoredUser();
  assert(expiredUser === null, "getStoredUser rejects expired token and returns null");

  console.log("\n=================================================================");
  console.log(`TEST SUMMARY: ${testsPassed} passed, ${testsFailed} failed`);
  console.log("=================================================================");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(e => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
