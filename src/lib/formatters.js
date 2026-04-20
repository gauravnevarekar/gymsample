export function formatDisplayDate(value) {
  if (!value) return '-';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function formatCurrency(value) {
  return `Rs ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function buildMembershipFinancials(totalFee, paidAmount) {
  const fee = Math.max(Number(totalFee || 0), 0);
  const paid = Math.max(Number(paidAmount || 0), 0);
  const normalizedPaid = Math.min(paid, fee);
  const balanceDue = Math.max(fee - normalizedPaid, 0);

  return {
    totalFee: fee,
    amountPaid: normalizedPaid,
    balanceDue,
    paymentStatus: balanceDue > 0 ? 'Partial' : 'Paid'
  };
}
