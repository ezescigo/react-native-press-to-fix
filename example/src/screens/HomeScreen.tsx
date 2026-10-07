import { ScrollView, StyleSheet, Text } from 'react-native'
import { useFixScreen } from 'react-native-press-to-fix'

import { QuickActions } from '../components/QuickActions'
import { TransactionRow } from '../components/TransactionRow'
import { WalletCard } from '../components/WalletCard'
import { balance, formatAmount, transactions } from '../data'

export function HomeScreen() {
  useFixScreen('Home')
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.caption}>Balance</Text>
      <Text style={styles.balance}>{formatAmount(balance).replace('+', '')}</Text>
      <WalletCard />
      <QuickActions />
      <Text style={styles.section}>Recent</Text>
      {transactions.slice(0, 3).map(transaction => (
        <TransactionRow key={transaction.id} transaction={transaction} />
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16 },
  caption: { fontSize: 14, color: '#6b7280' },
  balance: { fontSize: 36, fontWeight: '700', color: '#111', marginTop: -12 },
  section: { fontSize: 18, fontWeight: '700', color: '#111', marginTop: 8 },
})
