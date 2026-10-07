import { FlatList, StyleSheet } from 'react-native'
import { useFixScreen } from 'react-native-press-to-fix'

import { TransactionRow } from '../components/TransactionRow'
import { transactions } from '../data'

export function ActivityScreen() {
  useFixScreen('Activity')
  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={transactions}
      keyExtractor={transaction => transaction.id}
      renderItem={({ item }) => <TransactionRow transaction={item} />}
    />
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
})
