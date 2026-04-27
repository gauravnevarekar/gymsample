import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { buildMembershipFinancials, formatCurrency, formatDisplayDate } from '../lib/formatters';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
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
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [editingPayment, setEditingPayment] = useState(null);

  const fetchPayments = async () => {
    if (!currentUser) return;
    try {
      const paymentsRef = collection(db, 'gyms', currentUser.uid, 'payments');
      const snapshot = await getDocs(paymentsRef);
      const list = [];
      snapshot.forEach((paymentDoc) => {
        list.push({ id: paymentDoc.id, ...paymentDoc.data() });
      });
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      setPayments(list);
    } catch(err) {
      console.error(err);
    }
  };

  const fetchMembers = async () => {
    if (!currentUser) return;
    try {
      const membersRef = collection(db, 'gyms', currentUser.uid, 'members');
      const snapshot = await getDocs(membersRef);
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
          phone: data.phone,
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
    } catch(err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchPayments();
      fetchMembers();
    }
  }, [currentUser]);

  const selectedMember = members.find((member) => member.id === newPayment.memberId);
  const isMembershipPayment = newPayment.category === 'Membership';
  const membersWithPendingBalance = members.filter((member) => Number(member.balanceDue || 0) > 0);
  const memberPickerSource = isMembershipPayment ? membersWithPendingBalance : members;
  const filteredPickerMembers = memberPickerSource.filter((member) => {
    const query = memberSearchTerm.trim().toLowerCase();
    if (!query) return true;

    return [member.name, member.phone, member.planType, member.expiry_date]
      .some((value) => String(value || '').toLowerCase().includes(query));
  });

  const resetPaymentForm = () => {
    setShowAddModal(false);
    setNewPayment(createInitialPayment());
    setPaymentError('');
    setMemberSearchTerm('');
  };
  const handleAddPayment = async (e) => {
    e.preventDefault();
    try {
      const member = members.find((m) => m.id === newPayment.memberId);
      if (isMembershipPayment && !member) return;
      if (!isMembershipPayment && !newPayment.supplementName.trim()) return;
      setPaymentError('');
      console.log('--- handleAddPayment ---');
      console.log('newPayment.amount (raw):', newPayment.amount);
      console.log('newPayment.amount (as Number):', Number(newPayment.amount));
      console.log('member.balanceDue:', member?.balanceDue);

      const paymentSummary = isMembershipPayment
        ? `fee collection for ${member.name}`
        : `${newPayment.supplementName.trim()} x${Number(newPayment.quantity || 1)}`;

      if (isMembershipPayment && Number(member.balanceDue || 0) <= 0) {
        setPaymentError('This member has no pending balance. Use Renew from the members page for the next cycle.');
        return;
      }

      if (isMembershipPayment && Number(newPayment.amount || 0) > (Number(member.balanceDue || 0) + 0.01)) {
        setPaymentError('Amount given cannot be more than the remaining balance.');
        return;
      }

      const confirmed = window.confirm(
        `Confirm ${paymentSummary} for ${formatCurrency(newPayment.amount)}?`
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

      resetPaymentForm();
      await fetchPayments();
      if (isMembershipPayment) await fetchMembers();
    } catch (err) {
      console.error(err);
      setPaymentError('Failed to save payment.');
    }
  };

  const handleUpdatePayment = async (e) => {
    e.preventDefault();
    try {
      const member = members.find((m) => m.id === newPayment.memberId);
      if (isMembershipPayment && !member) return;
      if (!isMembershipPayment && !newPayment.supplementName.trim()) return;
      setPaymentError('');
      console.log('--- handleUpdatePayment ---');
      console.log('newPayment.amount (raw):', newPayment.amount);
      console.log('editingPayment.amount:', editingPayment.amount);
      console.log('diff:', Number(newPayment.amount) - Number(editingPayment.amount));

      const diff = Number(newPayment.amount) - Number(editingPayment.amount);

      if (isMembershipPayment && diff > (Number(member.balanceDue || 0) + 0.01)) {
        setPaymentError('Amount given cannot result in a negative balance.');
        return;
      }

      await updateDoc(doc(db, 'gyms', currentUser.uid, 'payments', editingPayment.id), {
        memberId: member?.id || null,
        member_name: member?.name || 'Supplement Sale',
        amount: Number(newPayment.amount),
        method: newPayment.method,
        category: newPayment.category,
        plan_type: isMembershipPayment ? member.planType : null,
        supplement_name: isMembershipPayment ? null : newPayment.supplementName.trim(),
        quantity: isMembershipPayment ? null : Number(newPayment.quantity || 1),
        balance_after: isMembershipPayment ? Math.max(Number(member.balanceDue || 0) - diff, 0) : null,
        date: editingPayment.date 
      });

      if (isMembershipPayment) {
        const updatedPaid = Number(member.amountPaid || 0) + diff;
        const financials = buildMembershipFinancials(member.planPrice, updatedPaid);

        await updateDoc(doc(db, 'gyms', currentUser.uid, 'members', member.id), {
          amountPaid: financials.amountPaid,
          balanceDue: financials.balanceDue,
          paymentStatus: financials.paymentStatus
        });
      }

      resetPaymentForm();
      setEditingPayment(null);
      await fetchPayments();
      if (isMembershipPayment) await fetchMembers();
    } catch (err) {
      console.error(err);
      setPaymentError('Failed to update payment.');
    }
  };

  const handleDeletePayment = async (p) => {
    if (!window.confirm(`Delete payment of ${formatCurrency(p.amount)}? This will revert the member's balance if it's a membership payment.`)) return;

    try {
      if (p.category === 'Membership' && p.memberId) {
        const member = members.find((m) => m.id === p.memberId);
        if (member) {
          const updatedPaid = Number(member.amountPaid || 0) - Number(p.amount || 0);
          const financials = buildMembershipFinancials(member.planPrice, updatedPaid);

          await updateDoc(doc(db, 'gyms', currentUser.uid, 'members', member.id), {
            amountPaid: financials.amountPaid,
            balanceDue: financials.balanceDue,
            paymentStatus: financials.paymentStatus
          });
        }
      }

      await deleteDoc(doc(db, 'gyms', currentUser.uid, 'payments', p.id));
      await fetchPayments();
      if (p.category === 'Membership') await fetchMembers();
    } catch (err) {
      console.error(err);
      alert('Failed to delete payment.');
    }
  };

  const startEdit = (p) => {
    setEditingPayment(p);
    setNewPayment({
      category: p.category || 'Membership',
      memberId: p.memberId || '',
      amount: p.amount.toString(),
      method: p.method,
      supplementName: p.supplement_name || '',
      quantity: (p.quantity || 1).toString()
    });
    setMemberSearchTerm(p.member_name === 'Supplement Sale' ? '' : p.member_name);
    setShowAddModal(true);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-10 gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-black headline-font italic uppercase tracking-tighter text-white leading-tight">Payments</h1>
          <p className="text-xs md:text-base text-zinc-500 font-medium mt-0.5">Collect partial balances and record supplement revenues</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddModal(true)}
            className="w-full md:w-auto bg-primary hover:bg-primary-dim text-on-primary px-6 py-3.5 md:py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(253,139,0,0.3)] transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">add</span> Receive Payment
          </motion.button>
        </div>
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
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none text-right">Actions</th>
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
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => startEdit(p)}
                            className="p-2 text-zinc-500 hover:text-white transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeletePayment(p)}
                            className="p-2 text-zinc-500 hover:text-error transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      </td>
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
                className="bg-surface-container-low/50 backdrop-blur-xl rounded-2xl border border-outline-variant/10 p-4 shadow-lg flex flex-col gap-3.5"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <h3 className="text-[17px] font-black text-white truncate">{p.member_name}</h3>
                    <p className="text-[11px] text-zinc-400 font-bold mt-0.5">{formatDisplayDate(p.date)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-primary font-black text-[18px]">{formatCurrency(p.amount)}</span>
                    <p className="text-[10px] font-black text-tertiary uppercase tracking-widest mt-0.5">{p.method}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-white/5 border border-white/10 text-zinc-300 px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider">{p.category || 'Membership'}</span>
                  {p.plan_type && <span className="bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider">{p.plan_type}</span>}
                  {p.supplement_name && <span className="bg-tertiary/10 border border-tertiary/20 text-tertiary px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider">{p.supplement_name}{p.quantity ? ` x${p.quantity}` : ''}</span>}
                  {p.payment_phase && <span className="bg-zinc-800 border border-white/5 text-zinc-400 px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider">{p.payment_phase}</span>}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    onClick={() => startEdit(p)}
                    className="p-3 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-white/10 flex items-center justify-center gap-2 font-bold text-xs uppercase"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span> Edit
                  </button>
                  <button
                    onClick={() => handleDeletePayment(p)}
                    className="p-3 bg-error/10 text-error hover:bg-error hover:text-white rounded-xl transition-all border border-error/20 flex items-center justify-center gap-2 font-bold text-xs uppercase"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span> Delete
                  </button>
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
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] overflow-y-auto p-4 py-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-surface-container-highest p-5 md:p-8 rounded-2xl w-full max-w-md max-h-[calc(100vh-3rem)] overflow-y-auto border border-white/5 shadow-2xl relative"
            >
              <div className="absolute top-0 right-0 p-3">
                <button onClick={resetPaymentForm} className="text-zinc-500 hover:text-white p-2 flex"><span className="material-symbols-outlined">close</span></button>
              </div>

              <h2 className="text-xl md:text-2xl font-black headline-font italic mb-2 text-white uppercase">{editingPayment ? 'Edit Payment' : 'Record Payment'}</h2>
              <p className="text-xs text-zinc-500 mb-6 uppercase tracking-widest font-bold">{editingPayment ? 'Modify existing payment details.' : 'Record a new revenue entry.'}</p>

              <form onSubmit={editingPayment ? handleUpdatePayment : handleAddPayment} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Payment Type</label>
                  <select
                    value={newPayment.category}
                    onChange={(e) => {
                      setNewPayment({
                        ...createInitialPayment(),
                        category: e.target.value,
                        method: newPayment.method
                      });
                      setMemberSearchTerm('');
                    }}
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all"
                  >
                    <option value="Membership">Membership</option>
                    <option value="Supplement">Supplement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Select Member</label>
                  <div className="relative">
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">search</span>
                      <input
                        value={memberSearchTerm}
                        onChange={(e) => {
                          setMemberSearchTerm(e.target.value);
                          if (!e.target.value) setNewPayment({ ...newPayment, memberId: '' });
                        }}
                        placeholder={isMembershipPayment ? 'Search pending members...' : 'Search members...'}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-3.5 pl-10 pr-3 text-sm text-white outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary shadow-inner"
                      />
                      {newPayment.memberId && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                          <span className="bg-primary/20 text-primary text-[9px] font-black uppercase px-2 py-0.5 rounded border border-primary/20">Selected</span>
                          <button 
                            type="button"
                            onClick={() => {
                              setNewPayment({ ...newPayment, memberId: '' });
                              setMemberSearchTerm('');
                            }}
                            className="text-zinc-500 hover:text-white"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Autocomplete Dropdown */}
                    {memberSearchTerm && !newPayment.memberId && (
                      <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
                        {!isMembershipPayment && !memberSearchTerm && (
                          <button
                            type="button"
                            onClick={() => {
                              setNewPayment({ ...newPayment, memberId: '' });
                              setMemberSearchTerm('');
                            }}
                            className="flex w-full items-center justify-between border-b border-white/5 px-4 py-3 text-left text-sm text-zinc-300 hover:bg-white/5"
                          >
                            <span>No member linked</span>
                          </button>
                        )}

                        {filteredPickerMembers.length === 0 ? (
                          <div className="px-4 py-4 text-sm text-zinc-500 italic">No members found matching "{memberSearchTerm}"</div>
                        ) : (
                          filteredPickerMembers.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setNewPayment({ ...newPayment, memberId: m.id });
                                setMemberSearchTerm(m.name);
                              }}
                              className="flex w-full flex-col border-b border-white/5 px-4 py-3 text-left transition-colors hover:bg-primary/10 group last:border-b-0"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-white group-hover:text-primary transition-colors">{m.name}</span>
                                {isMembershipPayment && <span className="text-[10px] font-black text-primary">₹{Number(m.balanceDue || 0).toLocaleString()} DUE</span>}
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500">
                                <span>{m.phone}</span>
                                <span>{m.planType} • Exp: {formatDisplayDate(m.expiry_date)}</span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  
                  {isMembershipPayment && (
                    <p className="mt-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest leading-relaxed">
                      Only members with pending balance appear here. For a new cycle, use 'Renew' on the Members page.
                    </p>
                  )}
                </div>

                {isMembershipPayment ? null : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={newPayment.amount}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      setNewPayment({ ...newPayment, amount: val });
                    }}
                    placeholder="0.00"
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all"
                  />
                </div>

                {selectedMember && isMembershipPayment && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div className="pt-4 pb-20">
                  <button type="submit" className="w-full py-4 bg-primary text-zinc-950 font-black uppercase tracking-widest text-sm rounded-xl hover:bg-primary-dim shadow-[0_0_20px_rgba(253,139,0,0.2)] transition-all">
                    {editingPayment ? 'Update Payment' : 'Confirm Payment'}
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
