import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useFixScreen } from 'react-native-press-to-fix'

import { formatPrice, ORDER } from '../menu'

export function OrderScreen() {
  useFixScreen('Order')
  const total = ORDER.reduce((sum, line) => sum + line.drink.price * line.quantity, 0)

  return (
    <View style={styles.content}>
      <Text style={styles.title}>Your order</Text>
      {ORDER.map(line => (
        <View key={line.drink.id} style={styles.line}>
          <Text style={styles.quantity}>{line.quantity}×</Text>
          <Text style={styles.name}>{line.drink.name}</Text>
          <Text style={styles.amount}>{formatPrice(line.drink.price * line.quantity)}</Text>
        </View>
      ))}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.total}>{formatPrice(total)}</Text>
      </View>
      <Pressable style={styles.button}>
        <Text style={styles.buttonLabel}>Place order · pickup in 8 min</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 4 },
  title: { fontSize: 28, fontWeight: '800', color: '#3b2a20', marginBottom: 16 },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  quantity: { fontSize: 16, fontWeight: '700', color: '#c8643b', width: 28 },
  name: { flex: 1, fontSize: 16, color: '#3b2a20' },
  amount: { fontSize: 16, color: '#3b2a20' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#efe4d6', paddingTop: 16, marginTop: 8 },
  totalLabel: { fontSize: 18, fontWeight: '700', color: '#3b2a20' },
  total: { fontSize: 18, fontWeight: '700', color: '#3b2a20' },
  button: { marginTop: 28, backgroundColor: '#c8643b', borderRadius: 14, paddingVertical: 16, alignItems: 'center', opacity: 0.4 },
  buttonLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
