import { StyleSheet, Text, View } from 'react-native'
import { useFixScreen } from 'react-native-press-to-fix'

import { WalletCard } from '../components/WalletCard'

export function CardsScreen() {
  useFixScreen('Cards')
  return (
    <View style={styles.content}>
      <WalletCard />
      <Text style={styles.hint}>Freeze, replace or view your PIN from the card menu.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16 },
  hint: { fontSize: 14, color: '#6b7280' },
})
