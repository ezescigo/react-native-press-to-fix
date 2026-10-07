import { StyleSheet, Text, View } from 'react-native'

import { card } from '../data'

export function WalletCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.brand}>Pocket</Text>
      <Text style={styles.number}>{card.number}</Text>
      <View style={styles.footer}>
        <Text style={styles.holder} numberOfLines={1}>
          {card.holderName}
        </Text>
        <Text style={styles.expiry}>{card.expiry}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1f3a5f', borderRadius: 20, padding: 20, gap: 18 },
  brand: { color: '#fff', fontSize: 18, fontWeight: '700' },
  number: { color: '#fff', fontSize: 22, letterSpacing: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  holder: { color: '#dbe6f5', fontSize: 15, width: 120 },
  expiry: { color: '#dbe6f5', fontSize: 15 },
})
