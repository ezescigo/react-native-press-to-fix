import { StyleSheet, Text, View } from 'react-native'

import { formatAmount, type Transaction } from '../data'

export function TransactionRow({ transaction }: { transaction: Transaction }) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.merchant}>{transaction.merchant}</Text>
        <Text style={styles.note}>{transaction.note}</Text>
      </View>
      <AmountLabel amount={transaction.amount} />
    </View>
  )
}

function AmountLabel({ amount }: { amount: number }) {
  return <Text style={[styles.amount, amount < 0 && styles.income]}>{formatAmount(amount)}</Text>
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  text: { flex: 1, gap: 2 },
  merchant: { fontSize: 16, fontWeight: '600', color: '#111' },
  note: { fontSize: 13, color: '#6b7280' },
  amount: { fontSize: 16, fontWeight: '600', color: '#111' },
  income: { color: '#16a34a' },
})
