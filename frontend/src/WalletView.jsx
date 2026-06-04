import React, { useState, useEffect } from 'react';

const WalletView = ({ role = 'user' }) => {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const itemsPerPage = 8;

  const toggleDetails = (id) => {
    setExpandedOrders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    fetchWallet();
  }, [role]);

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const endpoint = role === 'admin' ? 'http://localhost:5070/api/admin/wallet/details' : 'http://localhost:5070/api/user/wallet/details';
      const response = await fetch(endpoint, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setWallet(data);
      }
    } catch (err) {
      console.error("Failed to fetch wallet:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTopup = async () => {
    if (!topupAmount || topupAmount <= 0) return;
    try {
      // 1. Create Order on Backend for Razorpay amount
      const rzpOrderResp = await fetch('http://localhost:5070/api/user/wallet/create-razorpay-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(topupAmount) }),
        credentials: 'include'
      });
      if (!rzpOrderResp.ok) throw new Error("Failed to create razorpay order");
      
      const { orderId } = await rzpOrderResp.json();
      
      // 2. Open Razorpay Checkout
      const options = {
        key: "rzp_test_SwdCmzSaHtuMRq", // Matching backend key
        amount: parseFloat(topupAmount) * 100, // amount in paisa
        currency: "INR",
        name: "DineDrop Wallet",
        description: "Add funds to wallet",
        order_id: orderId,
        handler: async function (response) {
          // 3. Verify Payment on Backend
          const verifyResp = await fetch('http://localhost:5070/api/user/wallet/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: parseFloat(topupAmount),
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature
            }),
            credentials: 'include'
          });
          if (verifyResp.ok) {
            alert('Payment Successful! Funds added to wallet.');
            setTopupAmount('');
            setShowTopupModal(false);
            fetchWallet();
          } else {
            alert('Payment verification failed.');
          }
        },
        theme: { color: "#00f3ff" }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (e) {
      console.error(e);
      alert('Error initiating payment. Please make sure the Razorpay script is loaded.');
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || withdrawAmount <= 0) return;
    try {
      const response = await fetch('http://localhost:5070/api/user/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(withdrawAmount) }),
        credentials: 'include'
      });
      if (response.ok) {
        alert(`Successfully withdrew ₹${withdrawAmount} to Bank Account!`);
        setWithdrawAmount('');
        setShowWithdrawModal(false);
        fetchWallet();
      } else {
        const err = await response.json();
        alert('Failed to withdraw: ' + (err.message || 'Unknown error'));
      }
    } catch (e) {
      console.error(e);
      alert('Error initiating withdrawal.');
    }
  };

  if (loading) {
    return <div style={{ color: '#fff' }}>Loading Wallet...</div>;
  }

  if (!wallet) {
    return <div style={{ color: '#ff4d4d' }}>Failed to load wallet.</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', color: '#fff' }}>
      <div style={{ background: 'linear-gradient(135deg, rgba(0, 243, 255, 0.1), rgba(0, 243, 255, 0.05))', border: '1px solid rgba(0, 243, 255, 0.2)', padding: '40px', borderRadius: '24px', textAlign: 'center', marginBottom: '30px', position: 'relative' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', color: '#00f3ff', letterSpacing: '2px', textTransform: 'uppercase' }}>Available Balance</h2>
        <h1 style={{ margin: '10px 0 0', fontSize: '3.5rem', fontWeight: '900', color: '#fff' }}>₹{wallet.balance.toFixed(2)}</h1>
        <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setShowWithdrawModal(true)}
            style={{ padding: '10px 20px', background: 'transparent', color: '#ff4d4d', border: '1px solid rgba(255,77,77,0.3)', borderRadius: '12px', fontWeight: '800', cursor: 'pointer' }}
          >
            - Withdraw
          </button>
          <button 
            onClick={() => setShowTopupModal(true)}
            style={{ padding: '10px 20px', background: '#00f3ff', color: '#000', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer' }}
          >
            + Top Up
          </button>
        </div>
      </div>

      <h3 style={{ fontSize: '1.2rem', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>Transaction History</h3>
      
      {(() => {
        let displayHistory = wallet.history || [];
        
        if (role === 'admin' && displayHistory.length > 0) {
          const grouped = {};
          const others = [];
          
          displayHistory.forEach(entry => {
            if (entry.orderId) {
              if (!grouped[entry.orderId]) {
                grouped[entry.orderId] = {
                  id: entry.orderId,
                  orderId: entry.orderId,
                  createdAt: entry.createdAt,
                  totalCollected: 0,
                  restaurantPayout: 0,
                  driverPayout: 0,
                  netPlatform: 0
                };
              }
              
              if (entry.description.includes('Collected amount') || entry.description.includes('Remitted COD')) {
                grouped[entry.orderId].totalCollected += entry.amount;
                grouped[entry.orderId].netPlatform += entry.amount;
              } else if (entry.description.includes('Payout to Driver')) {
                grouped[entry.orderId].driverPayout += entry.amount;
                grouped[entry.orderId].netPlatform -= entry.amount;
              } else if (entry.description.includes('Payout to Restaurant')) {
                grouped[entry.orderId].restaurantPayout += entry.amount;
                grouped[entry.orderId].netPlatform -= entry.amount;
              } else {
                 if (entry.type === 'Credit') grouped[entry.orderId].netPlatform += entry.amount;
                 else grouped[entry.orderId].netPlatform -= entry.amount;
              }
            } else {
              others.push(entry);
            }
          });

          const groupedArray = Object.values(grouped).map(g => ({
            ...g,
            isGrouped: true,
            netAmount: g.netPlatform,
            description: `Platform Earnings for Order #${g.orderId.substring(0, 8)}`
          }));

          displayHistory = [...groupedArray, ...others].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        const Pagination = ({ currentPage, totalPages, onPageChange }) => {
          if (totalPages <= 1) return null;
          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: '#888', fontSize: '0.9rem' }}>
                Showing page <strong style={{ color: '#fff' }}>{currentPage}</strong> of <strong style={{ color: '#fff' }}>{totalPages}</strong>
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => onPageChange(currentPage - 1)} 
                  disabled={currentPage === 1}
                  style={{ padding: '8px 16px', borderRadius: '12px', background: currentPage === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)', color: currentPage === 1 ? '#666' : '#fff', border: 'none', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '0.9rem', transition: 'all 0.2s' }}
                >
                  Prev
                </button>
                {(() => { let pages = []; if (totalPages <= 3) pages = Array.from({ length: totalPages }, (_, i) => i + 1); else if (currentPage === 1) pages = [1, 2, 3]; else if (currentPage === totalPages) pages = [totalPages - 2, totalPages - 1, totalPages]; else pages = [currentPage - 1, currentPage, currentPage + 1]; return pages; })().map(p => (
                  <button 
                    key={p}
                    onClick={() => onPageChange(p)}
                    style={{ width: '38px', height: '38px', borderRadius: '12px', background: currentPage === p ? '#00f3ff' : 'rgba(255,255,255,0.03)', color: currentPage === p ? '#000' : '#fff', border: currentPage === p ? 'none' : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontWeight: '800', fontSize: '0.9rem', transition: 'all 0.2s' }}
                  >
                    {p}
                  </button>
                ))}
                <button 
                  onClick={() => onPageChange(currentPage + 1)} 
                  disabled={currentPage === totalPages}
                  style={{ padding: '8px 16px', borderRadius: '12px', background: currentPage === totalPages ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)', color: currentPage === totalPages ? '#666' : '#fff', border: 'none', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '0.9rem', transition: 'all 0.2s' }}
                >
                  Next
                </button>
              </div>
            </div>
          );
        };

        const totalPages = Math.ceil(displayHistory.length / itemsPerPage);
        const paginatedHistory = displayHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

        return (
          <>
            {displayHistory && displayHistory.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {paginatedHistory.map(entry => {
            const isDebit = entry.type === 'Debit' || entry.netAmount < 0;
            const amount = entry.netAmount !== undefined ? entry.netAmount : (entry.type === 'Debit' ? -entry.amount : entry.amount);
            
            return (
              <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div>
                  <p style={{ margin: '0 0 5px', fontWeight: '700', fontSize: '1rem' }}>{entry.description || entry.type}</p>
                  <p style={{ margin: 0, color: '#aaa', fontSize: '0.8rem' }}>{new Date(entry.createdAt).toLocaleString()}</p>
                  
                  {entry.isGrouped && (
                    <div style={{ marginTop: '10px' }}>
                      <button 
                        onClick={() => toggleDetails(entry.id)}
                        style={{ background: 'transparent', border: '1px solid #00f3ff', color: '#00f3ff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        {expandedOrders[entry.id] ? 'Hide Details' : 'View Details'}
                      </button>
                      
                      {expandedOrders[entry.id] && (
                        <div style={{ marginTop: '15px', padding: '20px', background: '#121212', borderRadius: '12px', fontSize: '0.9rem', border: '1px solid rgba(255,255,255,0.05)', minWidth: '300px' }}>
                          <p style={{ margin: '0 0 15px', color: '#888', fontWeight: 'bold', fontSize: '0.8rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Revenue Breakdown</p>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc' }}>
                              <span>Total Collection</span>
                              <span>₹{entry.totalCollected.toFixed(2)}</span>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc' }}>
                              <span>Driver earns</span>
                              <span>-₹{entry.driverPayout.toFixed(2)}</span>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc' }}>
                              <span>Restaurant earns</span>
                              <span>-₹{entry.restaurantPayout.toFixed(2)}</span>
                            </div>
                            
                            <div style={{ borderTop: '1px solid #333', margin: '5px 0' }}></div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
                              <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '1rem' }}>Platform Earnings</span>
                              <span style={{ fontWeight: 'bold', color: '#00f3ff', fontSize: '1rem' }}>₹{entry.netAmount.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!entry.isGrouped && entry.orderId && <p style={{ margin: '5px 0 0', color: '#00f3ff', fontSize: '0.75rem' }}>Order ID: {entry.orderId.substring(0, 8)}...</p>}
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: amount >= 0 ? '#2ecc71' : '#ff4d4d' }}>
                    {amount >= 0 ? '+' : ''}₹{Math.abs(amount).toFixed(2)}
                  </div>
                  {entry.isGrouped && <div style={{ fontSize: '0.75rem', color: '#00f3ff', marginTop: '4px' }}>Net Profit</div>}
                </div>
              </div>
            );
          })}
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      ) : (
        <p style={{ color: '#aaa', textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>No transactions yet.</p>
            )}
          </>
        );
      })()}

      {/* Topup Modal */}
      {showTopupModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: '#121212', padding: '30px', borderRadius: '20px', minWidth: '350px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '1.4rem' }}>Top Up Wallet</h3>
            <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '10px' }}>Enter amount to add via Razorpay (Test Mode)</p>
            <input 
              type="number" 
              placeholder="Amount (₹)"
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '1.2rem', marginBottom: '20px' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={handleTopup}
                style={{ flex: 1, padding: '12px', background: '#00f3ff', color: '#000', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}
              >
                Proceed to Pay
              </button>
              <button 
                onClick={() => setShowTopupModal(false)}
                style={{ padding: '12px 20px', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: '#121212', padding: '30px', borderRadius: '20px', minWidth: '350px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '1.4rem' }}>Withdraw Funds</h3>
            <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '10px' }}>Enter amount to withdraw to linked Bank Account</p>
            <input 
              type="number" 
              placeholder="Amount (₹)"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '1.2rem', marginBottom: '20px' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={handleWithdraw}
                style={{ flex: 1, padding: '12px', background: '#ff4d4d', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}
              >
                Confirm Withdrawal
              </button>
              <button 
                onClick={() => setShowWithdrawModal(false)}
                style={{ padding: '12px 20px', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletView;
