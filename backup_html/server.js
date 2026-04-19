const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend HTML files automatically
app.use(express.static(path.join(__dirname)));

// Memory database for prototyping
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the in-memory SQlite database.');
});

// Seed DB
db.serialize(() => {
    db.run(`CREATE TABLE members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        plan_type TEXT,
        status TEXT,
        join_date TEXT,
        avatar_url TEXT
    )`);

    db.run(`CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER,
        member_name TEXT,
        date TEXT,
        amount REAL,
        plan_type TEXT,
        status TEXT,
        FOREIGN KEY (member_id) REFERENCES members(id)
    )`);

    const members = [
        ['Julian D.', 'Elite Annual', 'Active', '2023-01-15', 'https://lh3.googleusercontent.com/aida-public/AB6AXuCIleeoVX1Xxyuca78uzDB_n6YQPZB0RMfDMsenJaBnFK0bpTUsPUzc4h3NxIo9AgTcQ2hE2g2FnWCcxodeeNPFgLtCDDYM9i0iGwfn6raHyDsrGnzl2UGHp2ff_hhrImLUvzURoE5GCovdkLpWcAjl95QKl8E9PjvZjbihD3Au6-sExhGNRFiJ22dmg9ECu6OfSpga3UKPpJErDBtolh8liIrd_YZOAWkJrf4sDShCVawRp1JoQClt7g5DTyrIkpDLG5TJGrTqHak'],
        ['Sarah M.', 'Pro Monthly', 'Active', '2023-05-20', 'https://lh3.googleusercontent.com/aida-public/AB6AXuD3OCSDCE-012l6zUteUs9ZhtQtbU0MiTV4APUuLWKH5ZU-M1Nt3qTdbfefAaIQ5yOuHWg-Ce5Rygv0E3FVQHfAZ-p0lcDag9SN7NSGjSjQPJmuaIj90Q0ZIA-S9Yk0hqfrB10OhIFtFYE1NebTXOYGi6Gr-_JYUpnlUyqNnD7QvYIxyCELtxxW7QywjekijVd9QWdCRuYqMF3DiCmjaI0VgpotPsr9n0h7gtCA-Cdr1LPoSo8ayZWT55chmCVWccJfllBVtwJR2DI'],
        ['Rick K.', 'Standard', 'Active', '2023-08-11', 'https://lh3.googleusercontent.com/aida-public/AB6AXuDL0NM6EgqsQpU3cVAze8pymOyXZhMRfMnLMIY3aEzdeyArUjY_vIa6ewa5mgymJAKqqJ1_piv3Nlwl24X5BxHGBf2ncLWXJhl4NKZ0O1O2nyWCMW1ygNDEI-MDbCMiaQBHaFBmxyRclrJUzSZrv2VAG2DsOR620tqXqKz5JkDYbNxp1d3Dln_tpbyP1WZzSpMEbifb1qpNRkocISSWEX3cZwK8gPUJVNUXeUupI6dSVlNT95b9atomSVqL41p3Ao4MelyxXxKhEGA'],
        ['Marco Kelly', 'Elite Annual', 'Active', '2023-10-24', ''],
        ['Lara Croft', 'Pro Monthly', 'Active', '2023-10-23', ''],
        ['Tom Bradi', 'Bodybuilder Plus', 'Expired', '2023-10-22', ''],
        ['Emma Power', 'Standard', 'Active', '2023-10-21', ''],
        ['Jack Jones', 'Elite Annual', 'Active', '2023-10-20', '']
    ];

    const stmt = db.prepare('INSERT INTO members (name, plan_type, status, join_date, avatar_url) VALUES (?, ?, ?, ?, ?)');
    members.forEach(m => stmt.run(m));
    stmt.finalize();

    const tx = [
        [4, 'Marco Kelly', 'Oct 24, 2023', 599.00, 'Elite Annual', 'Paid'],
        [5, 'Lara Croft', 'Oct 23, 2023', 85.00, 'Pro Monthly', 'Paid'],
        [6, 'Tom Bradi', 'Oct 22, 2023', 120.00, 'Bodybuilder Plus', 'Declined'],
        [7, 'Emma Power', 'Oct 21, 2023', 45.00, 'Standard', 'Paid'],
        [8, 'Jack Jones', 'Oct 20, 2023', 599.00, 'Elite Annual', 'Paid']
    ];

    const txStmt = db.prepare('INSERT INTO transactions (member_id, member_name, date, amount, plan_type, status) VALUES (?, ?, ?, ?, ?, ?)');
    tx.forEach(t => txStmt.run(t));
    txStmt.finalize();
});

// === API ROUTES ===

app.get('/api/dashboard', (req, res) => {
    res.json({
        totalIncome: 42850,
        totalExpenses: 18200,
        netProfit: 24650,
        totalMembers: 1248,
        activeMembers: 1060,
        expiredMembers: 188
    });
});

app.get('/api/members', (req, res) => {
    db.all("SELECT * FROM members", [], (err, rows) => {
        if (err) {
            res.status(400).json({"error":err.message});
            return;
        }
        res.json({ "data": rows });
    });
});

app.post('/api/members', (req, res) => {
    const { name, plan_type, status, join_date } = req.body;
    db.run(
        `INSERT INTO members (name, plan_type, status, join_date, avatar_url) VALUES (?, ?, ?, ?, ?)`,
        [name, plan_type, status, join_date, ''],
        function (err) {
            if (err) {
                res.status(400).json({"error": err.message});
                return;
            }
            res.json({ "id": this.lastID });
        }
    );
});

app.get('/api/transactions', (req, res) => {
    db.all("SELECT * FROM transactions ORDER BY id ASC", [], (err, rows) => {
        if (err) {
            res.status(400).json({"error":err.message});
            return;
        }
        res.json({ "data": rows });
    });
});

// Start Server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
