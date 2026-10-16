# VELoop Rewards Wallet & Payout System — API Documentation

The VELoop Wallet API provides transactional reward accounting, append-only ledger tracking, idempotent withdrawals, daily reward claims, and administrative auditing backed by a MongoDB replica set.

All endpoints are rooted under `/api`. All timestamps are in ISO 8601 UTC format. All monetary rewards and point balances are integer-denominated.

---

## Table of Contents
1. [Authentication (`/auth`)](#1-authentication-auth)
2. [Wallet & Ledger (`/wallet`)](#2-wallet--ledger-wallet)
3. [Rewards System (`/rewards`)](#3-rewards-system-rewards)
4. [Payout Configuration (`/payout`)](#4-payout-configuration-payout)
5. [Withdrawals Engine (`/withdrawals`)](#5-withdrawals-engine-withdrawals)
6. [Administration (`/admin` & `/wallet`)](#6-administration-admin--wallet)
7. [Health & Diagnostics (`/health`)](#7-health--diagnostics-health)
8. [Standard Error Formats & Codes](#8-standard-error-formats--codes)

---

## 1. Authentication (`/auth`)

### 1.1 Register User
- **Method / Path:** `POST /api/auth/register`
- **Auth:** None (Public)
- **Rate Limit:** 20 requests per 15 minutes per IP
- **Request Body:**
  ```json
  {
    "email": "user@domain.com",
    "password": "Password123!"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsIn...",
      "user": {
        "id": "67b0d9124a87c...",
        "email": "user@domain.com",
        "role": "user",
        "accountStatus": "active"
      }
    }
  }
  ```
- **Errors:**
  - `400 VALIDATION_ERROR`: Invalid email format or password under 6 characters.
  - `409 EMAIL_EXISTS`: "Email is already registered."

---

### 1.2 User Login
- **Method / Path:** `POST /api/auth/login`
- **Auth:** None (Public)
- **Rate Limit:** 20 requests per 15 minutes per IP
- **Request Body:**
  ```json
  {
    "email": "demo@veloop.test",
    "password": "DemoPassword123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsIn...",
      "user": {
        "id": "67b0d9124a87c...",
        "email": "demo@veloop.test",
        "role": "user",
        "accountStatus": "active"
      }
    }
  }
  ```
- **Errors:**
  - `401 INVALID_CREDENTIALS`: "Invalid email or password."
  - `403 ACCOUNT_SUSPENDED`: "This request requires additional verification."

---

### 1.3 Get Current User Profile
- **Method / Path:** `GET /api/auth/me`
- **Auth:** Bearer Token (`Authorization: Bearer <token>`)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "67b0d9124a87c...",
        "email": "demo@veloop.test",
        "role": "user",
        "accountStatus": "active",
        "createdAt": "2026-10-16T13:00:00.000Z"
      },
      "wallet": {
        "userId": "67b0d9124a87c...",
        "VEs": 25000,
        "SVEs": 5000,
        "Gems": 100,
        "Tokens": 500,
        "Spins": 3,
        "updatedAt": "2026-10-16T13:00:00.000Z"
      }
    }
  }
  ```
- **Errors:**
  - `401 UNAUTHORIZED`: "Authentication required."

---

## 2. Wallet & Ledger (`/wallet`)

### 2.1 Get Current Wallet Balances
- **Method / Path:** `GET /api/wallet`
- **Auth:** Bearer Token
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "userId": "67b0d9124a87c...",
      "VEs": 25000,
      "SVEs": 5000,
      "Gems": 100,
      "Tokens": 500,
      "Spins": 3,
      "updatedAt": "2026-10-16T13:00:00.000Z"
    }
  }
  ```

---

### 2.2 Get Wallet Summary
- **Method / Path:** `GET /api/wallet/summary`
- **Auth:** Bearer Token
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "balances": {
        "userId": "67b0d9124a87c...",
        "VEs": 25000,
        "SVEs": 5000,
        "Gems": 100,
        "Tokens": 500,
        "Spins": 3
      },
      "summary": {
        "pendingWithdrawals": 1,
        "vesActivity": {
          "totalCredited": 25000,
          "totalDebited": 2400
        }
      }
    }
  }
  ```

---

### 2.3 Get Ledger Transactions
- **Method / Path:** `GET /api/wallet/transactions?page=1&limit=20&currency=VEs`
- **Auth:** Bearer Token
- **Query Parameters:**
  - `page`: Integer (default 1)
  - `limit`: Integer (default 20, max 100)
  - `currency`: Enum (`VEs`, `SVEs`, `Gems`, `Tokens`, `Spins`, optional)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "transactionId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "userId": "67b0d9124a87c...",
        "currency": "VEs",
        "type": "DEBIT",
        "category": "WITHDRAWAL",
        "amount": 2400,
        "balanceBefore": 25000,
        "balanceAfter": 22600,
        "source": "USER",
        "referenceId": "d9817f7b-...",
        "status": "COMPLETED",
        "description": "Withdrawal for ₹10 UPI Transfer",
        "metadata": { "optionId": "upi_10" },
        "createdAt": "2026-10-16T13:10:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
  ```

---

### 2.4 Reconcile Wallet (User-Facing)
- **Method / Path:** `GET /api/wallet/reconcile`
- **Auth:** Bearer Token
- **Description:** Verifies that current wallet balances equal `Σ CREDIT − Σ DEBIT` computed directly from the append-only ledger for every currency.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "userId": "67b0d9124a87c...",
      "matches": true,
      "reconciledAt": "2026-10-16T13:15:00.000Z",
      "perCurrency": {
        "VEs": {
          "ledgerBalance": 22600,
          "walletBalance": 22600,
          "matches": true,
          "credits": 25000,
          "debits": 2400,
          "difference": 0,
          "creditTransactions": 3,
          "debitTransactions": 1
        },
        "SVEs": { "ledgerBalance": 5000, "walletBalance": 5000, "matches": true, "difference": 0 }
      }
    }
  }
  ```

---

## 3. Rewards System (`/rewards`)

### 3.1 Claim Daily Reward
- **Method / Path:** `POST /api/rewards/daily`
- **Auth:** Bearer Token
- **Rate Limit:** 30 mutations per min; Enforced strictly 1 claim per UTC day in database.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Daily reward claimed! +100 VEs",
    "data": {
      "claimed": true,
      "amount": 100,
      "currency": "VEs",
      "dayKey": "2026-10-16",
      "newBalance": 25100,
      "transactionId": "c9284fa9-..."
    }
  }
  ```
- **Errors:**
  - `400 DAILY_REWARD_ALREADY_CLAIMED`: "Daily reward has already been claimed today."

---

### 3.2 Claim Video Ad Reward
- **Method / Path:** `POST /api/rewards/ad`
- **Auth:** Bearer Token
- **Rate Limit:** Max 10 claims per user per UTC day.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Ad reward claimed! +100 VEs (9 remaining today)",
    "data": {
      "claimed": true,
      "amount": 100,
      "currency": "VEs",
      "dayKey": "2026-10-16",
      "claimsToday": 1,
      "remainingToday": 9,
      "newBalance": 25200,
      "transactionId": "b8372cb1-..."
    }
  }
  ```
- **Errors:**
  - `429 AD_REWARD_LIMIT_REACHED`: "Maximum daily ad rewards reached (10/10)."

---

### 3.3 Get Rewards Status
- **Method / Path:** `GET /api/rewards/status`
- **Auth:** Bearer Token
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "dayKey": "2026-10-16",
      "dailyReward": {
        "claimedToday": true,
        "claimedAt": "2026-10-16T13:20:00.000Z",
        "amount": 100
      },
      "adReward": {
        "claimsToday": 1,
        "maxPerDay": 10,
        "remainingToday": 9,
        "amount": 100
      }
    }
  }
  ```

---

## 4. Payout Configuration (`/payout`)

### 4.1 Get Payout Methods
- **Method / Path:** `GET /api/payout/methods`
- **Auth:** Bearer Token
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "upi",
        "name": "UPI Payout",
        "description": "Instant transfer to your Virtual Payment Address (UPI VPA)",
        "payoutCurrency": "INR",
        "requiredFields": ["upiId"],
        "available": true
      },
      {
        "id": "amazon",
        "name": "Amazon Gift Card",
        "description": "Digital gift card delivered directly to your email",
        "payoutCurrency": "INR",
        "requiredFields": ["email"],
        "available": false
      }
    ]
  }
  ```

---

### 4.2 Get Denominations for Method
- **Method / Path:** `GET /api/payout/options/:method`
- **Auth:** Bearer Token
- **Path Parameters:** `method` (e.g. `upi`, `amazon`, `google_play`)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "method": {
        "id": "upi",
        "name": "UPI Payout",
        "requiredFields": ["upiId"]
      },
      "options": [
        {
          "optionId": "upi_10",
          "name": "₹10 UPI Transfer",
          "currency": "VEs",
          "requiredAmount": 2400,
          "payoutValue": 10,
          "payoutCurrency": "INR",
          "sortOrder": 1
        },
        {
          "optionId": "upi_25",
          "name": "₹25 UPI Transfer",
          "currency": "VEs",
          "requiredAmount": 5800,
          "payoutValue": 25,
          "payoutCurrency": "INR",
          "sortOrder": 2
        }
      ]
    }
  }
  ```
- **Errors:**
  - `503 INACTIVE_PAYOUT_METHOD`: "This payout method is currently unavailable."

---

## 5. Withdrawals Engine (`/withdrawals`)

### 5.1 Submit Withdrawal (Option A Strategy)
- **Method / Path:** `POST /api/withdrawals`
- **Auth:** Bearer Token
- **Rate Limit:** 10 submissions per hour per user
- **Required Headers:**
  - `Idempotency-Key`: 8–100 chars (`^[A-Za-z0-9_-]{8,100}$`)
- **Request Body:**
  ```json
  {
    "optionId": "upi_10",
    "payoutDetails": {
      "upiId": "gamer@okaxis"
    }
  }
  ```
  *(Note: Any client-supplied `amount` field is strictly ignored by the server).*
- **Response (201 Created — First Submission):**
  ```json
  {
    "success": true,
    "duplicate": false,
    "message": "Withdrawal submitted successfully. Status: Pending",
    "data": {
      "id": "67b0dc34a9...",
      "withdrawalId": "e8124b89-...",
      "userId": "67b0d9124a87c...",
      "optionId": "upi_10",
      "method": "upi",
      "currency": "VEs",
      "requiredAmount": 2400,
      "payoutValue": 10,
      "payoutCurrency": "INR",
      "payoutDetails": {
        "upiId": "ga****@okaxis"
      },
      "status": "PENDING",
      "idempotencyKey": "idem-key-87364-unique",
      "createdAt": "2026-10-16T13:25:00.000Z"
    }
  }
  ```
- **Response (200 OK — Duplicate Submission with Same Key):**
  ```json
  {
    "success": true,
    "duplicate": true,
    "message": "This withdrawal request has already been submitted.",
    "data": {
      "id": "67b0dc34a9...",
      "withdrawalId": "e8124b89-...",
      "status": "PENDING"
    }
  }
  ```
- **Errors:**
  - `400 MISSING_IDEMPOTENCY_KEY`: "Idempotency-Key header is required"
  - `400 INVALID_PAYOUT_OPTION`: "Selected payout option is unavailable."
  - `409 TOO_MANY_PENDING`: "Maximum pending withdrawal requests reached."
  - `422 INSUFFICIENT_BALANCE`: "Insufficient VEs balance."

---

### 5.2 List User Withdrawals
- **Method / Path:** `GET /api/withdrawals?page=1&limit=20&status=PENDING`
- **Auth:** Bearer Token
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "withdrawalId": "e8124b89-...",
        "method": "upi",
        "payoutValue": 10,
        "payoutCurrency": "INR",
        "requiredAmount": 2400,
        "currency": "VEs",
        "payoutDetails": { "upiId": "ga****@okaxis" },
        "status": "PENDING",
        "createdAt": "2026-10-16T13:25:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "pages": 1 }
  }
  ```

---

### 5.3 Get Single Withdrawal
- **Method / Path:** `GET /api/withdrawals/:id`
- **Auth:** Bearer Token (Strict ownership enforced)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "withdrawalId": "e8124b89-...",
      "status": "PENDING",
      "requiredAmount": 2400,
      "payoutValue": 10
    }
  }
  ```
- **Errors:**
  - `404 NOT_FOUND`: "Withdrawal not found" (returned if withdrawal does not exist or belongs to another user).

---

### 5.4 Cancel Pending Withdrawal
- **Method / Path:** `POST /api/withdrawals/:id/cancel`
- **Auth:** Bearer Token
- **Description:** Atomically cancels a `PENDING` request and credits the user wallet with a `REVERSAL` ledger entry.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Withdrawal cancelled successfully and balance refunded.",
    "data": {
      "withdrawalId": "e8124b89-...",
      "status": "CANCELLED"
    }
  }
  ```
- **Errors:**
  - `409 INVALID_TRANSITION`: "Invalid status transition."

---

## 6. Administration (`/admin` & `/wallet`)

All endpoints in this section require a user with role `admin`.

### 6.1 Admin Credit User Wallet
- **Method / Path:** `POST /api/wallet/credit`
- **Auth:** Admin Bearer Token
- **Headers:** Optional `Idempotency-Key`
- **Request Body:**
  ```json
  {
    "userId": "67b0d9124a87c...",
    "currency": "VEs",
    "amount": 5000,
    "reason": "Prize distribution"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Successfully credited 5000 VEs to user",
    "data": {
      "wallet": { "VEs": 30000 },
      "transaction": { "transactionId": "..." }
    }
  }
  ```

---

### 6.2 Admin Debit User Wallet
- **Method / Path:** `POST /api/wallet/debit`
- **Auth:** Admin Bearer Token
- **Headers:** Optional `Idempotency-Key`
- **Request Body:**
  ```json
  {
    "userId": "67b0d9124a87c...",
    "currency": "VEs",
    "amount": 1000,
    "reason": "Administrative penalty"
  }
  ```

---

### 6.3 List All Withdrawals
- **Method / Path:** `GET /api/admin/withdrawals?page=1&limit=20&status=PENDING`
- **Auth:** Admin Bearer Token
- **Response (200 OK):** Paginated list of all system withdrawals with user email attached.

---

### 6.4 Review Withdrawal (Approve/Reject)
- **Method / Path:** `POST /api/admin/withdrawals/:id/review`
- **Auth:** Admin Bearer Token
- **Request Body:**
  ```json
  {
    "status": "APPROVED", // or "REJECTED" or "PROCESSING"
    "reviewNotes": "Banking partner transaction ref #TXN998811"
  }
  ```
  *(If REJECTED, an atomic refund is immediately credited to the user's wallet with category REVERSAL).*
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Withdrawal successfully updated to APPROVED",
    "data": { "status": "APPROVED" }
  }
  ```

---

### 6.5 Admin Reconcile Any User
- **Method / Path:** `GET /api/admin/reconcile/:userId`
- **Auth:** Admin Bearer Token
- **Response (200 OK):** Detailed ledger aggregation comparison vs wallet balances.

---

### 6.6 Admin Update Payout Option
- **Method / Path:** `PATCH /api/admin/payout-options/:optionId`
- **Auth:** Admin Bearer Token
- **Request Body:**
  ```json
  {
    "active": true,
    "requiredAmount": 2500
  }
  ```
- **Description:** Updates option configuration and records a `PAYOUT_CONFIG_CHANGED` audit log in the database.

---

## 7. Health & Diagnostics (`/health`)

- **Method / Path:** `GET /api/health`
- **Auth:** None (Public)
- **Response (200 OK):**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-16T13:30:00.000Z",
    "database": {
      "connected": true,
      "readyState": 1,
      "replicaSet": "rs0"
    }
  }
  ```

---

## 8. Standard Error Formats & Codes

All errors return consistent JSON:
```json
{
  "success": false,
  "message": "Human readable description",
  "code": "ERROR_CODE"
}
```

| HTTP Status | Error Code | Example Message | Cause |
|---|---|---|---|
| `400` | `INVALID_PAYOUT_OPTION` | "Selected payout option is unavailable." | Invalid or inactive optionId |
| `400` | `MISSING_IDEMPOTENCY_KEY` | "Idempotency-Key header is required" | Missing header on withdrawals |
| `400` | `VALIDATION_ERROR` | "Missing required field: upiId" | Invalid format or missing fields |
| `401` | `UNAUTHORIZED` | "Authentication required." | Missing or expired JWT |
| `403` | `FORBIDDEN` | "Access forbidden: insufficient permissions." | Non-admin accessing admin route |
| `403` | `ACCOUNT_SUSPENDED` | "This request requires additional verification." | Account flagged/suspended |
| `404` | `NOT_FOUND` | "Withdrawal not found" | Resource does not exist or not owned |
| `409` | `TOO_MANY_PENDING` | "Maximum pending withdrawal requests reached." | User already has 3 pending items |
| `409` | `INVALID_TRANSITION` | "Invalid status transition." | Illegal state change (e.g. Approved -> Cancelled) |
| `422` | `INSUFFICIENT_BALANCE` | "Insufficient VEs balance." | Conditional balance guard failed |
| `429` | `RATE_LIMIT_EXCEEDED` | "Too many attempts. Please try again." | Exceeded rate limit bucket |
| `503` | `INACTIVE_PAYOUT_METHOD` | "This payout method is currently unavailable." | Method has no active options |
