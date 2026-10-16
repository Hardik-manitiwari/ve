# VELoop Rewards Wallet — Backend Service

The Node.js/Express backend provides transactional ledger accounting, idempotent withdrawals, daily reward claims, and administrative auditing. It connects to a local single-node MongoDB replica set `rs0` (`mongodb://localhost:27017/veloop_wallet?replicaSet=rs0`).

## Commands

- `npm install`: Install dependencies
- `npm run seed`: Seeds admin and demo user, initial balances, and payout options
- `npm test`: Runs all 14 test scenarios against single-node in-memory replica set
- `npm run dev`: Starts development server with native file watching on port 5000
- `npm start`: Starts production server

## API Documentation

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for full endpoint specifications, payloads, headers, and error codes.
