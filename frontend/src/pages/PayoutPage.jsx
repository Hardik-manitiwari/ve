import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import api from '../api/client.js';
import PayoutMethodPicker from '../components/PayoutMethodPicker.jsx';
import OptionPicker from '../components/OptionPicker.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import Alert from '../components/Alert.jsx';
import Spinner from '../components/Spinner.jsx';

export const PayoutPage = () => {
  const { wallet, refreshWallet } = useAuth();
  const navigate = useNavigate();

  // Methods and options
  const [methods, setMethods] = useState([]);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [methodsError, setMethodsError] = useState(null);

  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [options, setOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState(null);
  const [methodConfig, setMethodConfig] = useState(null);

  const [selectedOption, setSelectedOption] = useState(null);
  const [formFields, setFormFields] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});

  // Confirmation and submission
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [successData, setSuccessData] = useState(null);

  // Idempotency key reference: preserved across retries for the same attempt
  const idempotencyKeyRef = useRef(null);

  // Load methods on mount
  useEffect(() => {
    const fetchMethods = async () => {
      try {
        setMethodsLoading(true);
        setMethodsError(null);
        const res = await api.get('/payout/methods');
        if (res?.data) {
          setMethods(res.data);
          // Auto-select first available method (e.g. UPI)
          const firstAvailable = res.data.find((m) => m.available);
          if (firstAvailable) {
            setSelectedMethodId(firstAvailable.id);
          }
        }
      } catch (err) {
        setMethodsError(err.message || 'Failed to load payout methods.');
      } finally {
        setMethodsLoading(false);
      }
    };

    fetchMethods();
  }, []);

  // Load options when selected method changes
  const fetchOptions = useCallback(async (methodId) => {
    if (!methodId) return;

    try {
      setOptionsLoading(true);
      setOptionsError(null);
      setSelectedOption(null);
      setFormFields({});
      setFieldErrors({});

      const res = await api.get(`/payout/options/${methodId}`);
      if (res?.data) {
        setOptions(res.data.options || []);
        setMethodConfig(res.data.method || null);
        // Pre-select first option if affordable
        if (res.data.options && res.data.options.length > 0) {
          const userVEs = wallet?.VEs || 0;
          const affordable = res.data.options.find((opt) => userVEs >= opt.requiredAmount);
          if (affordable) {
            setSelectedOption(affordable);
          } else {
            setSelectedOption(res.data.options[0]);
          }
        }
      }
    } catch (err) {
      setOptionsError(err.message || 'Failed to load payout options for this method.');
    } finally {
      setOptionsLoading(false);
    }
  }, [wallet?.VEs]);

  useEffect(() => {
    if (selectedMethodId) {
      fetchOptions(selectedMethodId);
    }
  }, [selectedMethodId, fetchOptions]);

  const handleFieldChange = (field, value) => {
    setFormFields((prev) => ({ ...prev, [field]: value }));
    // Clear validation error on change
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validateInputs = () => {
    const errors = {};
    const requiredFields = methodConfig?.requiredFields || [];

    for (const field of requiredFields) {
      const val = (formFields[field] || '').trim();
      if (!val) {
        errors[field] = 'This field is required';
        continue;
      }

      if (field === 'upiId') {
        const upiRegex = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;
        if (!upiRegex.test(val)) {
          errors[field] = 'Please enter a valid UPI ID (e.g., username@bank)';
        }
      }

      if (field === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(val)) {
          errors[field] = 'Please enter a valid email address';
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenConfirm = () => {
    setSubmitError(null);
    if (!selectedOption) {
      setSubmitError('Please select a payout denomination.');
      return;
    }

    if ((wallet?.VEs || 0) < selectedOption.requiredAmount) {
      setSubmitError('Insufficient VEs balance.');
      return;
    }

    if (!validateInputs()) {
      return;
    }

    // Generate or keep idempotency key for this redemption attempt
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID ? crypto.randomUUID() : `idem-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    }

    setModalOpen(true);
  };

  const handleConfirmRedeem = async () => {
    setSubmitting(true);
    setSubmitError(null);

    const idempotencyKey = idempotencyKeyRef.current;

    try {
      // Client strictly sends optionId and payoutDetails (any amount sent would be ignored by server)
      const res = await api.post(
        '/withdrawals',
        {
          optionId: selectedOption.optionId,
          payoutDetails: formFields,
        },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        }
      );

      // Successfully processed
      setSuccessData(res);
      setModalOpen(false);

      // Refresh wallet balances
      await refreshWallet();

      // Reset idempotency key for future new attempts
      idempotencyKeyRef.current = null;
    } catch (err) {
      // On error, show server message.
      // Notice: idempotencyKeyRef.current is preserved so retrying uses the EXACT same key!
      setSubmitError(err.message || 'Withdrawal request failed. You may retry safely.');
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Redeem Rewards</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Exchange verified VEs for real-time UPI transfers or digital vouchers.
        </p>
      </div>

      {/* Balance Indicator Banner */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-glass)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.75rem' }}>🟡</span>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Available Balance</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--ve-gold)' }}>
              {wallet?.VEs?.toLocaleString() ?? 0} VEs
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Server is the sole authority on balance verification
          </span>
        </div>
      </div>

      {/* Success View */}
      {successData && (
        <div className="card glass-panel" style={{ textAlign: 'center', padding: '3rem 2rem', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.75rem', color: 'var(--success)' }}>
            Withdrawal submitted successfully. Status: Pending
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
            Your request for <strong>₹{successData.data?.payoutValue} {successData.data?.payoutCurrency}</strong> via {successData.data?.method?.toUpperCase()} is registered on the ledger.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={() => {
                setSuccessData(null);
                setFormFields({});
              }}
              className="btn btn-secondary"
            >
              Redeem Another
            </button>
            <button
              onClick={() => navigate('/withdrawals')}
              className="btn btn-primary"
              id="view-withdrawals-btn"
            >
              View Withdrawal Status →
            </button>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {submitError && (
        <Alert type="danger" onClose={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}

      {!successData && (
        <>
          {/* Step 1: Select Method */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ background: 'var(--accent-primary)', width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>1</span>
              <span>Choose Payout Method</span>
            </h3>

            {methodsLoading ? (
              <div className="loading-container">
                <Spinner />
                <p>Loading payout methods...</p>
              </div>
            ) : methodsError ? (
              <Alert type="danger">{methodsError}</Alert>
            ) : methods.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                No payout methods available at this time.
              </div>
            ) : (
              <PayoutMethodPicker
                methods={methods}
                selectedMethodId={selectedMethodId}
                onSelectMethod={(methodId) => setSelectedMethodId(methodId)}
              />
            )}
          </div>

          {/* Step 2: Choose Denomination */}
          {selectedMethodId && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ background: 'var(--accent-primary)', width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>2</span>
                <span>Select Voucher / Denomination</span>
              </h3>

              {optionsLoading ? (
                <div className="loading-container">
                  <Spinner />
                  <p>Loading denomination tiers...</p>
                </div>
              ) : optionsError ? (
                <Alert type="danger">{optionsError}</Alert>
              ) : options.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  This payout method currently has no active options. Please choose another method.
                </div>
              ) : (
                <OptionPicker
                  options={options}
                  selectedOptionId={selectedOption?.optionId}
                  userBalance={wallet?.VEs || 0}
                  onSelectOption={(opt) => setSelectedOption(opt)}
                />
              )}
            </div>
          )}

          {/* Step 3: Required Recipient Fields */}
          {selectedOption && methodConfig && (
            <div className="card glass-panel" style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ background: 'var(--accent-primary)', width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>3</span>
                <span>Recipient Details</span>
              </h3>

              {methodConfig.requiredFields?.map((field) => (
                <div key={field} className="form-group">
                  <label className="form-label" htmlFor={field}>
                    {field === 'upiId' ? 'Virtual Payment Address (UPI ID)' : 'Recipient Email Address'}
                  </label>
                  <input
                    id={field}
                    type={field === 'email' ? 'email' : 'text'}
                    className="form-input"
                    placeholder={field === 'upiId' ? 'e.g. mobileNumber@upi or name@okaxis' : 'e.g. recipient@gmail.com'}
                    value={formFields[field] || ''}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    required
                  />
                  {fieldErrors[field] && (
                    <span style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                      {fieldErrors[field]}
                    </span>
                  )}
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                    {field === 'upiId'
                      ? 'Ensure your VPA is linked and active to receive immediate credited funds.'
                      : 'Digital redeem code will be dispatched to this verified address.'}
                  </span>
                </div>
              ))}

              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={handleOpenConfirm}
                  id="submit-payout-btn"
                  disabled={
                    submitting ||
                    !selectedOption ||
                    (wallet?.VEs || 0) < selectedOption.requiredAmount
                  }
                >
                  Proceed to Redeem ₹{selectedOption.payoutValue}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={modalOpen}
        title="Confirm Redemption"
        payoutValue={selectedOption?.payoutValue}
        payoutCurrency={selectedOption?.payoutCurrency}
        requiredAmount={selectedOption?.requiredAmount}
        currency={selectedOption?.currency}
        methodName={methodConfig?.name}
        recipientDetail={formFields.upiId || formFields.email}
        loading={submitting}
        onConfirm={handleConfirmRedeem}
        onCancel={() => setModalOpen(false)}
      />
    </div>
  );
};

export default PayoutPage;
