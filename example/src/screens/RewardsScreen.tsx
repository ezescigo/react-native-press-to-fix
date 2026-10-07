import { StyleSheet, Text, View } from 'react-native'
import { useFixScreen } from 'react-native-press-to-fix'

import { STAMPS, STAMPS_FOR_FREE_DRINK } from '../menu'

export function RewardsScreen() {
  useFixScreen('Rewards')
  return (
    <View style={styles.content}>
      <Text style={styles.title}>Rewards</Text>
      <View style={styles.card}>
        <Text style={styles.caption}>
          {STAMPS} of {STAMPS_FOR_FREE_DRINK} stamps
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${STAMPS * 10}%` }]} />
        </View>
        <Text style={styles.hint}>One more coffee and the next one is on us.</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#3b2a20', marginBottom: 16 },
  card: { backgroundColor: '#3b2a20', borderRadius: 20, padding: 20, gap: 14 },
  caption: { color: '#f6efe6', fontSize: 16, fontWeight: '700' },
  track: { height: 10, borderRadius: 5, backgroundColor: '#5a4436', overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: '#e8a33d' },
  hint: { color: '#d8c7b5', fontSize: 14 },
})
