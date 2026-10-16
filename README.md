# VELoop Rewards Wallet & Payout System

VELoop is an enterprise-grade, high-concurrency Rewards Wallet & Payout System built from scratch with Node.js, Express, MongoDB (Replica Set transactions), and React + Vite.

The backend acts as the single source of truth for all balances, ledger accounting, and payout logic. The frontend only displays data and sends requests without trusting client-side balances.

---

## 1. System Architecture & Key Design Decisions

### 1.1 Withdrawal Strategy: Option A (Deduct Immediately, Refund on Reject/Cancel)
- **Why Option A?**
  In high-traffic reward environments, debiting the balance immediately upon withdrawal submission prevents double-spending and overdrafts. Once points are committed to a withdrawal request, the user cannot re-spend those points on another payout or in-game transaction while review is pending.
- **Atomic Execution:**
  The entire creation process runs within a single MongoDB multi-document transaction:
  `Idempotency Guard → Balance Check & Conditional Debit → Append-Only Ledger Entry → Withdrawal Document Creation → Audit Log`.
- **Reversal via Ledger:**
  If a withdrawal is rejected by an administrator or cancelled by the user, the server initiates an atomic transaction that credits the user wallet and writes a `REVERSAL` ledger record with the withdrawal ID as reference. This preserves ledger integrity without modifying past ledger records.
- **Conditional Status Transition Guard:**
  Transitions (`PENDING → PROCESSING/APPROVED/REJECTED/CANCELLED`, `PROCESSING → APPROVED/REJECTED`) execute via conditional updates on the existing state (`{ _id: id, status: currentStatus }`), preventing concurrent review race conditions.

### 1.2 Strict Idempotency Architecture
- **Per-User Composite Unique Index:**
  Withdrawals require an `Idempotency-Key` header (8–100 characters). A compound unique index on `(userId, idempotencyKey)` at the MongoDB storage engine level guarantees that repeated submissions return the original document with `{ duplicate: true }` and HTTP 200 without executing a second debit.
- **Admin Mutation Idempotency:**
  Administrative credit/debit adjustments support optional idempotency headers stored in an `IdempotencyKey` collection with automatic TTL expiration.

### 1.3 Atomic Conditional Balance Updates
- In place of naive read-modify-write patterns (which cause race conditions under concurrent load), debits utilize MongoDB conditional atomic updates:
  ```javascript
  Wallet.findOneAndUpdate(
    { userId, [currency]: { $gte: amount } },
    { $inc: { [currency]: -amount } },
    { new: true, session }
  );
  ```
  If balance is insufficient, the document match fails atomically and throws `INSUFFICIENT_BALANCE` (422). Under heavy concurrent debits, exactly one debit succeeds and the other fails safely.

### 1.4 Append-Only Ledger (`WalletTransaction`)
- Every balance mutation is coupled with exactly one immutable ledger row containing:
  - `transactionId` (UUID v4)
  - `userId`, `currency`, `type` (`CREDIT` | `DEBIT`), `category`
  - `amount`, `balanceBefore`, `balanceAfter`
  - `source`, `referenceId`, `status`, `description`, `metadata`, `createdAt`
- No ledger rows are ever updated or deleted. Corrections are applied through new `CORRECTION` or `REVERSAL` ledger rows.

### 1.5 Real-Time Reconciliation Engine
- Both users and administrators can trigger reconciliation (`GET /api/wallet/reconcile` and `GET /api/admin/reconcile/:userId`).
- The engine computes:
  $$\text{Ledger Balance} = \sum \text{CREDIT} - \sum \text{DEBIT}$$
  for each currency (`VEs`, `SVEs`, `Gems`, `Tokens`, `Spins`) and verifies equality against the wallet balance document.

### 1.6 Audit Trails
- Critical actions (`WITHDRAWAL_CREATED`, `WITHDRAWAL_APPROVED`, `WITHDRAWAL_REJECTED`, `WITHDRAWAL_CANCELLED`, `WALLET_CREDIT`, `WALLET_DEBIT`, `PAYOUT_CONFIG_CHANGED`) log actor ID, target user, IP address, timestamp, and diff metadata inside the transaction.

---

## 2. Environment & MongoDB Replica Set Setup

MongoDB transactions require a replica set. The application is configured to run against a local single-node replica set named `rs0`.

### 2.1 Starting MongoDB Replica Set `rs0`

1. **Start mongod with the replica set parameter:**
   ```powershell
   mongod --replSet rs0 --dbpath <path-to-data-directory> --port 27017
   ```
   *(Or if running MongoDB as a Windows Service, add `replication.replSetName: rs0` to your `mongod.cfg` and restart the service).*

2. **Initiate the replica set once via `mongosh`:**
   ```javascript
   mongosh --eval "rs.initiate()"
   ```
   Verify status with `rs.status()`. You should see `"set": "rs0"` and `"stateStr": "PRIMARY"`.

3. **Connection String:**
   ```
   mongodb://localhost:27017/veloop_wallet?replicaSet=rs0
   ```

### 2.2 Environment Variables

Create `backend/.env` (a template is committed in `backend/.env.example`):
```ini
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/veloop_wallet?replicaSet=rs0
JWT_SECRET=veloop_super_secure_jwt_secret_key_production_grade_2026!
JWT_EXPIRES_IN=1d
CORS_ORIGIN=http://localhost:5173
DEMO_PASSWORD=DemoPassword123!
ADMIN_PASSWORD=AdminPassword123!
```

---

## 3. Quick Start & Runnable Commands

### 3.1 Install Dependencies
From repository root:
```powershell
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

### 3.2 Seed Database (`npm run seed`)
```powershell
cd backend
npm run seed
```
**What the seed script does:**
- Validates `NODE_ENV !== 'production'`.
- Upserts demo user `demo@veloop.test` (`DemoPassword123!`).
- Upserts admin user `admin@veloop.test` (`AdminPassword123!`).
- Resets demo user's wallet and credits via transactional ledger:
  - `VEs`: 25,000 (20k bonus, 3k ad reward, 2k daily reward)
  - `SVEs`: 5,000
  - `Gems`: 100
  - `Tokens`: 500
  - `Spins`: 3
- Upserts standard UPI payout options (₹10 = 2400 VEs, ₹25 = 5800 VEs, up to ₹1000 = 150000 VEs) and disabled voucher options.
- Runs reconciliation verification.

### 3.3 Run Tests (`npm test`)
```powershell
cd backend
npm test
```
Executes all 14 test scenarios against a dedicated in-memory replica set via `node:test` and `supertest`.

### 3.4 Start Development Servers (`npm run dev`)
From root:
```powershell
npm run dev
```
Or start individually:
```powershell
# Terminal 1: Backend API (Port 5000)
cd backend
npm run dev

# Terminal 2: Frontend App (Port 5173)
cd frontend
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 4. Test Scenarios & Manual Verification

The test suite (`backend/tests/wallet.test.js`) covers 14 mission-critical scenarios:

| # | Test Scenario | Verified Behavior |
|---|---|---|
| **1** | Credit then credit (1000 + 500 = 1500) | Two sequential credits create two ledger rows; balances correctly update to 1000 and 1500. |
| **2** | Debit (1500 − 1000 = 500) | Balance drops from 1500 to 500; `balanceBefore` and `balanceAfter` ledger fields verified. |
| **3** | Insufficient balance rejected | Debit of 1000 on 500 throws `INSUFFICIENT_BALANCE` (422); balance unchanged at 500. |
| **4** | Double-submit idempotency | Duplicate `Idempotency-Key` returns original withdrawal with `duplicate: true` (HTTP 200); exactly 1 debit executed. |
| **5** | Concurrent debits race condition | Two concurrent debits of 8,000 on 10,000: exactly one succeeds, one fails with 422; balance is 2,000. |
| **6** | Invalid `optionId` rejected | Invalid option returns 400 `INVALID_PAYOUT_OPTION` ("Selected payout option is unavailable."). |
| **7** | Ownership isolation | User A's withdrawal cannot be read by User B via `GET /api/withdrawals/:id` (returns 404). |
| **8** | Reversal on rejection | Admin rejecting withdrawal restores balance to user and writes a `REVERSAL` ledger record. |
| **9** | Client-sent amount ignored | Body with `amount: 1` still debits option's true `requiredAmount` (2,400 VEs). |
| **10** | Multi-operation reconciliation | After a mix of credits, debits, cancels, and rejects, `Σ CREDIT − Σ DEBIT` matches wallet balance 100%. |
| **11** | Daily reward once per UTC day | Second daily reward claim in the same UTC day fails with 400 `DAILY_REWARD_ALREADY_CLAIMED`. |
| **12** | Max pending withdrawals | Attempting a 4th pending withdrawal returns 409 `TOO_MANY_PENDING`. |
| **13** | Unauthenticated protection | Missing `Authorization` header returns 401 `UNAUTHORIZED`. |
| **14** | Admin role authorization | Non-admin calling `POST /api/wallet/credit` returns 403 `FORBIDDEN`. |

### How to Manually Run End-to-End in UI:
1. Open [http://localhost:5173](http://localhost:5173).
2. Click **"Demo User (25k VEs)"** on the login page to pre-fill credentials and click **Sign In**.
3. View the **25,000 VEs** balance and test claiming **"Claim Daily"** or **"Watch Ad (+100 VEs)"**. Notice instant balance update and verified ledger row in the activity table.
4. Click **"Withdraw / Redeem"** or **Redeem** in the top navigation.
5. Select **UPI Payout**, pick **₹10 UPI Transfer (2,400 VEs)**, enter a valid UPI ID (e.g. `gamer@okaxis`), and click **Proceed to Redeem**.
6. Review the modal: *"Are you sure you want to redeem this reward? Payout: ₹10, Required: 2,400 VEs"*. Click **Confirm**.
7. Observe the success screen: *"Withdrawal submitted successfully. Status: Pending"*.
8. Navigate to **History** (`/withdrawals`) to see the pending withdrawal with its status badge. Click **Cancel** on the item to test instantaneous reversal refund.

---

## 5. Security Architecture

- **Stateless JWT Authentication:** Signed with HS256 algorithm and stored only in browser `sessionStorage` (cleared on tab close).
- **Dynamic Role & Account Verification:** Every authenticated request looks up the user's current `role` and `accountStatus` in the database rather than trusting values embedded in the token payload.
- **Strict Query Ownership:** No endpoint allows a client to provide a `userId` parameter for user-scoped data. Ownership is enforced via `req.user._id`.
- **Sensitive Data Masking:** Recipient details (UPI IDs and emails) are masked in API responses (e.g., `na****@okaxis`, `jo****@gmail.com`).
- **Defensive HTTP Protections:** `helmet` headers, origin-restricted CORS, 10 KB JSON body limits, rate-limit buckets per IP and per user, and standardized operational error sanitization (no database internals or stack traces exposed).

---

## 6. Scaling to 1,000,000 Active Users

Designing the rewards wallet system to reliably scale to 1,000,000 daily active users (DAU) and millions of transactions:

### 6.1 MongoDB Sharding & Transactions
- **Sharded Cluster Architecture:**
  Shard collections by a hashed compound key: `userId` (or `shardKey: { userId: "hashed" }`).
  Because every balance mutation, transaction, and withdrawal check is scoped to a single `userId`, multi-document transactions remain **localized to a single shard** (Single-Shard Transactions). This avoids expensive two-phase commit (2PC) cross-shard overhead.
- **Read/Write Separation:**
  Configure secondary nodes with `readPreference: secondaryPreferred` for read-heavy operations like `GET /api/wallet/transactions` and `GET /api/payout/methods`. Critical balance checks and debit mutations strictly use `readPreference: primary` with `writeConcern: majority`.

### 6.2 Ledger Architecture (Hot Balances vs. Historical Cold Storage)
- **Time-Partitioned Ledger:**
  The `WalletTransaction` collection grows at tens of millions of records per month. Implement automated time-series bucket partitioning or MongoDB collection archiving for transactions older than 90 days.
- **Materialized Snapshot Balance Checkpoints:**
  Implement daily balance checkpoints (e.g. `DailyWalletSnapshot`). Reconciliation does not need to scan all historical records back to day zero; it aggregates from the latest verified checkpoint forward:
  $$\text{Current Balance} = \text{Checkpoint Balance} + \sum_{t > \text{snapshot}} (\text{CREDIT} - \text{DEBIT})$$

### 6.3 Distributed Idempotency Layer with Redis
- Rather than relying solely on MongoDB unique indexes under extreme throughput, employ Redis with atomic `SET key uuid NX EX 86400`:
  1. Incoming `POST /api/withdrawals` acquires lock key `idempotency:withdrawal:{userId}:{key}`.
  2. If key exists, return cached response or poll for completion.
  3. Upon MongoDB transaction commit, store the response in Redis cache.

### 6.4 Asynchronous Payout Queues (BullMQ / RabbitMQ / Kafka)
- The user-facing API only performs **Option A deduction and state initialization to `PENDING`**.
- An asynchronous queue worker system:
  1. Consumes pending withdrawal events from Kafka/BullMQ.
  2. Executes batch bank disbursement via UPI/Banking Partner APIs (Cashfree, RazorpayX, PayU).
  3. Handles automated webhooks: on bank success, sets status to `APPROVED`; on bank bounce/failure, sets status to `REJECTED` and triggers atomic `REVERSAL`.

### 6.5 Intelligent Caching & Rate Limiting
- **Redis Cache:** Cache static payout configurations (`/api/payout/methods`, `/api/payout/options/*`) with a 10-minute TTL, invalidating only when admin triggers `PATCH /api/admin/payout-options/:id`.
- **Sliding-Window Rate Limiting:** Enforce distributed rate limiting using Redis token buckets (e.g. Envoy or Redis cell) to defend against bot farms and automated reward clickers.

### 6.6 Fraud Detection & Anomaly Screening
- **Velocity Screening:** Flag users with more than $N$ reward claims or IP changes per hour.
- **Hold Rules:** High-value payouts (> ₹500) automatically transition to `PROCESSING` with manual review required.
- **Device & Fingerprint Telemetry:** Bind claims to hardware identifiers and VPN/proxy detection services.

### 6.7 Automated Continuous Reconciliation & Monitoring
- **Periodic Cron Worker:** A background reconciliation job runs every night for active users, comparing ledger sums to wallet balances. Any anomaly triggers immediate alerts (PagerDuty / Slack webhook) and flags the account for audit.
- **Observability Stack:** OpenTelemetry tracing on transactions, Prometheus metrics for transaction duration and retry rates, and Grafana dashboards tracking VEs in circulation, daily burn rate, and pending liabilities.

---

## 7. Repository Layout

```
veloop-wallet/
├── backend/
│   ├── src/
│   │   ├── config/        env.js, db.js, constants.js, payoutMethods.js
│   │   ├── models/        User.js, Wallet.js, WalletTransaction.js, Withdrawal.js, PayoutOption.js, AuditLog.js, IdempotencyKey.js, DailyClaim.js, AdClaim.js
│   │   ├── services/      walletService.js, withdrawalService.js, payoutService.js, auditService.js, rewardService.js, reconciliationService.js
│   │   ├── controllers/   authController.js, walletController.js, withdrawalController.js, payoutController.js, rewardController.js, adminController.js
│   │   ├── middleware/    auth.js, rateLimit.js, errorHandler.js
│   │   ├── routes/        authRoutes.js, walletRoutes.js, withdrawalRoutes.js, payoutRoutes.js, rewardRoutes.js, adminRoutes.js, index.js
│   │   ├── utils/         AppError.js, asyncHandler.js, transaction.js, serializers.js
│   │   ├── app.js
│   │   └── server.js
│   ├── seed/              seed.js, payoutOptions.js
│   ├── tests/             wallet.test.js, testHelper.js
│   ├── .env.example
│   ├── package.json
│   ├── README.md
│   └── API_DOCUMENTATION.md
├── frontend/              React + Vite + react-router
│   ├── src/
│   │   ├── api/           client.js (fetch wrapper)
│   │   ├── auth/          AuthContext.jsx, ProtectedRoute.jsx
│   │   ├── pages/         LoginPage.jsx, RegisterPage.jsx, WalletPage.jsx, PayoutPage.jsx, WithdrawalsPage.jsx
│   │   ├── components/    Layout.jsx, BalanceCard.jsx, TransactionList.jsx, PayoutMethodPicker.jsx, OptionPicker.jsx, ConfirmModal.jsx, StatusBadge.jsx, Alert.jsx, Spinner.jsx
│   │   └── main.jsx, App.jsx, styles.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── postman/VELoop-Wallet.postman_collection.json
├── README.md
└── .gitignore
```

---

## 8. License & Verification
Built for the VELoop Rewards Platform. Verified with Node.js v24, MongoDB Replica Set `rs0`, and 100% test scenario coverage.
