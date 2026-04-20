import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

export default function Expenses() {
  const { currentUser } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newExpense, setNewExpense] = useState({ category: 'Rent', amount: '', description: '' });

  useEffect(() => {
    if (!currentUser) return;
    const expensesRef = collection(db, 'gyms', currentUser.uid, 'expenses');
    const unsubscribe = onSnapshot(expensesRef, (snapshot) => {
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a,b) => new Date(b.date) - new Date(a.date));
      setExpenses(list);
    });
    return unsubscribe;
  }, [currentUser]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'gyms', currentUser.uid, 'expenses'), {
        category: newExpense.category,
        description: newExpense.description,
        amount: Number(newExpense.amount),
        date: new Date().toISOString()
      });
      setShowAddModal(false);
      setNewExpense({ category: 'Rent', amount: '', description: '' });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 md:mb-10 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black headline-font italic uppercase tracking-tighter text-white">Expenses</h1>
          <p className="text-sm md:text-base text-zinc-500 font-medium mt-1">Track gym operational costs</p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddModal(true)}
          className="w-full md:w-auto bg-error hover:bg-error-dim text-white px-6 py-3.5 md:py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(255,115,81,0.3)] border border-error/50 transition-colors flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-sm">remove</span> Log Expense
        </motion.button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-surface-container-low/50 backdrop-blur-xl rounded-2xl border border-outline-variant/10 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container/50 border-b border-outline-variant/10">
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Date</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none text-center">Category</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Description</th>
                <th className="py-5 px-6 text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {expenses.length === 0 ? (
                <tr><td colSpan="4" className="py-12 text-center text-zinc-500 font-medium">No expenses logged yet.</td></tr>
              ) : (
                <AnimatePresence>
                  {expenses.map(exp => (
                    <motion.tr 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={exp.id} 
                      className="hover:bg-zinc-800/30 transition-colors group">
                      <td className="py-4 px-6 text-sm font-medium text-zinc-400">{new Date(exp.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td className="py-4 px-6 text-center">
                        <span className="bg-error/10 border border-error/20 text-error px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest">{exp.category}</span>
                      </td>
                      <td className="py-4 px-6 text-xs font-medium text-zinc-300">{exp.description}</td>
                      <td className="py-4 px-6 text-sm font-black text-error text-right">-₹{exp.amount.toFixed(2)}</td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {expenses.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 font-medium">No expenses logged yet.</div>
        ) : (
          <AnimatePresence>
            {expenses.map(exp => (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                key={exp.id} 
                className="bg-surface-container-low/50 backdrop-blur-xl rounded-2xl border border-outline-variant/10 p-5 shadow-lg flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-black text-white">{exp.category}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{new Date(exp.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                  <span className="text-error font-black text-lg">-₹{exp.amount.toFixed(2)}</span>
                </div>
                
                {exp.description && (
                  <div className="mt-1">
                    <p className="text-sm font-medium text-zinc-300">{exp.description}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 overflow-y-auto p-4 py-6">
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-surface-container-highest p-5 md:p-8 rounded-2xl w-full max-w-md max-h-[calc(100vh-3rem)] overflow-y-auto border border-white/5 shadow-2xl relative">
              <div className="absolute top-0 right-0 p-3">
                <button onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-white p-2 flex"><span className="material-symbols-outlined">close</span></button>
              </div>

              <h2 className="text-xl md:text-2xl font-black headline-font italic mb-6 text-white uppercase">Add Expense</h2>
              
              <form onSubmit={handleAddExpense} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Expense Category</label>
                  <select required value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})} className="w-full bg-zinc-900 border border-zinc-700 focus:border-error focus:ring-1 focus:ring-error rounded-lg px-4 py-3 text-white outline-none transition-all">
                    <option>Rent</option>
                    <option>Electricity</option>
                    <option>Equipment</option>
                    <option>Salary</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Description</label>
                  <input required value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} className="w-full bg-zinc-900 border border-zinc-700 focus:border-error focus:ring-1 focus:ring-error rounded-lg px-4 py-3 text-white outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Amount (₹)</label>
                  <input type="number" required value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} className="w-full bg-zinc-900 border border-zinc-700 focus:border-error focus:ring-1 focus:ring-error rounded-lg px-4 py-3 text-white outline-none transition-all" />
                </div>
                <div className="pt-4 pb-2">
                  <button type="submit" className="w-full py-4 bg-error text-white font-black uppercase tracking-widest text-sm rounded-xl hover:bg-error-dim shadow-[0_0_20px_rgba(255,115,81,0.2)] transition-all flex justify-center items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">receipt_long</span> Record Expense
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
