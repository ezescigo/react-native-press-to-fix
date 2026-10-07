export type Transaction = { id: string; merchant: string; note: string; amount: number }

export const card = { number: '•••• 4821', holderName: 'Alexandra Morgan-Whitfield', expiry: '09/29' }

export const transactions: Transaction[] = [
  { id: '1', merchant: 'Northwind GmbH', note: 'Salary, September', amount: 4650 },
  { id: '2', merchant: 'Corner Grocer', note: 'Groceries', amount: -42.18 },
  { id: '3', merchant: 'City Transit', note: 'Monthly pass', amount: -89 },
  { id: '4', merchant: 'Alex M.', note: 'Dinner split', amount: 27.5 },
  { id: '5', merchant: 'Streamly', note: 'Subscription', amount: -12.99 },
]

export const balance = transactions.reduce((sum, t) => sum + t.amount, 1200)

export const formatAmount = (amount: number) =>
  `${amount > 0 ? '+' : amount < 0 ? '−' : ''}€${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
