import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

const PLAN_OPTIONS = {
  Monthly: { durationDays: 30, label: '30 Days' },
  Quarterly: { durationDays: 90, label: '90 Days' },
  Yearly: { durationDays: 365, label: '365 Days' }
};

function createInitialFormData() {
  return {
    name: '',
    phone: '',
    gender: '',
    age: '',
    planType: 'Monthly',
    planPrice: '',
    planDuration: PLAN_OPTIONS.Monthly.durationDays,
    joinDate: new Date().toISOString().split('T')[0]
  };
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function calculateExpiryDate(joinDate, planDuration) {
  if (!joinDate || !planDuration) return '';

  const expiryDate = new Date(joinDate);
  expiryDate.setDate(expiryDate.getDate() + Number(planDuration));
  return expiryDate.toISOString().split('T')[0];
}

export default function Members() {
  const { currentUser } = useAuth();
  const { memberSearch } = useOutletContext();
  const [members, setMembers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState(createInitialFormData());
  const [renewingMember, setRenewingMember] = useState(null);
  const [renewalData, setRenewalData] = useState({ amount: '', method: 'Cash' });

  useEffect(() => {
    if (!currentUser) return;
    const membersRef = collection(db, 'gyms', currentUser.uid, 'members');
    const unsubscribe = onSnapshot(membersRef, (snapshot) => {
      const list = [];
      snapshot.forEach((memberDoc) => {
        list.push({ id: memberDoc.id, ...memberDoc.data() });
      });
      list.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
      setMembers(list);
    });
    return unsubscribe;
  }, [currentUser]);

  const computedExpiryDate = calculateExpiryDate(formData.joinDate, formData.planDuration);

  function closeModal() {
    setShowAddModal(false);
    setEditingId(null);
    setFormError('');
    setFormData(createInitialFormData());
  }

  function closeRenewModal() {
    setShowRenewModal(false);
    setRenewingMember(null);
    setRenewalData({ amount: '', method: 'Cash' });
  }

  function handlePlanTypeChange(value) {
    setFormData((current) => ({
      ...current,
      planType: value,
      planDuration: PLAN_OPTIONS[value].durationDays
    }));
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setFormError('');

      const normalizedPhone = normalizePhone(formData.phone);
      const duplicatePhone = members.find((member) => (
        member.id !== editingId && normalizePhone(member.phone) === normalizedPhone
      ));

      if (duplicatePhone) {
        setFormError('Phone number must be unique.');
        return;
      }

      const payload = {
        name: formData.name.trim(),
        phone: normalizedPhone,
        gender: formData.gender || '',
        age: formData.age ? Number(formData.age) : null,
        plan: formData.planType,
        planType: formData.planType,
        planPrice: Number(formData.planPrice),
        planDuration: Number(formData.planDuration),
        join_date: formData.joinDate,
        expiry_date: calculateExpiryDate(formData.joinDate, formData.planDuration)
      };

      if (editingId) {
        await updateDoc(doc(db, 'gyms', currentUser.uid, 'members', editingId), payload);
      } else {
        await addDoc(collection(db, 'gyms', currentUser.uid, 'members'), {
          ...payload,
          created_at: new Date().toISOString()
        });
      }

      closeModal();
    } catch (err) {
      console.error(err);
      setFormError('Failed to save member.');
    }
  };

  const openEdit = (member) => {
    const existingPlanType = member.planType || member.plan || 'Monthly';
    const fallbackPlan = PLAN_OPTIONS[existingPlanType] || PLAN_OPTIONS.Monthly;

    setEditingId(member.id);
    setFormError('');
    setFormData({
      name: member.name,
      phone: member.phone || '',
      gender: member.gender || '',
      age: member.age ?? '',
      planType: existingPlanType,
      planPrice: member.planPrice ?? '',
      planDuration: Number(member.planDuration || fallbackPlan.durationDays),
      joinDate: member.join_date || new Date().toISOString().split('T')[0]
    });
    setShowAddModal(true);
  };

  const openRenewModal = (member) => {
    setRenewingMember(member);
    setRenewalData({
      amount: member.planPrice ? String(member.planPrice) : '',
      method: 'Cash'
    });
    setShowRenewModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this member?')) {
      await deleteDoc(doc(db, 'gyms', currentUser.uid, 'members', id));
    }
  };

  const handleRenewMembership = async (e) => {
    e.preventDefault();
    if (!renewingMember) return;

    try {
      const memberRef = doc(db, 'gyms', currentUser.uid, 'members', renewingMember.id);
      const now = new Date();
      const currentExpiry = new Date(renewingMember.expiry_date);
      const baseDate = currentExpiry < now ? now : currentExpiry;
      const renewedExpiry = new Date(baseDate);
      renewedExpiry.setDate(renewedExpiry.getDate() + Number(renewingMember.planDuration || 30));

      await addDoc(collection(db, 'gyms', currentUser.uid, 'payments'), {
        memberId: renewingMember.id,
        member_name: renewingMember.name,
        amount: Number(renewalData.amount),
        method: renewalData.method,
        plan_type: renewingMember.planType || renewingMember.plan || 'Monthly',
        date: new Date().toISOString()
      });

      await updateDoc(memberRef, {
        expiry_date: renewedExpiry.toISOString().split('T')[0]
      });

      closeRenewModal();
    } catch (err) {
      console.error(err);
    }
  };

  const getStatus = (expiryDate) => {
    const now = new Date();
    const exp = new Date(expiryDate);
    return exp >= now
      ? { label: 'Active', color: 'text-primary bg-primary/10 border-primary/20' }
      : { label: 'Expired', color: 'text-error bg-error/10 border-error/20' };
  };

  const filteredMembers = members.filter((member) => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return true;

    return [
      member.name,
      member.phone,
      member.gender,
      member.age,
      member.plan,
      member.planType,
      member.expiry_date
    ].some((value) => String(value || '').toLowerCase().includes(query));
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black headline-font italic uppercase tracking-tighter text-on-surface">Member Directory</h1>
          <p className="text-zinc-500 font-medium mt-1">Manage operations and members</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddModal(true)}
          className="bg-primary hover:bg-primary-dim text-on-primary px-6 py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(253,139,0,0.3)] transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add Member
        </motion.button>
      </div>

      <div className="bg-surface-container-low/50 backdrop-blur-xl rounded-2xl border border-outline-variant/10 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container/50 border-b border-outline-variant/10">
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Member</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Phone</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Details</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Plan</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none text-center">Status</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Expiry</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {members.length === 0 ? (
                <tr><td colSpan="7" className="py-12 text-center text-sm font-medium text-zinc-500">No members registered yet.</td></tr>
              ) : filteredMembers.length === 0 ? (
                <tr><td colSpan="7" className="py-12 text-center text-sm font-medium text-zinc-500">No members match your search.</td></tr>
              ) : (
                <AnimatePresence>
                  {filteredMembers.map((m) => {
                    const status = getStatus(m.expiry_date);
                    return (
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, x: -20 }}
                        key={m.id}
                        className="hover:bg-zinc-800/30 transition-colors group cursor-default"
                      >
                        <td className="py-4 px-6 font-medium text-white">{m.name}</td>
                        <td className="py-4 px-6 text-sm text-zinc-400">{m.phone}</td>
                        <td className="py-4 px-6 text-sm text-zinc-400">
                          {[m.gender, m.age ? `${m.age} yrs` : ''].filter(Boolean).join(' | ') || '-'}
                        </td>
                        <td className="py-4 px-6 text-sm font-bold text-zinc-300">
                          <div>{m.planType || m.plan}</div>
                          <div className="text-xs font-medium text-zinc-500">
                            {m.planPrice ? `Rs ${Number(m.planPrice).toLocaleString()}` : 'Price not set'}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className={`px-2.5 py-1 rounded border text-[10px] font-black uppercase tracking-wider ${status.color}`}>{status.label}</span>
                        </td>
                        <td className="py-4 px-6 text-sm font-medium text-zinc-400">{new Date(m.expiry_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex gap-3 justify-end items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openRenewModal(m)} className="text-primary hover:text-white transition-colors text-xs font-bold flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">autorenew</span> Renew</button>
                            <button onClick={() => openEdit(m)} className="text-zinc-400 hover:text-white transition-colors text-xs font-bold flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">edit</span> Edit</button>
                            <button onClick={() => handleDelete(m.id)} className="text-error/70 hover:text-error transition-colors text-xs font-bold flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">delete</span> Delete</button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
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
              className="bg-surface-container-highest p-8 rounded-2xl w-full max-w-2xl border border-white/5 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-3">
                <button onClick={closeModal} className="text-zinc-500 hover:text-white"><span className="material-symbols-outlined">close</span></button>
              </div>

              <h2 className="text-2xl font-black headline-font italic mb-6 text-white uppercase">{editingId ? 'Edit Member' : 'Add New Member'}</h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Full Name</label>
                  <input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Phone Number</label>
                    <input required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                    <p className="text-xs text-zinc-500 mt-1">Unique. Used for future login and WhatsApp reminders.</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Gender</label>
                    <select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all">
                      <option value="">Not specified</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Age</label>
                    <input type="number" min="0" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Select Plan</label>
                    <select value={formData.planType} onChange={(e) => handlePlanTypeChange(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all">
                      {Object.keys(PLAN_OPTIONS).map((plan) => <option key={plan} value={plan}>{plan}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Plan Price</label>
                    <input type="number" min="0" required value={formData.planPrice} onChange={(e) => setFormData({ ...formData, planPrice: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Plan Duration</label>
                    <input readOnly value={PLAN_OPTIONS[formData.planType].label} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-300 outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Start Date</label>
                    <input type="date" required value={formData.joinDate} onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Expiry Date</label>
                    <input readOnly value={computedExpiryDate} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-300 outline-none" />
                  </div>
                </div>

                {formError && <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">{formError}</div>}

                <div className="pt-4 pb-2">
                  <button type="submit" className="w-full py-4 bg-primary text-zinc-950 font-black uppercase tracking-widest text-sm rounded-xl hover:bg-primary-dim shadow-[0_0_20px_rgba(253,139,0,0.2)] transition-all">
                    {editingId ? 'Save Changes' : 'Confirm Member'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRenewModal && renewingMember && (
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
              className="bg-surface-container-highest p-8 rounded-2xl w-full max-w-md border border-white/5 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-3">
                <button onClick={closeRenewModal} className="text-zinc-500 hover:text-white"><span className="material-symbols-outlined">close</span></button>
              </div>

              <h2 className="text-2xl font-black headline-font italic mb-2 text-white uppercase">Renew Membership</h2>
              <p className="text-sm text-zinc-400 mb-6">{renewingMember.name}</p>

              <form onSubmit={handleRenewMembership} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-white/5 bg-zinc-950/60 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Plan</p>
                    <p className="mt-1 text-sm font-bold text-white">{renewingMember.planType || renewingMember.plan}</p>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-zinc-950/60 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Renewal Period</p>
                    <p className="mt-1 text-sm font-bold text-white">{renewingMember.planDuration || 30} days</p>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Amount Received</label>
                  <input type="number" min="0" required value={renewalData.amount} onChange={(e) => setRenewalData({ ...renewalData, amount: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Payment Method</label>
                  <select value={renewalData.method} onChange={(e) => setRenewalData({ ...renewalData, method: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all">
                    <option>Cash</option>
                    <option>UPI</option>
                    <option>Card</option>
                  </select>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">New Expiry</p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {(() => {
                      const now = new Date();
                      const currentExpiry = new Date(renewingMember.expiry_date);
                      const baseDate = currentExpiry < now ? now : currentExpiry;
                      const renewedExpiry = new Date(baseDate);
                      renewedExpiry.setDate(renewedExpiry.getDate() + Number(renewingMember.planDuration || 30));
                      return renewedExpiry.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                    })()}
                  </p>
                </div>
                <div className="pt-2">
                  <button type="submit" className="w-full py-4 bg-primary text-zinc-950 font-black uppercase tracking-widest text-sm rounded-xl hover:bg-primary-dim shadow-[0_0_20px_rgba(253,139,0,0.2)] transition-all">
                    Confirm Renewal
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
