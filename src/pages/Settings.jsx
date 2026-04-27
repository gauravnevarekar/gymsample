import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import ExportModal from '../components/ExportModal';
import { buildMembershipFinancials } from '../lib/formatters';
import { exportToExcel, filterByDateRange } from '../lib/exportUtils';

const EXPORT_OPTIONS = [
  { value: 'members', label: 'Members' },
  { value: 'payments', label: 'Payments' },
  { value: 'expenses', label: 'Expenses' }
];

function getMembershipStatus(member) {
  if (Number(member.balanceDue || 0) > 0) return 'Partial';
  if (!member.expiry_date) return 'Active';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(member.expiry_date);
  expiry.setHours(0, 0, 0, 0);

  const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24));
  if (daysLeft < 0) return 'Expired';
  if (daysLeft <= 7) return 'Expiring';
  return 'Active';
}

export default function Settings() {
  const { currentUser, logout } = useAuth();
  const [gymName, setGymName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadGymSettings() {
      if (!currentUser) return;
      try {
        setLoading(true);
        const gymRef = doc(db, 'gyms', currentUser.uid);
        const gymSnap = await getDoc(gymRef);
        if (gymSnap.exists()) {
          setGymName(gymSnap.data().name || 'GYMFLOW');
        } else {
          setGymName('GYMFLOW');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load gym settings.');
      } finally {
        setLoading(false);
      }
    }
    loadGymSettings();
  }, [currentUser]);

  async function handleSave(e) {
    e.preventDefault();
    if (!currentUser) return;
    try {
      setSaving(true);
      setError('');
      setMessage('');
      await updateDoc(doc(db, 'gyms', currentUser.uid), {
        name: gymName.trim() || 'GYMFLOW'
      });
      setMessage('Settings updated successfully.');
    } catch (err) {
      console.error(err);
      setError('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch (err) {
      console.error(err);
      setError('Failed to log out.');
    }
  }

  async function handleExport(exportType, startDate, endDate) {
    if (!currentUser) return;

    try {
      setIsExportingData(true);
      setError('');
      setMessage('');

      if (exportType === 'members') {
        const snapshot = await getDocs(collection(db, 'gyms', currentUser.uid, 'members'));
        const members = [];

        snapshot.forEach((memberDoc) => {
          const data = memberDoc.data();
          const financials = buildMembershipFinancials(
            data.planPrice,
            data.amountPaid ?? data.planPrice ?? 0
          );

          members.push({
            id: memberDoc.id,
            ...data,
            amountPaid: data.amountPaid ?? financials.amountPaid,
            balanceDue: data.balanceDue ?? financials.balanceDue
          });
        });

        const filteredMembers = filterByDateRange(members, 'join_date', startDate, endDate);
        exportToExcel(
          filteredMembers.map((member) => ({
            Name: member.name || '-',
            Phone: member.phone || '-',
            Gender: member.gender || '-',
            Age: member.age ?? '-',
            Plan: member.planType || member.plan || '-',
            'Join Date': member.join_date || '-',
            'Expiry Date': member.expiry_date || '-',
            Status: getMembershipStatus(member),
            'Total Fee': member.planPrice || 0,
            'Paid Amount': member.amountPaid || 0,
            Balance: member.balanceDue || 0
          })),
          'Members',
          `members-export-${startDate || 'all'}-to-${endDate || 'all'}.xlsx`
        );
      }

      if (exportType === 'payments') {
        const snapshot = await getDocs(collection(db, 'gyms', currentUser.uid, 'payments'));
        const payments = [];
        snapshot.forEach((paymentDoc) => payments.push({ id: paymentDoc.id, ...paymentDoc.data() }));

        const filteredPayments = filterByDateRange(payments, 'date', startDate, endDate);
        exportToExcel(
          filteredPayments.map((payment) => ({
            Date: new Date(payment.date).toLocaleDateString(),
            'Member Name': payment.member_name || '-',
            Category: payment.category || '-',
            Plan: payment.plan_type || '-',
            'Payment Type': payment.payment_phase || '-',
            'Payment Method': payment.method || '-',
            Amount: payment.amount || 0,
            'Balance After': payment.balance_after ?? '-',
            Notes: payment.notes || '-'
          })),
          'Payments',
          `payments-export-${startDate || 'all'}-to-${endDate || 'all'}.xlsx`
        );
      }

      if (exportType === 'expenses') {
        const snapshot = await getDocs(collection(db, 'gyms', currentUser.uid, 'expenses'));
        const expenses = [];
        snapshot.forEach((expenseDoc) => expenses.push({ id: expenseDoc.id, ...expenseDoc.data() }));

        const filteredExpenses = filterByDateRange(expenses, 'date', startDate, endDate);
        exportToExcel(
          filteredExpenses.map((expense) => ({
            Date: new Date(expense.date).toLocaleDateString(),
            Category: expense.category || '-',
            Description: expense.description || '-',
            Amount: expense.amount || 0
          })),
          'Expenses',
          `expenses-export-${startDate || 'all'}-to-${endDate || 'all'}.xlsx`
        );
      }

      setIsExportModalOpen(false);
      setMessage(`Exported ${exportType} successfully.`);
    } catch (err) {
      console.error(err);
      setError('Failed to export data.');
    } finally {
      setIsExportingData(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="mb-8 md:mb-10">
        <h1 className="text-3xl md:text-4xl font-black headline-font italic uppercase tracking-tighter text-on-surface">Settings</h1>
        <p className="text-zinc-500 font-medium mt-1">Manage your gym profile and account access</p>
      </div>

      <div className="max-w-2xl">
        <section className="bg-surface-container-low/50 backdrop-blur-xl rounded-2xl border border-outline-variant/10 shadow-2xl p-6 md:p-8">
          
          {loading ? (
            <p className="text-sm text-zinc-500">Loading settings...</p>
          ) : (
            <div className="space-y-8">
              {/* Profile Form */}
              <form onSubmit={handleSave} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Gym Name</label>
                  <input
                    value={gymName}
                    onChange={(e) => setGymName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-4 py-3 text-white outline-none transition-all"
                    placeholder="Enter gym name"
                  />
                </div>

                <div className="rounded-xl border border-white/5 bg-zinc-950/60 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Owner Email</p>
                  <p className="text-sm text-white mt-2 break-all">{currentUser?.email || '-'}</p>
                </div>

                {message && <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">{message}</div>}
                {error && <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">{error}</div>}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto bg-primary hover:bg-primary-dim disabled:opacity-60 text-zinc-950 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(253,139,0,0.2)] transition-all"
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>

              <hr className="border-white/5" />

              <div className="space-y-4">
                <div className="rounded-xl border border-white/5 bg-zinc-950/60 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Data Export</p>
                  <p className="mt-2 text-sm text-zinc-300">Export members, payments, or expenses from one place.</p>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setIsExportModalOpen(true)}
                      className="w-full sm:w-auto rounded-xl border border-white/10 bg-surface-container-highest px-6 py-3 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-white/10"
                    >
                      Export Data
                    </button>
                  </div>
                </div>
              </div>

              <hr className="border-white/5" />

              {/* Log Out */}
              <div>
                <button
                  onClick={handleLogout}
                  className="w-full rounded-xl border border-error/20 bg-error/10 px-5 py-4 text-sm font-black uppercase tracking-widest text-error hover:bg-error hover:text-zinc-950 transition-all flex justify-between items-center"
                >
                  Log Out
                  <span className="material-symbols-outlined">logout</span>
                </button>
              </div>

            </div>
          )}
        </section>
      </div>

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
        title="Export Data"
        isExporting={isExportingData}
        options={EXPORT_OPTIONS}
      />
    </motion.div>
  );
}
