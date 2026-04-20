import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { buildMembershipFinancials, formatCurrency, formatDisplayDate } from '../lib/formatters';
import { collection, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

function createInitialPayment() {
  return {
    category: 'Membership',
    memberId: '',
    amount: '',
    method: 'Cash',
    supplementName: '',
    quantity: '1'
  };
}

export default function Payments() {
  const { currentUser } = useAuth();
  const [payments, setPayments] = useState([]);
  const [members, setMembers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPayment, setNewPayment] = useState(createInitialPayment());
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    if (!currentUser) return;

    const paymentsRef = collection(db, 'gyms', currentUser.uid, 'payments');
    const unsubscribePayments = onSnapshot(paymentsRef, (snapshot) => {
      const list = [];
      snapshot.forEach((paymentDoc) => {
        list.push({ id: paymentDoc.id, ...paymentDoc.data() });
      });
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      setPayments(list);
    });

    const membersRef = collection(db, 'gyms', currentUser.uid, 'members');
    const unsubscribeMembers = onSnapshot(membersRef, (snapshot) => {
      const mList = [];
      snapshot.forEach((memberDoc) => {
        const data = memberDoc.data();
        const financials = buildMembershipFinancials(
          data.planPrice,
          data.amountPaid ?? data.planPrice ?? 0
        );
        mList.push({
          id: memberDoc.id,
          name: data.name,
          expiry_date: data.expiry_date,
          planType: data.planType || data.plan || 'Monthly',
          planDuration: Number(data.planDuration || 30),
          planPrice: data.planPrice || '',
          amountPaid: data.amountPaid ?? financials.amountPaid,
          balanceDue: data.balanceDue ?? financials.balanceDue,
          paymentStatus: data.paymentStatus || financials.paymentStatus
        });
      });
      setMembers(mList);
    });

    return () => {
      unsubscribePayments();
      unsubscribeMembers();
    };
  }, [currentUser]);

  const selectedMember = members.find((member) => member.id === newPayment.memberId);
  const isMembershipPayment = newPayment.category === 'Membership';

  const handleAddPayment = async (e) => {
    e.preventDefault();
    try {
      const member = members.find((m) => m.id === newPayment.memberId);

      if (isMembershipPayment && !member) return;
      if (!isMembershipPayment && !newPayment.supplementName.trim()) return;
      setPaymentError('');

      const paymentSummary = isMembershipPayment
        ? `fee collection for ${member.name}`
        : `${newPayment.supplementName.trim()} x${Number(newPayment.quantity || 1)}`;

      if (isMembershipPayment && Number(member.balanceDue || 0) <= 0) {
        setPaymentError('This member has no pending balance. Use Renew from the members page for the next cycle.');
        return;
      }

      if (isMembershipPayment && Number(newPayment.amount || 0) > Number(member.balanceDue || 0)) {
        setPaymentError('Amount given cannot be more than the remaining balance.');
        return;
      }

      const confirmed = window.confirm(
        `Confirm ${paymentSummary} for ${formatCurrency(newPayment.amount)}? Payments are locked after saving for transparency.`
      );

      if (!confirmed) return;

      await addDoc(collection(db, 'gyms', currentUser.uid, 'payments'), {
        memberId: member?.id || null,
        member_name: member?.name || 'Supplement Sale',
        amount: Number(newPayment.amount),
        method: newPayment.method,
        category: newPayment.category,
        plan_type: isMembershipPayment ? member.planType : null,
        supplement_name: isMembershipPayment ? null : newPayment.supplementName.trim(),
        quantity: isMembershipPayment ? null : Number(newPayment.quantity || 1),
        immutable: true,
        balance_after: isMembershipPayment ? Math.max(Number(member.balanceDue || 0) - Number(newPayment.amount || 0), 0) : null,
        payment_phase: isMembershipPayment ? 'Balance Collection' : null,
        date: new Date().toISOString()
      });

      if (isMembershipPayment) {
        const updatedPaid = Number(member.amountPaid || 0) + Number(newPayment.amount || 0);
        const financials = buildMembershipFinancials(member.planPrice, updatedPaid);

        await updateDoc(doc(db, 'gyms', currentUser.uid, 'members', member.id), {
          amountPaid: financials.amountPaid,
          balanceDue: financials.balanceDue,
          paymentStatus: financials.paymentStatus
        });
      }

      setShowAddModal(false);
      setNewPayment(createInitialPayment());
      setPaymentError('');
    } catch (err) {
      console.error(err);
      setPaymentError('Failed to save payment.');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 md:mb-10 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black headline-font uppercase italic tracking-tighter text-white">Payments</h1>
          <p className="text-sm md:text-base text-zinc-500 font-medium mt-1">Record membership and supplement revenues</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddModal(true)}
          className="w-full md:w-auto bg-primary hover:bg-primary-dim text-on-primary px-6 py-3.5 md:py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(253,139,0,0.3)] transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">add</span> Receive Payment
        </motion.button>
      </div>

      <div className="mb-6 rounded-2xl border border-white/5 bg-surface-container-low/50 px-4 py-4 text-sm text-zinc-400">
        Payments are locked after confirmation. This keeps the ledger transparent and prevents silent edits.
      </div>

      <div className="hidden md:block bg-surface-container-low/50 backdrop-blur-xl rounded-2xl border border-outline-variant/10 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container/50 border-b border-outline-variant/10">
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Date</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Member</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Details</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none text-center">Method</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {payments.length === 0 ? (
                <tr><td colSpan="5" className="py-12 text-center text-zinc-500 font-medium">No payments found.</td></tr>
              ) : (
                <AnimatePresence>
                  {payments.map((p) => (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={p.id}
                      className="hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="py-4 px-6 text-sm font-medium text-zinc-400">{formatDisplayDate(p.date)}</td>
                      <td className="py-4 px-6 font-bold text-white">{p.member_name}</td>
                      <td className="py-4 px-6 text-xs font-bold text-zinc-400">
                        <div className="flex flex-wrap gap-2">
                          <span className="border border-white/10 px-2 py-1 rounded bg-black/20">{p.category || 'Membership'}</span>
                          {p.plan_type && <span className="border border-primary/20 px-2 py-1 rounded bg-primary/10 text-primary">{p.plan_type}</span>}
                          {p.supplement_name && <span className="border border-tertiary/20 px-2 py-1 rounded bg-tertiary/10 text-tertiary">{p.supplement_name}{p.quantity ? ` x${p.quantity}` : ''}</span>}
                          {p.payment_phase && <span className="border border-white/10 px-2 py-1 rounded bg-white/5">{p.payment_phase}</span>}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="bg-tertiary/10 border border-tertiary/20 text-tertiary px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest">{p.method}</span>
                      </td>
                      <td className="py-4 px-6 text-sm font-black text-primary text-right">{formatCurrency(p.amount)}</td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="md:hidden space-y-4">
        {payments.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 font-medium">No payments found.</div>
        ) : (
          <AnimatePresence>
            {payments.map((p) => (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                key={p.id}
                className="bg-surface-container-low/50 backdrop-blur-xl rounded-2xl border border-outline-variant/10 p-5 shadow-lg flex flex-col gap-3"
              >
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="text-lg font-black text-white">{p.member_name}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{formatDisplayDate(p.date)}</p>
                  </div>
                  <span className="text-primary font-black text-lg">{formatCurrency(p.amount)}</span>
                </div>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="bg-white/10 border border-white/20 text-white px-2 py-1 rounded text-[10px] font-bold tracking-wider">{p.category || 'Membership'}</span>
                  {p.plan_type && <span className="bg-primary/10 border border-primary/20 text-primary px-2 py-1 rounded text-[10px] font-bold tracking-wider">{p.plan_type}</span>}
                  {p.supplement_name && <span className="bg-tertiary/10 border border-tertiary/20 text-tertiary px-2 py-1 rounded text-[10px] font-bold tracking-wider">{p.supplement_name}{p.quantity ? ` x${p.quantity}` : ''}</span>}
                  {p.payment_phase && <span className="bg-white/5 border border-white/10 text-zinc-300 px-2 py-1 rounded text-[10px] font-bold tracking-wider">{p.payment_phase}</span>}
                  <span className="bg-tertiary/10 border border-tertiary/20 text-tertiary px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">{p.method}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-surface-container-highest p-6 md:p-8 rounded-2xl w-full max-w-md border border-white/5 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-3">
                <button onClick={() => {
                  setShowAddModal(false);
                  setNewPayment(createInitialPayment());
                  setPaymentError('');
                }} className="text-zinc-500 hover:text-white p-2 flex"><span className="material-symbols-outlined">close</span></button>
              </div>

              <h2 className="text-xl md:text-2xl font-black headline-font italic mb-2 text-white uppercase">Record Payment</h2>
              <p className="text-xs text-zinc-500 mb-6 uppercase tracking-widest font-bold">Payments are immutable after confirmation.</p>

              <form onSubmit={handleAddPayment} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Payment Type</label>
                  <select
                    value={newPayment.category}
                    onChange={(e) => setNewPayment({
                      ...createInitialPayment(),
                      category: e.target.value,
                      method: newPayment.method
                    })}
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all"
                  >
                    <option value="Membership">Membership</option>
                    <option value="Supplement">Supplement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Select Member</label>
                  <select
                    required={isMembershipPayment}
                    value={newPayment.memberId}
                    onChange={(e) => {
                      setNewPayment({
                        ...newPayment,
                        memberId: e.target.value
                      });
                    }}
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all"
                  >
                    <option value="" disabled>{isMembershipPayment ? 'Choose a member...' : 'Optional member linkage'}</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>

                {isMembershipPayment ? null : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Supplement</label>
                      <input required value={newPayment.supplementName} onChange={(e) => setNewPayment({ ...newPayment, supplementName: e.target.value })} placeholder="Protein, creatine..." className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Quantity</label>
                      <input type="number" min="1" required value={newPayment.quantity} onChange={(e) => setNewPayment({ ...newPayment, quantity: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Amount Given (Rs)</label>
                  <input type="number" min="0" required value={newPayment.amount} onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                </div>

                {selectedMember && isMembershipPayment && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-white/5 bg-zinc-950/60 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Current Plan</p>
                      <p className="mt-1 text-sm font-bold text-white">{selectedMember.planType}</p>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-zinc-950/60 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Expiry</p>
                      <p className="mt-1 text-sm font-bold text-white">{formatDisplayDate(selectedMember.expiry_date)}</p>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-zinc-950/60 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Plan Fee</p>
                      <p className="mt-1 text-sm font-bold text-white">{formatCurrency(selectedMember.planPrice)}</p>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-zinc-950/60 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Balance Due</p>
                      <p className="mt-1 text-sm font-bold text-white">{formatCurrency(selectedMember.balanceDue)}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Payment Method</label>
                  <select value={newPayment.method} onChange={(e) => setNewPayment({ ...newPayment, method: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all">
                    <option>Cash</option>
                    <option>UPI</option>
                    <option>Card</option>
                  </select>
                </div>

                {paymentError && <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">{paymentError}</div>}

                <div className="pt-4 pb-2">
                  <button type="submit" className="w-full py-4 bg-primary text-zinc-950 font-black uppercase tracking-widest text-sm rounded-xl hover:bg-primary-dim shadow-[0_0_20px_rgba(253,139,0,0.2)] transition-all">
                    Confirm Payment
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
