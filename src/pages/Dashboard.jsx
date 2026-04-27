import React, { useState, useEffect, useMemo, Component } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { isToday, isThisWeek, isThisMonth, parseISO, format, subMonths } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

class ChartErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div className="text-red-500 font-bold p-4 bg-red-500/10 rounded-xl whitespace-pre-wrap">Chart failed to load: {this.state.error?.message}</div>;
    }
    return this.props.children;
  }
}

export default function Dashboard() {
  const { currentUser } = useAuth();
  
  const [stats, setStats] = useState({
    incomeToday: 0,
    incomeWeekly: 0,
    incomeMonthly: 0,
    incomeAll: 0,
    
    expenseMonthly: 0,
    expenseAll: 0,

    netProfitMonthly: 0,
    netProfitAll: 0,

    totalMembers: 0,
    activeMembers: 0,
    expiredMembers: 0
  });

  const [pendingMembers, setPendingMembers] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [allPayments, setAllPayments] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [allMembers, setAllMembers] = useState([]);

  useEffect(() => {
    if (!currentUser) return;

    // Listen to members
    const membersRef = collection(db, 'gyms', currentUser.uid, 'members');
    const unsubscribeMembers = onSnapshot(membersRef, (snapshot) => {
      let total = 0, active = 0, expired = 0;
      const pendings = [];
      const now = new Date();
      now.setHours(0,0,0,0);
      
      snapshot.forEach(doc => {
        total++;
        const data = doc.data();
        const expiryDate = new Date(data.expiry_date);
        expiryDate.setHours(0,0,0,0);
        
        const diffTime = expiryDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0) {
          active++;
          if (diffDays <= 3) {
            pendings.push({ id: doc.id, ...data, pendingStatus: 'Expiring Soon', diffDays });
          }
        } else {
          expired++;
          pendings.push({ id: doc.id, ...data, pendingStatus: 'Expired', diffDays });
        }
      });
      // Sort pendings by how far overdue or closest to expiry
      pendings.sort((a,b) => new Date(a.expiry_date) - new Date(b.expiry_date));
      
      const membersData = [];
      snapshot.forEach(doc => membersData.push({ id: doc.id, ...doc.data() }));
      setAllMembers(membersData);

      setPendingMembers(pendings);
      setStats(s => ({ ...s, totalMembers: total, activeMembers: active, expiredMembers: expired }));
    });

    // Listen to payments (Income)
    const txRef = collection(db, 'gyms', currentUser.uid, 'payments');
    const unsubscribeTx = onSnapshot(txRef, (snapshot) => {
      let incomeT = 0, incomeW = 0, incomeM = 0, incomeA = 0;
      let txs = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const amount = data.amount || 0;
        const d = parseISO(data.date);
        
        incomeA += amount;
        if (isToday(d)) incomeT += amount;
        if (isThisWeek(d)) incomeW += amount;
        if (isThisMonth(d)) incomeM += amount;
        
        txs.push({ id: doc.id, ...data });
      });
      
      setAllPayments(txs);
      txs.sort((a,b) => new Date(b.date) - new Date(a.date));
      setTransactions(txs.slice(0, 5));
      
      setStats(s => ({ 
        ...s, 
        incomeToday: incomeT, 
        incomeWeekly: incomeW, 
        incomeMonthly: incomeM, 
        incomeAll: incomeA,
        netProfitMonthly: incomeM - s.expenseMonthly,
        netProfitAll: incomeA - s.expenseAll
      }));
    });

    // Listen to expenses
    const expRef = collection(db, 'gyms', currentUser.uid, 'expenses');
    const unsubscribeExp = onSnapshot(expRef, (snapshot) => {
      let expM = 0, expA = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const amount = data.amount || 0;
        const d = parseISO(data.date);
        
        expA += amount;
        if (isThisMonth(d)) expM += amount;
      });

      const exps = [];
      snapshot.forEach(doc => exps.push({ id: doc.id, ...doc.data() }));
      setAllExpenses(exps);

      setStats(s => ({ 
        ...s, 
        expenseMonthly: expM, 
        expenseAll: expA,
        netProfitMonthly: s.incomeMonthly - expM,
        netProfitAll: s.incomeAll - expA
      }));
    });

    return () => {
      unsubscribeMembers();
      unsubscribeTx();
      unsubscribeExp();
    };
  }, [currentUser]);

  const { financialChartData, memberChartData } = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      months.push(format(subMonths(new Date(), i), 'MMM yyyy'));
    }
    
    const finMap = {};
    const memMap = {};

    months.forEach(m => {
      finMap[m] = { name: m, Income: 0, Expense: 0, Profit: 0 };
      memMap[m] = { name: m, 'New Members': 0 };
    });

    allPayments.forEach(p => {
      if (!p.date) return;
      try {
        const d = parseISO(p.date);
        if (isNaN(d.getTime())) return;
        const m = format(d, 'MMM yyyy');
        if (finMap[m]) finMap[m].Income += Number(p.amount) || 0;
      } catch (e) {
        console.warn('Invalid payment date', p);
      }
    });

    allExpenses.forEach(e => {
      if (!e.date) return;
      try {
        const d = parseISO(e.date);
        if (isNaN(d.getTime())) return;
        const m = format(d, 'MMM yyyy');
        if (finMap[m]) finMap[m].Expense += Number(e.amount) || 0;
      } catch (e) {
        console.warn('Invalid expense date', e);
      }
    });

    const sortedMembers = [...allMembers].sort((a,b) => {
      const dA = new Date(a.join_date || a.created_at || '2000-01-01').getTime();
      const dB = new Date(b.join_date || b.created_at || '2000-01-01').getTime();
      return (isNaN(dA) ? 0 : dA) - (isNaN(dB) ? 0 : dB);
    });

    sortedMembers.forEach(m => {
      if (!m.join_date && !m.created_at) return;
      try {
        // created_at from firestore could be a timestamp object.
        // Let's coerce it or catch invalid string parses.
        let dateVal = m.join_date || m.created_at;
        if (typeof dateVal !== 'string' && dateVal?.toDate) {
            dateVal = dateVal.toDate();
        }
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return;
        const mStr = format(d, 'MMM yyyy');
        if (memMap[mStr]) memMap[mStr]['New Members'] += 1;
      } catch (e) {
        console.warn('Invalid member date', m);
      }
    });

    const fData = months.map(m => {
      finMap[m].Profit = finMap[m].Income - finMap[m].Expense;
      return finMap[m];
    });
    const mData = months.map(m => memMap[m]);

    return { financialChartData: fData, memberChartData: mData };
  }, [allPayments, allExpenses, allMembers]);

  // WhatsApp Handler
  const handleWhatsAppClick = (member) => {
    let phoneNum = member.phone.replace(/\D/g, '');
    if (phoneNum.length === 10) {
      phoneNum = '91' + phoneNum;
    }
    
    const formattedDate = new Date(member.expiry_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    let msg = "";
    
    if (member.pendingStatus === 'Expired') {
      msg = `Hey ${member.name}, your gym plan expired on ${formattedDate}. Please renew it as soon as possible to continue your workouts!`;
    } else {
      msg = `Hey ${member.name}, your gym plan is expiring in ${member.diffDays} days (on ${formattedDate}). Please renew it soon to avoid any interruptions to your workouts!`;
    }
    
    window.open(`https://api.whatsapp.com/send?phone=${phoneNum}&text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Card Animation Variant
  const cardVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div initial="hidden" animate="visible" transition={{ staggerChildren: 0.1 }}>
      
      {/* Header */}
      <motion.div variants={cardVariant} className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-10 gap-2 md:gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black headline-font italic tracking-tighter text-on-surface uppercase drop-shadow-lg">Dashboard</h1>
          <p className="text-sm md:text-base text-zinc-400 mt-1 font-medium tracking-wide">Live performance indicators</p>
        </div>
      </motion.div>

      {/* Income Row - Highlighting Times */}
      <motion.div variants={cardVariant} className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8">
        <div className="bg-surface-container-low/50 backdrop-blur-xl border border-primary/20 p-4 md:p-6 rounded-2xl bg-gradient-to-br from-surface to-primary/5 hover:-translate-y-1 transition-transform">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">calendar_today</span> Today's Income</p>
          <h2 className="text-2xl md:text-4xl font-black headline-font text-white">₹{stats.incomeToday.toLocaleString()}</h2>
        </div>
        <div className="bg-surface-container-low/50 backdrop-blur-xl border border-white/5 p-4 md:p-6 rounded-2xl hover:-translate-y-1 transition-transform">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Weekly Income</p>
          <h2 className="text-2xl md:text-3xl font-black headline-font text-white">₹{stats.incomeWeekly.toLocaleString()}</h2>
        </div>
        <div className="bg-surface-container-low/50 backdrop-blur-xl border border-white/5 p-4 md:p-6 rounded-2xl hover:-translate-y-1 transition-transform">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Monthly Income</p>
          <h2 className="text-2xl md:text-3xl font-black headline-font text-white">₹{stats.incomeMonthly.toLocaleString()}</h2>
        </div>
      </motion.div>

      {/* Major Stats Row */}
      <motion.div variants={cardVariant} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
        
        {/* Monthly Expenses */}
        <div className="bg-surface-container-low/50 backdrop-blur-xl border border-error/20 p-4 md:p-6 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform bg-gradient-to-br from-surface to-error/10">
          <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <span className="material-symbols-outlined text-[100px] text-error">receipt_long</span>
          </div>
          <p className="text-[10px] font-black text-error uppercase tracking-widest mb-1">Monthly Expenses</p>
          <h2 className="text-2xl md:text-3xl font-black headline-font text-white">₹{stats.expenseMonthly.toLocaleString()}</h2>
          <p className="text-[10px] md:text-xs text-zinc-500 mt-2 font-medium">₹{stats.expenseAll.toLocaleString()} All-Time</p>
        </div>

        {/* Net Profit Monthly */}
        <div className="bg-surface-container-low/50 backdrop-blur-xl border border-tertiary/30 p-4 md:p-6 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform bg-gradient-to-br from-surface to-tertiary/10">
          <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <span className="material-symbols-outlined text-[100px] text-tertiary">trending_up</span>
          </div>
          <p className="text-[10px] font-black text-tertiary uppercase tracking-widest mb-1">Monthly Net Profit</p>
          <h2 className="text-2xl md:text-3xl font-black headline-font text-white">₹{stats.netProfitMonthly.toLocaleString()}</h2>
          <p className="text-[10px] md:text-xs text-zinc-500 mt-2 font-medium">₹{stats.netProfitAll.toLocaleString()} All-Time</p>
        </div>

        {/* Members Status Widget */}
        <div className="lg:col-span-2 bg-surface-container-low/50 backdrop-blur-xl border border-white/5 p-4 md:p-6 rounded-2xl hover:-translate-y-1 transition-transform">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Membership Capacity</p>
          <div className="flex items-end gap-2 md:gap-3 mb-2">
            <h2 className="text-3xl md:text-4xl font-black headline-font text-white">{stats.totalMembers.toLocaleString()}</h2>
            <span className="text-[10px] md:text-xs font-bold text-zinc-500 mb-1.5 uppercase tracking-wider">Total</span>
          </div>
          <div className="mt-4 h-2 w-full bg-zinc-900 rounded-full overflow-hidden flex ring-1 ring-white/5">
            <div className="h-full bg-primary" style={{ width: stats.totalMembers ? `${(stats.activeMembers / stats.totalMembers) * 100}%` : '0%' }}></div>
            <div className="h-full bg-error" style={{ width: stats.totalMembers ? `${(stats.expiredMembers / stats.totalMembers) * 100}%` : '0%' }}></div>
          </div>
          <div className="mt-3 flex flex-col gap-2 text-[9px] font-black uppercase tracking-tighter sm:flex-row sm:items-center sm:justify-between md:text-[11px]">
            <div className="flex items-center gap-1.5 text-primary"><div className="w-2 h-2 rounded-full bg-primary" /> {stats.activeMembers} Active</div>
            <div className="flex items-center gap-1.5 text-error"><div className="w-2 h-2 rounded-full bg-error" /> {stats.expiredMembers} Expired (Pending)</div>
          </div>
        </div>

      </motion.div>

      {/* Charts Row */}
      <motion.div variants={cardVariant} className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 mb-10">
        
        {/* Financial Chart */}
        <div className="bg-surface-container-low/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4 md:p-6 shadow-xl">
          <h3 className="text-sm font-black headline-font uppercase tracking-tight mb-6 flex items-center gap-2 text-white">
            <span className="material-symbols-outlined text-[18px] text-tertiary">monitoring</span>
            Financial Overview
          </h3>
          <div className="h-64 md:h-80 w-full text-xs">
            <ChartErrorBoundary>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={financialChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="name" stroke="#52525b" tick={{ fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#52525b" tick={{ fill: '#a1a1aa' }} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="Income" stroke="#4ade80" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                  <Area type="monotone" dataKey="Profit" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartErrorBoundary>
          </div>
        </div>

        {/* Members Growth Chart */}
        <div className="bg-surface-container-low/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4 md:p-6 shadow-xl">
          <h3 className="text-sm font-black headline-font uppercase tracking-tight mb-6 flex items-center gap-2 text-white">
            <span className="material-symbols-outlined text-[18px] text-primary">groups</span>
            New Members Growth
          </h3>
          <div className="h-64 md:h-80 w-full text-xs">
            <ChartErrorBoundary>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={memberChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="name" stroke="#52525b" tick={{ fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#52525b" tick={{ fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: '#27272a', opacity: 0.4 }}
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
                    itemStyle={{ fontWeight: 'bold', color: '#fb923c' }}
                  />
                  <Bar dataKey="New Members" fill="#fb923c" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </ChartErrorBoundary>
          </div>
        </div>

      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        
        {/* Pending / Overdue Members List */}
        <motion.div variants={cardVariant} className="bg-surface-container-low/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4 md:p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-tertiary via-error to-error"></div>
          <h3 className="text-sm font-black headline-font uppercase tracking-tight mb-4 md:mb-5 flex items-center gap-2 text-white">
            <span className="material-symbols-outlined text-[18px] text-error">warning</span> Action Required
          </h3>
          <div className="space-y-3">
            {pendingMembers.length === 0 ? (
              <p className="text-sm text-zinc-500 font-medium">All members are healthy and active!</p>
            ) : (
              pendingMembers.slice(0, 5).map(m => {
                const isExpired = m.pendingStatus === 'Expired';
                
                return (
                  <div key={m.id} className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border transition-colors ${
                    isExpired 
                      ? 'bg-error/5 border-error/10 hover:bg-error/10' 
                      : 'bg-tertiary/5 border-tertiary/10 hover:bg-tertiary/10'
                  }`}>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {m.name}
                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded ${isExpired ? 'bg-error text-zinc-950' : 'bg-tertiary text-zinc-950'}`}>
                          {m.pendingStatus}
                        </span>
                      </h4>
                      <p className={`text-[10px] font-medium mt-0.5 break-words ${isExpired ? 'text-error/80' : 'text-tertiary/80'}`}>
                        {m.phone} • {isExpired ? `Expired on ${new Date(m.expiry_date).toLocaleDateString()}` : `Expiring in ${m.diffDays} days`}
                      </p>
                    </div>
                    
                    <button 
                      onClick={() => handleWhatsAppClick(m)}
                      title="Send WhatsApp Reminder"
                      className="p-2.5 bg-green-500/10 border border-green-500/20 hover:bg-green-500 hover:border-green-500 text-green-500 hover:text-zinc-950 rounded-full transition-all flex items-center justify-center shadow-lg shadow-green-500/0 hover:shadow-green-500/20">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 0C5.385 0 0 5.386 0 12.032c0 2.128.552 4.208 1.597 6.03l-1.579 5.766 5.894-1.547a11.967 11.967 0 006.119 1.688c6.645 0 12.031-5.385 12.031-12.03A12.033 12.033 0 0012.031 0zm0 21.968a9.922 9.922 0 01-5.066-1.385l-.364-.216-3.766.988 1.006-3.67-.236-.376A9.953 9.953 0 011.9 12.031c0-5.586 4.542-10.13 10.131-10.13a10.142 10.142 0 0110.129 10.13c0 5.585-4.543 10.13-10.129 10.13zm5.556-7.558c-.305-.152-1.802-.888-2.08-.99-.278-.101-.482-.152-.686.152-.204.305-.788.99-.966 1.192-.178.203-.356.229-.661.076-.305-.152-1.285-.474-2.449-1.512-.907-.808-1.52-1.806-1.698-2.11-.178-.305-.019-.47.133-.622.138-.138.305-.356.457-.534.152-.178.203-.305.305-.508.102-.203.051-.381-.025-.534-.076-.153-.686-1.656-.94-2.266-.248-.595-.502-.515-.686-.524-.178-.009-.381-.009-.584-.009-.204 0-.534.076-.813.381-.279.305-1.067 1.042-1.067 2.54 0 1.499 1.092 2.946 1.245 3.149.152.203 2.146 3.275 5.197 4.593.726.314 1.293.501 1.737.641.73.232 1.393.199 1.917.121.589-.088 1.802-.736 2.057-1.447.254-.711.254-1.32.178-1.447-.076-.127-.279-.203-.584-.356z"/></svg>
                    </button>
                  </div>
                );
              })
            )}
            {pendingMembers.length > 5 && (
              <p className="text-xs text-zinc-500 font-bold text-center pt-2 italic">+{pendingMembers.length - 5} more need action...</p>
            )}
          </div>
        </motion.div>

        {/* Recent Transactions List */}
        <motion.div variants={cardVariant} className="bg-surface-container-low/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4 md:p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/20"></div>
          <h3 className="text-sm font-black headline-font uppercase tracking-tight mb-4 md:mb-5 flex items-center gap-2 text-white">
            <span className="material-symbols-outlined text-[18px] text-primary">history</span> Recent Payments
          </h3>
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <p className="text-sm text-zinc-500 font-medium">No recent transactions recorded.</p>
            ) : (
              transactions.map(tx => (
                <div key={tx.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg bg-surface border border-white/5 hover:bg-white/5 transition-colors">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white">{tx.member_name}</h4>
                    <p className="text-[10px] text-zinc-400 font-medium break-words">{new Date(tx.date).toLocaleDateString()} • {tx.method}</p>
                  </div>
                  <span className="text-primary font-black text-sm sm:text-right">+₹{tx.amount.toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
}
