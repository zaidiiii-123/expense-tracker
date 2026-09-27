import csv
import io
from datetime import date
from fpdf import FPDF
from flask import (Flask, render_template, request, redirect, url_for,
                   flash, abort, Response)
from flask import Flask, render_template, request, redirect, url_for, flash
from flask_mysqldb import MySQL
from flask_login import (LoginManager, UserMixin, login_user,
                         logout_user, login_required, current_user)
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config.update(
    SECRET_KEY='i-am-batman-of-the-gotham-zaidiiii',
    MYSQL_HOST='zephyr.proxy.rlwy.net',
    MYSQL_PORT=28885,
    MYSQL_USER='root',
    MYSQL_PASSWORD='wSkStJFUzlYkDkHSTSPTMysUYHZSWjFs',
    MYSQL_DB='railway',
    MYSQL_CHARSET='utf8mb4',
    MYSQL_CURSORCLASS='DictCursor',
)
mysql = MySQL(app)

login_manager = LoginManager(app)
login_manager.login_view = 'login'


class User(UserMixin):
    def __init__(self, row):
        self.id = row['user_id']
        self.name = row['name']
        self.email = row['email']


@login_manager.user_loader
def load_user(user_id):
    cur = mysql.connection.cursor()
    cur.execute('SELECT * FROM users WHERE user_id = %s', (user_id,))
    row = cur.fetchone()
    return User(row) if row else None


@app.route('/')
def home():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form['name'].strip()
        email = request.form['email'].strip().lower()
        password = request.form['password']
        cur = mysql.connection.cursor()
        cur.execute('SELECT user_id FROM users WHERE email = %s', (email,))
        if cur.fetchone():
            flash('Email already registered')
        elif len(password) < 6:
            flash('Password must be at least 6 characters')
        else:
            cur.execute(
                'INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s)',
                (name, email, generate_password_hash(password)))
            mysql.connection.commit()
            return redirect(url_for('login'))
    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email'].strip().lower()
        cur = mysql.connection.cursor()
        cur.execute('SELECT * FROM users WHERE email = %s', (email,))
        row = cur.fetchone()
        if row and check_password_hash(row['password_hash'], request.form['password']):
            login_user(User(row))
            return redirect(url_for('dashboard'))
        flash('Invalid email or password')
    return render_template('login.html')


@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))


@app.route('/dashboard')
@login_required
def dashboard():
    uid = current_user.id
    cur = mysql.connection.cursor()

    cur.execute('SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS n '
                'FROM expenses WHERE user_id = %s', (uid,))
    overall = cur.fetchone()

    cur.execute('''SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
                   WHERE user_id = %s
                   AND expense_date >= DATE_FORMAT(CURDATE(), '%%Y-%%m-01')''', (uid,))
    month_total = cur.fetchone()['total']

    cur.execute('''SELECT c.category_name, SUM(e.amount) AS total
                   FROM expenses e
                   JOIN categories c ON e.category_id = c.category_id
                   WHERE e.user_id = %s
                   GROUP BY c.category_id, c.category_name
                   ORDER BY total DESC''', (uid,))
    by_category = cur.fetchall()

    cur.execute('''SELECT DATE_FORMAT(expense_date, '%%Y-%%m') AS ym,
                          DATE_FORMAT(expense_date, '%%b %%Y') AS label,
                          SUM(amount) AS total
                   FROM expenses
                   WHERE user_id = %s
                   AND expense_date >= DATE_SUB(DATE_FORMAT(CURDATE(), '%%Y-%%m-01'),
                                                INTERVAL 5 MONTH)
                   GROUP BY ym, label
                   ORDER BY ym''', (uid,))
    monthly = cur.fetchall()

    cur.execute('''SELECT e.amount, e.expense_date, e.note, c.category_name, c.icon
                   FROM expenses e
                   JOIN categories c ON e.category_id = c.category_id
                   WHERE e.user_id = %s
                   ORDER BY e.expense_date DESC, e.expense_id DESC
                   LIMIT 5''', (uid,))
    recent = cur.fetchall()

    alerts = [b for b in get_budget_status(uid) if b['status'] != 'ok']

    return render_template(
        'dashboard.html',
        total=overall['total'], count=overall['n'], month_total=month_total,
        recent=recent, alerts=alerts,
        month_labels=[m['label'] for m in monthly],
        month_values=[float(m['total']) for m in monthly],
        cat_labels=[c['category_name'] for c in by_category],
        cat_values=[float(c['total']) for c in by_category])


def get_categories():
    cur = mysql.connection.cursor()
    cur.execute('SELECT * FROM categories ORDER BY category_name')
    return cur.fetchall()

def filtered_expenses(uid, args):
    query = '''SELECT e.expense_id, e.expense_date, e.amount, e.note,
                      c.category_name, c.icon
               FROM expenses e
               JOIN categories c ON e.category_id = c.category_id
               WHERE e.user_id = %s'''
    params = [uid]
    if args.get('category_id'):
        query += ' AND e.category_id = %s'
        params.append(args['category_id'])
    if args.get('date_from'):
        query += ' AND e.expense_date >= %s'
        params.append(args['date_from'])
    if args.get('date_to'):
        query += ' AND e.expense_date <= %s'
        params.append(args['date_to'])
    query += ' ORDER BY e.expense_date DESC, e.expense_id DESC'
    cur = mysql.connection.cursor()
    cur.execute(query, params)
    return cur.fetchall()


@app.route('/expenses')
@login_required
def expenses():
    rows = filtered_expenses(current_user.id, request.args)
    return render_template('expenses.html', expenses=rows,
                           total=sum(r['amount'] for r in rows),
                           categories=get_categories(),
                           category_id=request.args.get('category_id', ''),
                           date_from=request.args.get('date_from', ''),
                           date_to=request.args.get('date_to', ''))


@app.route('/expenses/add', methods=['GET', 'POST'])
@login_required
def add_expense():
    if request.method == 'POST':
        cur = mysql.connection.cursor()
        cur.execute('''INSERT INTO expenses
                       (user_id, category_id, amount, expense_date, note)
                       VALUES (%s, %s, %s, %s, %s)''',
                    (current_user.id, request.form['category_id'],
                     request.form['amount'], request.form['expense_date'],
                     request.form['note'].strip()))
        mysql.connection.commit()
        return redirect(url_for('expenses'))
    return render_template('expense_form.html',
                           categories=get_categories(), expense=None)


@app.route('/expenses/<int:expense_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_expense(expense_id):
    cur = mysql.connection.cursor()
    cur.execute('SELECT * FROM expenses WHERE expense_id = %s AND user_id = %s',
                (expense_id, current_user.id))
    expense = cur.fetchone()
    if not expense:
        abort(404)
    if request.method == 'POST':
        cur.execute('''UPDATE expenses
                       SET category_id = %s, amount = %s, expense_date = %s, note = %s
                       WHERE expense_id = %s AND user_id = %s''',
                    (request.form['category_id'], request.form['amount'],
                     request.form['expense_date'], request.form['note'].strip(),
                     expense_id, current_user.id))
        mysql.connection.commit()
        return redirect(url_for('expenses'))
    return render_template('expense_form.html',
                           categories=get_categories(), expense=expense)


@app.route('/expenses/<int:expense_id>/delete', methods=['POST'])
@login_required
def delete_expense(expense_id):
    cur = mysql.connection.cursor()
    cur.execute('DELETE FROM expenses WHERE expense_id = %s AND user_id = %s',
                (expense_id, current_user.id))
    mysql.connection.commit()
    return redirect(url_for('expenses'))

def get_budget_status(uid):
    cur = mysql.connection.cursor()
    cur.execute('''SELECT b.budget_id, b.limit_amount, c.category_name, c.icon,
                          COALESCE((SELECT SUM(e.amount) FROM expenses e
                                    WHERE e.user_id = b.user_id
                                    AND e.category_id = b.category_id
                                    AND e.expense_date >= DATE_FORMAT(CURDATE(), '%%Y-%%m-01')
                                    AND e.expense_date <= LAST_DAY(CURDATE())), 0) AS spent
                   FROM budgets b
                   JOIN categories c ON b.category_id = c.category_id
                   WHERE b.user_id = %s
                   ORDER BY c.category_name''', (uid,))
    rows = cur.fetchall()
    for r in rows:
        r['percent'] = round(float(r['spent']) / float(r['limit_amount']) * 100)
        r['status'] = ('exceeded' if r['percent'] >= 100
                       else 'warning' if r['percent'] >= 80 else 'ok')
    return rows


@app.route('/budgets', methods=['GET', 'POST'])
@login_required
def budgets():
    if request.method == 'POST':
        category_id = request.form['category_id']
        limit_amount = request.form['limit_amount']
        cur = mysql.connection.cursor()
        cur.execute('SELECT budget_id FROM budgets WHERE user_id = %s AND category_id = %s',
                    (current_user.id, category_id))
        existing = cur.fetchone()
        if existing:
            cur.execute('UPDATE budgets SET limit_amount = %s WHERE budget_id = %s',
                        (limit_amount, existing['budget_id']))
        else:
            cur.execute('INSERT INTO budgets (user_id, category_id, limit_amount) '
                        'VALUES (%s, %s, %s)',
                        (current_user.id, category_id, limit_amount))
        mysql.connection.commit()
        return redirect(url_for('budgets'))
    return render_template('budgets.html',
                           budgets=get_budget_status(current_user.id),
                           categories=get_categories())


@app.route('/budgets/<int:budget_id>/delete', methods=['POST'])
@login_required
def delete_budget(budget_id):
    cur = mysql.connection.cursor()
    cur.execute('DELETE FROM budgets WHERE budget_id = %s AND user_id = %s',
                (budget_id, current_user.id))
    mysql.connection.commit()
    return redirect(url_for('budgets'))

@app.route('/reports')
@login_required
def reports():
    rows = filtered_expenses(current_user.id, request.args)
    summary = {}
    for r in rows:
        key = f"{r['icon']} {r['category_name']}"
        summary[key] = summary.get(key, 0) + r['amount']
    return render_template('reports.html', rows=rows, summary=summary,
                           total=sum(r['amount'] for r in rows),
                           categories=get_categories(),
                           category_id=request.args.get('category_id', ''),
                           date_from=request.args.get('date_from', ''),
                           date_to=request.args.get('date_to', ''))


@app.route('/reports/csv')
@login_required
def export_csv():
    rows = filtered_expenses(current_user.id, request.args)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(['Date', 'Category', 'Note', 'Amount'])
    for r in rows:
        writer.writerow([r['expense_date'], r['category_name'], r['note'] or '', r['amount']])
    writer.writerow([])
    writer.writerow(['', '', 'Total', sum(r['amount'] for r in rows)])
    return Response('\ufeff' + buf.getvalue(), mimetype='text/csv',
                    headers={'Content-Disposition': 'attachment; filename=expenses.csv'})


@app.route('/reports/pdf')
@login_required
def export_pdf():
    rows = filtered_expenses(current_user.id, request.args)
    safe = lambda s: (s or '').encode('latin-1', 'replace').decode('latin-1')
    widths = (30, 40, 80, 40)

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font('Helvetica', 'B', 16)
    pdf.cell(0, 10, 'Expense Report', new_x='LMARGIN', new_y='NEXT')
    pdf.set_font('Helvetica', size=10)
    pdf.cell(0, 6, f'{safe(current_user.name)} | Generated {date.today():%d %b %Y}',
             new_x='LMARGIN', new_y='NEXT')
    pdf.ln(4)

    pdf.set_font('Helvetica', 'B', 10)
    for w, h in zip(widths, ('Date', 'Category', 'Note', 'Amount (Rs.)')):
        pdf.cell(w, 8, h, border=1)
    pdf.ln()

    pdf.set_font('Helvetica', size=10)
    for r in rows:
        pdf.cell(widths[0], 8, r['expense_date'].strftime('%d-%m-%Y'), border=1)
        pdf.cell(widths[1], 8, safe(r['category_name']), border=1)
        pdf.cell(widths[2], 8, safe(r['note'])[:40], border=1)
        pdf.cell(widths[3], 8, f"{r['amount']:.2f}", border=1, align='R')
        pdf.ln()

    pdf.set_font('Helvetica', 'B', 10)
    pdf.cell(sum(widths[:3]), 8, 'Total', border=1, align='R')
    pdf.cell(widths[3], 8, f"{sum(r['amount'] for r in rows):.2f}", border=1, align='R')

    return Response(bytes(pdf.output()), mimetype='application/pdf',
                    headers={'Content-Disposition': 'attachment; filename=expenses.pdf'})


if __name__ == '__main__':
    app.run()