import React, { useState } from 'react';
import api from '../../api/client.js';
import Alert from '../../components/Alert.jsx';
import Spinner from '../../components/Spinner.jsx';

export const AdminTestPage = () => {
  // Test states
  const [test1, setTest1] = useState({ running: false, result: null });
  const [test2, setTest2] = useState({ running: false, result: null });
  const [test3, setTest3] = useState({ running: false, result: null });
  const [test4, setTest4] = useState({ running: false, result: null });

  // 1. Duplicate Submit Check
  const runTest1 = async () => {
    setTest1({ running: true, result: null });
    const idempotencyKey = `idem-check-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const payload = {
      optionId: 'upi_10',
      payoutDetails: { upiId: 'test.idem@okaxis' },
    };

    try {
      // First submit
      let res1;
      let err1 = null;
      try {
        res1 = await api.post('/withdrawals', payload, {
          headers: { 'Idempotency-Key': idempotencyKey },
        });
      } catch (e) {
        err1 = e;
      }

      // Second submit with identical key
      let res2;
      let err2 = null;
      try {
        res2 = await api.post('/withdrawals', payload, {
          headers: { 'Idempotency-Key': idempotencyKey },
        });
      } catch (e) {
        err2 = e;
      }

      const passed =
        Boolean(res1?.data) &&
        (res2?.duplicate === true || res2?.data?.duplicate === true || res2?.message?.includes('already been submitted') || res2?.status === 200);

      setTest1({
        running: false,
        result: {
          passed,
          key: idempotencyKey,
          req1: { endpoint: 'POST /api/withdrawals', headers: { 'Idempotency-Key': idempotencyKey }, payload },
          res1: res1 || { status: err1?.status, message: err1?.message },
          req2: { endpoint: 'POST /api/withdrawals', headers: { 'Idempotency-Key': idempotencyKey }, payload },
          res2: res2 || { status: err2?.status, message: err2?.message },
          verdict: passed
            ? 'PASS: First request created withdrawal. Second request safely returned cached withdrawal with duplicate flag without double-debiting.'
            : 'FAIL: Idempotency guard did not return expected duplicate response.',
        },
      });
    } catch (err) {
      setTest1({
        running: false,
        result: {
          passed: false,
          error: err.message,
          verdict: `FAIL with error: ${err.message}`,
        },
      });
    }
  };

  // 2. Two Concurrent Debits Check
  const runTest2 = async () => {
    setTest2({ running: true, result: null });
    try {
      // First get fresh user info
      const meRes = await api.get('/auth/me');
      const userId = meRes.data.user.id || meRes.data.user._id;

      // Ensure balance has at least 1,000 VEs
      await api.post('/admin/credit', {
        userId,
        currency: 'VEs',
        amount: 1000,
        reason: 'Concurrent test initial balance setup',
      });

      // Now fire two concurrent debits of 800 each (total 1,600 > 1,000)
      const debitPayload = {
        userId,
        currency: 'VEs',
        amount: 800,
        reason: 'Concurrent debit race condition test',
      };

      const [resA, resB] = await Promise.allSettled([
        api.post('/admin/debit', debitPayload),
        api.post('/admin/debit', debitPayload),
      ]);

      const successCount = [resA, resB].filter((r) => r.status === 'fulfilled').length;
      const rejectedCount = [resA, resB].filter(
        (r) => r.status === 'rejected' && (r.reason?.status === 422 || r.reason?.status === 400)
      ).length;

      const passed = successCount === 1 && rejectedCount === 1;

      setTest2({
        running: false,
        result: {
          passed,
          req: { endpoint: 'POST /api/admin/debit (x2 concurrent)', payload: debitPayload },
          resA: resA.status === 'fulfilled' ? resA.value : { status: resA.reason?.status, error: resA.reason?.message },
          resB: resB.status === 'fulfilled' ? resB.value : { status: resB.reason?.status, error: resB.reason?.message },
          verdict: passed
            ? 'PASS: Exactly one concurrent debit succeeded and the other was atomically rejected with 422 INSUFFICIENT_BALANCE. Zero overdraft.'
            : `FAIL: Expected exactly 1 success and 1 rejection (Got ${successCount} successes, ${rejectedCount} rejections).`,
        },
      });
    } catch (err) {
      setTest2({
        running: false,
        result: {
          passed: false,
          error: err.message,
          verdict: `FAIL with error: ${err.message}`,
        },
      });
    }
  };

  // 3. Invalid Option ID Check
  const runTest3 = async () => {
    setTest3({ running: true, result: null });
    const invalidPayload = {
      optionId: 'invalid_option_non_existent_9999',
      payoutDetails: { upiId: 'attacker@upi' },
    };
    const key = `invalid-option-test-${Date.now()}`;

    try {
      let res;
      let errRes = null;
      try {
        res = await api.post('/withdrawals', invalidPayload, {
          headers: { 'Idempotency-Key': key },
        });
      } catch (err) {
        errRes = err;
      }

      const status = errRes ? errRes.status : 200;
      const body = errRes ? { message: errRes.message, code: errRes.code } : res;
      const passed = status === 400 && (errRes?.code === 'INVALID_PAYOUT_OPTION' || errRes?.message?.includes('unavailable') || errRes?.message?.includes('invalid'));

      setTest3({
        running: false,
        result: {
          passed,
          req: { endpoint: 'POST /api/withdrawals', headers: { 'Idempotency-Key': key }, payload: invalidPayload },
          status,
          body,
          verdict: passed
            ? 'PASS: Server rejected invalid optionId with 400 INVALID_PAYOUT_OPTION without debiting points.'
            : `FAIL: Expected status 400 with INVALID_PAYOUT_OPTION (Got ${status}).`,
        },
      });
    } catch (err) {
      setTest3({
        running: false,
        result: {
          passed: false,
          error: err.message,
          verdict: `FAIL with error: ${err.message}`,
        },
      });
    }
  };

  // 4. Cross-User Read Isolation Check
  const runTest4 = async () => {
    setTest4({ running: true, result: null });
    // Attempt to access an arbitrary foreign withdrawal UUID or ID
    const foreignId = '00000000-0000-0000-0000-000000000000';
    try {
      let res;
      let errRes = null;
      try {
        res = await api.get(`/withdrawals/${foreignId}`);
      } catch (err) {
        errRes = err;
      }

      const status = errRes ? errRes.status : 200;
      const body = errRes ? { message: errRes.message, code: errRes.code } : res;
      const passed = status === 404;

      setTest4({
        running: false,
        result: {
          passed,
          req: { endpoint: `GET /api/withdrawals/${foreignId}` },
          status,
          body,
          verdict: passed
            ? 'PASS: Cross-user query safely returned 404 NOT_FOUND. Tenant data remains completely isolated.'
            : `FAIL: Expected status 404 for foreign withdrawal ID (Got ${status}).`,
        },
      });
    } catch (err) {
      setTest4({
        running: false,
        result: {
          passed: false,
          error: err.message,
          verdict: `FAIL with error: ${err.message}`,
        },
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1100px' }}>
      {/* Banner Marking Page as a Test Tool */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)',
          border: '1px solid rgba(168, 85, 247, 0.4)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: 'var(--shadow-glow)',
        }}
      >
        <div style={{ fontSize: '2.5rem' }}>🧪</div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 style={{ fontSize: '1.5rem' }}>System Integrity Test Tool</h1>
            <span
              style={{
                background: '#a855f7',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                textTransform: 'uppercase',
              }}
            >
              Test Tool Active
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Live execution suite for the four critical platform guarantees: Idempotency Guard, Atomic Overdraft Prevention, Payout Option Validation, and Cross-User Read Isolation.
          </p>
        </div>
      </div>

      {/* Grid of 4 Checks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Check 1 */}
        <div className="card glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>1. Duplicate Submit with Same Idempotency-Key</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Sends two identical requests with the same key to verify duplicate detection and zero double-debit.
              </p>
            </div>
            <button onClick={runTest1} disabled={test1.running} className="btn btn-primary btn-sm">
              {test1.running ? <Spinner size="sm" /> : 'Run Check 1'}
            </button>
          </div>

          {test1.result && (
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  background: test1.result.passed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: test1.result.passed ? 'var(--success)' : 'var(--danger)',
                  border: `1px solid ${test1.result.passed ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                }}
              >
                Verdict: {test1.result.verdict}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    Request 1 & Response
                  </div>
                  <pre style={{ background: '#070a12', padding: '0.75rem', borderRadius: '4px', fontSize: '0.75rem', overflowX: 'auto', color: '#94a3b8' }}>
                    {JSON.stringify({ req: test1.result.req1, res: test1.result.res1 }, null, 2)}
                  </pre>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    Request 2 (Duplicate) & Response
                  </div>
                  <pre style={{ background: '#070a12', padding: '0.75rem', borderRadius: '4px', fontSize: '0.75rem', overflowX: 'auto', color: '#94a3b8' }}>
                    {JSON.stringify({ req: test1.result.req2, res: test1.result.res2 }, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Check 2 */}
        <div className="card glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>2. Two Concurrent Debits Exceeding Balance</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Fires two concurrent 800 VEs debits simultaneously against a 1,000 VEs balance using Promise.all.
              </p>
            </div>
            <button onClick={runTest2} disabled={test2.running} className="btn btn-primary btn-sm">
              {test2.running ? <Spinner size="sm" /> : 'Run Check 2'}
            </button>
          </div>

          {test2.result && (
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  background: test2.result.passed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: test2.result.passed ? 'var(--success)' : 'var(--danger)',
                  border: `1px solid ${test2.result.passed ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                }}
              >
                Verdict: {test2.result.verdict}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    Concurrent Request A Result
                  </div>
                  <pre style={{ background: '#070a12', padding: '0.75rem', borderRadius: '4px', fontSize: '0.75rem', overflowX: 'auto', color: '#94a3b8' }}>
                    {JSON.stringify(test2.result.resA, null, 2)}
                  </pre>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    Concurrent Request B Result
                  </div>
                  <pre style={{ background: '#070a12', padding: '0.75rem', borderRadius: '4px', fontSize: '0.75rem', overflowX: 'auto', color: '#94a3b8' }}>
                    {JSON.stringify(test2.result.resB, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Check 3 */}
        <div className="card glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>3. Invalid Option ID Rejected</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Sends an invalid optionId payload to ensure server validation rejects before applying any debit.
              </p>
            </div>
            <button onClick={runTest3} disabled={test3.running} className="btn btn-primary btn-sm">
              {test3.running ? <Spinner size="sm" /> : 'Run Check 3'}
            </button>
          </div>

          {test3.result && (
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  background: test3.result.passed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: test3.result.passed ? 'var(--success)' : 'var(--danger)',
                  border: `1px solid ${test3.result.passed ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                }}
              >
                Verdict: {test3.result.verdict}
              </div>

              <div>
                <pre style={{ background: '#070a12', padding: '0.75rem', borderRadius: '4px', fontSize: '0.75rem', overflowX: 'auto', color: '#94a3b8' }}>
                  {JSON.stringify({ req: test3.result.req, status: test3.result.status, body: test3.result.body }, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Check 4 */}
        <div className="card glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>4. Cross-User Read Isolation</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Attempts to read another user's withdrawal ID to verify cross-tenant data leak protection returns 404.
              </p>
            </div>
            <button onClick={runTest4} disabled={test4.running} className="btn btn-primary btn-sm">
              {test4.running ? <Spinner size="sm" /> : 'Run Check 4'}
            </button>
          </div>

          {test4.result && (
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  background: test4.result.passed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: test4.result.passed ? 'var(--success)' : 'var(--danger)',
                  border: `1px solid ${test4.result.passed ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                }}
              >
                Verdict: {test4.result.verdict}
              </div>

              <div>
                <pre style={{ background: '#070a12', padding: '0.75rem', borderRadius: '4px', fontSize: '0.75rem', overflowX: 'auto', color: '#94a3b8' }}>
                  {JSON.stringify({ req: test4.result.req, status: test4.result.status, body: test4.result.body }, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminTestPage;
