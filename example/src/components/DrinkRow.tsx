import { StyleSheet, Text, View } from 'react-native'

import { formatPrice, type Drink } from '../menu'

export function DrinkRow({ drink }: { drink: Drink }) {
  return (
    <View style={styles.row}>
      <View style={styles.cup}>
        <Text style={styles.initial}>{drink.name[0]}</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.name}>{drink.name}</Text>
        <Text style={styles.notes}>{drink.notes}</Text>
      </View>
      <Text style={styles.price}>{formatPrice(drink.price)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  cup: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#efe4d6', alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 20, fontWeight: '700', color: '#c8643b' },
  text: { flex: 1, gap: 3 },
  name: { fontSize: 16, fontWeight: '700', color: '#3b2a20' },
  notes: { fontSize: 13, color: '#8a7565' },
  price: { fontSize: 16, fontWeight: '700', color: '#3b2a20' },
})
